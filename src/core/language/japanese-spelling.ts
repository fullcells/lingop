import { toHiragana, toKatakana, toRomaji } from "wanakana";
import type { AnnotatedToken, PhoneticToken } from "../annotation/types.js";
import { SpellingSystem } from "./spelling-systems.js";
import type { SpellingPart } from "./annotation-spelling.js";

const isKana = (text: string) => /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(text);
const smallKana = /^[ァィゥェォャュョヮ]$/u;
type Unit = { kana: string; owners: number[] };
type Source = { chars: string; reading: string; token: number; part: number; known: boolean };

/** Context changes the spelling, never the original annotation or its gloss boundaries. */
export function formatJapaneseSpellings(tokens: AnnotatedToken[], system: SpellingSystem | null): SpellingPart[][] {
  const sources: Source[] = [];
  const units: Unit[] = [];
  tokens.forEach((token, tokenIndex) => {
    const parts: PhoneticToken = token.phoneticToken?.length ? token.phoneticToken : [[token.text]];
    parts.forEach((part, partIndex) => {
      const [chars, supplied] = part;
      // Kana can read itself. Missing kanji readings are not romanizations.
      const reading = supplied?.trim() ? supplied : chars;
      const known = !!supplied?.trim() || isKana(chars) || /^[\p{P}\p{S}\s]+$/u.test(chars) || token.isWord !== 1;
      const owner = sources.length;
      sources.push({ chars, reading, token: tokenIndex, part: partIndex, known });
      if (token.isWord !== 1 || !known || /^[\p{P}\p{S}\s]+$/u.test(reading)) {
        units.push({ kana: "", owners: [owner] });
        return;
      }
      for (const char of toKatakana(reading.normalize("NFKC"), { passRomaji: true })) {
        const previous = units.at(-1);
        // A contracted mora has one spelling over its combined source span.
        if (smallKana.test(char) && previous && isKana(previous.kana) &&
            sources[previous.owners[0]!]!.token === tokenIndex &&
            toRomaji(previous.kana + char) !== toRomaji(previous.kana) + toRomaji(char)) {
          previous.kana += char;
          if (!previous.owners.includes(owner)) previous.owners.push(owner);
        } else units.push({ kana: char, owners: [owner] });
      }
    });
  });
  const spellings = sources.map(() => "");
  const parent = sources.map((_, i) => i);
  const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]!));
  let vowelContext = "";
  if (system === SpellingSystem.JA_ROMAJI) {
    units.forEach((unit, index) => {
      const owner = unit.owners[0]!;
      if (!unit.kana) {
        spellings[owner] = sources[owner]!.known ? sources[owner]!.reading : "";
        vowelContext = "";
        return;
      }
      let spelling = toRomaji(unit.kana);
      const following = units[index + 1]?.kana ?? "";
      if (unit.kana === "ッ" || unit.kana === "ン") {
        // Keep the geminating consonant / n separator on its originating part.
        let next = index + 1;
        while (units[next]?.kana === "ッ") next++;
        const tail = units.slice(index + 1, next + 1).map(u => u.kana).join("");
        if (following && isKana(following) && tail) {
          const suffix = toRomaji(tail);
          const combined = toRomaji(unit.kana + tail);
          if (suffix && combined.endsWith(suffix)) spelling = combined.slice(0, -suffix.length);
        }
        // An isolated/trailing っ is unresolved, not a fabricated dash or silence.
        if (!spelling) spelling = toHiragana(unit.kana);
      } else if (unit.kana === "ー") {
        // Normalize hiragana + ー through WanaKana's katakana long-vowel handling.
        const combined = toRomaji(vowelContext + "ー");
        spelling = vowelContext ? combined.slice(toRomaji(vowelContext).length) : "ー";
        if (!/^[aeiou]+$/.test(spelling)) spelling = "ー";
      }
      if (unit.kana !== "ー") vowelContext = isKana(unit.kana) ? unit.kana : "";
      spellings[owner] += spelling;
      for (const other of unit.owners.slice(1)) parent[root(other)] = root(owner);
    });
  } else {
    sources.forEach((source, i) => {
      spellings[i] = !source.known ? "" : system === null ? source.reading : system === SpellingSystem.JA_KATAKANA
        ? toKatakana(source.reading, { passRomaji: true })
        : toHiragana(source.reading, { passRomaji: true, convertLongVowelMark: false });
    });
  }
  const result: SpellingPart[][] = tokens.map(() => []);
  sources.forEach((source, i) => {
    const tokenParts = result[source.token]!;
    const previous = tokenParts.at(-1);
    const merged = root(i) !== i;
    if (merged && previous) {
      previous.chars += source.chars;
      previous.spelling += spellings[i];
      previous.sourcePartIndices.push(source.part);
    } else tokenParts.push({ chars: source.chars, spelling: spellings[i]!, sourcePartIndices: [source.part], unresolved: !source.known || /[っッー]/.test(spellings[i]!) && system === SpellingSystem.JA_ROMAJI });
  });
  return result;
}
