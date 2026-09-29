import {
  applyPronunciationRules,
  applyRomanMapping,
  romanize,
  splitHangulToJamos,
} from "koroman";

/** Avoid Koroman's mutable global dictionary: guides depend only on the input. */
export function romanizeKorean(text: string): string {
  return romanize(text, { useCustomDictionary: false });
}

/**
 * Koroman 1.0.16's -잎 prepass is not exported from its package entry point.
 * Mirror that small deterministic prepass before using its exported jamo
 * pipeline. The joined result is checked against romanize() below, so an
 * upstream behavior change cannot silently produce a different guide.
 */
function prepareFinalIp(text: string): string {
  if (text.length < 2 || !text.endsWith("잎")) return text;
  const precedingSyllable = text.charCodeAt(text.length - 2) - 0xac00;
  return precedingSyllable % 28 !== 0 ? `${text.slice(0, -1)}닢` : text;
}

/**
 * Process a whole Hangul sequence before aligning its pronounced syllables to
 * written syllables. Consonants may migrate (먹어요 → meo / geo / yo); vowels
 * retain their order and anchor the alignment. This preserves Koroman's RR
 * policy, including its deliberate omission of some tense consonants.
 *
 * This adapter depends on the pinned 1.0.16 intermediate representation:
 * initial/medial/final jamo, literal `ll` for lateral assimilation, and optional
 * internal hyphens. Unexpected output falls back to a whole-token annotation.
 */
export function getKoreanSyllableSpellings(text: string): string[] | null {
  if (!/^[가-힣]+$/u.test(text)) return null;
  const { jamoString } = splitHangulToJamos(prepareFinalIp(text));
  const pronounced = applyPronunciationRules(jamoString);
  // A silent onset may be removed by the ㅎ + ㅇ rule (좋아 → jo / a).
  // In `ll`, the first l is the preceding coda, the second the next onset.
  const syllables = pronounced.match(
    /[\u1100-\u1112l]?[\u1161-\u1175][\u11a8-\u11c2l]?-?/gu,
  );
  if (!syllables || syllables.join("") !== pronounced) return null;
  const originalVowels = jamoString.match(/[\u1161-\u1175]/gu);
  const outputVowels = pronounced.match(/[\u1161-\u1175]/gu);
  if (
    syllables.length !== text.length ||
    originalVowels?.join("") !== outputVowels?.join("")
  ) return null;

  const spellings = syllables.map((syllable) => applyRomanMapping(syllable));
  return spellings.every(Boolean) && spellings.join("") === romanizeKorean(text)
    ? spellings
    : null;
}
