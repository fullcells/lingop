import { linearizeTemplaticAText } from "../../core/annotation/converters.js";
import type {
  AnnotatedText,
  ATokenSubMorphemes,
  PhoneticToken,
} from "../../core/annotation/types.js";
import type { HancharReading } from "../../core/hanchar-decomposition.js";

export type FormattedL10nWordDetail = {
  annotatedText: AnnotatedText;
  wordSubMorphemes: ATokenSubMorphemes;
};

export type WordDetailCharacterTab =
  | "COMPONENTS"
  | "STROKES"
  | "SIMPLE_SCRIPT";
/** @deprecated Use WordDetailCharacterTab. */
export type YueWordDetailTab = WordDetailCharacterTab;

export const DEFAULT_WORD_DETAIL_CHARACTER_TAB: WordDetailCharacterTab =
  "COMPONENTS";
/** @deprecated Use DEFAULT_WORD_DETAIL_CHARACTER_TAB. */
export const DEFAULT_YUE_WORD_DETAIL_TAB = DEFAULT_WORD_DETAIL_CHARACTER_TAB;
export const WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY =
  "UI_PREF_YUE_WORD_DETAIL_CHARACTER_TAB";
/** @deprecated Use WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY. */
export const YUE_WORD_DETAIL_TAB_STORAGE_KEY =
  WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY;

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const HANCHAR_COMPONENT_LANGS = new Set(["ja", "yue", "cmn-hant"]);

export function supportsHancharComponents(lang: string | undefined): boolean {
  return HANCHAR_COMPONENT_LANGS.has(lang?.trim().toLowerCase() ?? "");
}

/** Returns unique Han characters in display order, excluding kana/punctuation. */
export function getUniqueHanCharacters(text: string): string[] {
  const characters: string[] = [];
  const seen = new Set<string>();
  for (const character of text) {
    if (!HAN_CHARACTER_PATTERN.test(character) || seen.has(character)) continue;
    seen.add(character);
    characters.push(character);
  }
  return characters;
}

/** Returns all available readings for the word's language without duplicates. */
export function getHancharReadings(
  readings: HancharReading[],
  lang: string | undefined,
): string[] {
  const normalizedLang = lang?.trim().toLowerCase() ?? "";
  return [
    ...new Set(
      readings
        .filter((reading) => reading.lang.trim().toLowerCase() === normalizedLang)
        .map((reading) => reading.reading.trim())
        .filter(Boolean),
    ),
  ];
}

/** Formats all available readings for the word's language without duplicates. */
export function formatHancharReadings(
  readings: HancharReading[],
  lang: string | undefined,
): string | null {
  const normalizedLang = lang?.trim().toLowerCase() ?? "";
  const values = getHancharReadings(readings, lang);
  if (values.length === 0) return null;
  return values.join(normalizedLang === "ja" ? "・" : " / ");
}

export type ReadingDisplayPart = {
  text: string;
  sharedWithNativeSpelling: boolean;
};

/** Splits a component reading around shared substrings. */
export function splitReadingByNativeSpellings(
  reading: string,
  nativeSpellings: string[],
  minimumMatchLength = 2,
): ReadingDisplayPart[] {
  if (nativeSpellings.length === 0) {
    return [{ text: reading, sharedWithNativeSpelling: false }];
  }

  const parts: ReadingDisplayPart[] = [];
  let unmatchedStart = 0;
  let start = 0;
  while (start < reading.length) {
    let longestMatch = "";
    for (let end = start + minimumMatchLength; end <= reading.length; end += 1) {
      const candidate = reading.slice(start, end);
      if (
        candidate.length > longestMatch.length &&
        nativeSpellings.some((nativeSpelling) =>
          nativeSpelling.includes(candidate),
        )
      ) {
        longestMatch = candidate;
      }
    }
    if (!longestMatch) {
      start += 1;
      continue;
    }
    if (unmatchedStart < start) {
      parts.push({
        text: reading.slice(unmatchedStart, start),
        sharedWithNativeSpelling: false,
      });
    }
    parts.push({ text: longestMatch, sharedWithNativeSpelling: true });
    start += longestMatch.length;
    unmatchedStart = start;
  }
  if (unmatchedStart < reading.length) {
    parts.push({
      text: reading.slice(unmatchedStart),
      sharedWithNativeSpelling: false,
    });
  }
  return parts.length > 0
    ? parts
    : [{ text: reading, sharedWithNativeSpelling: false }];
}

function normalizeJapaneseReading(value: string): string {
  return value.normalize("NFKC").trim();
}

/**
 * Returns the reading aligned to a phonetic part containing exactly the
 * requested Han character. Larger parts are intentionally skipped because
 * assigning their reading to one character would be guesswork.
 */
export function getJapaneseWordReadingForCharacter(
  phoneticToken: PhoneticToken | null | undefined,
  literal: string,
): string | null {
  for (const [chars, spelling] of phoneticToken ?? []) {
    if (
      chars.normalize("NFKC") === literal.normalize("NFKC") &&
      spelling?.trim()
    ) {
      return normalizeJapaneseReading(spelling);
    }
  }
  return null;
}

/**
 * Japanese phonetic relationships are only emphasized when both sides expose
 * the same complete on-yomi and the selected word actually uses that reading.
 * Partial kana overlap and unaligned dictionary inventories are too ambiguous.
 */
export function isExactJapaneseOnReadingMatch(
  reading: string,
  componentReadings: HancharReading[],
  wordReading: string | null,
): boolean {
  if (!wordReading) return false;
  const normalizedReading = normalizeJapaneseReading(reading);
  const isMatchingOnReading = (candidate: HancharReading) =>
    candidate.lang.trim().toLowerCase() === "ja" &&
    candidate.readingType?.trim().toLowerCase() === "on" &&
    normalizeJapaneseReading(candidate.reading) === normalizedReading;
  return componentReadings.some(isMatchingOnReading) &&
    normalizedReading === normalizeJapaneseReading(wordReading);
}

export function readWordDetailCharacterTab(): WordDetailCharacterTab {
  try {
    if (typeof window === "undefined") return DEFAULT_WORD_DETAIL_CHARACTER_TAB;
    const stored = window.localStorage.getItem(
      WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY,
    );
    return stored === "COMPONENTS" ||
      stored === "STROKES" ||
      stored === "SIMPLE_SCRIPT"
      ? stored
      : DEFAULT_WORD_DETAIL_CHARACTER_TAB;
  } catch {
    return DEFAULT_WORD_DETAIL_CHARACTER_TAB;
  }
}

export function writeWordDetailCharacterTab(
  tab: WordDetailCharacterTab,
): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY, tab);
    }
  } catch {
    // The in-memory selection still works when browser storage is unavailable.
  }
}

/** @deprecated Use readWordDetailCharacterTab. */
export const readYueWordDetailTab = readWordDetailCharacterTab;
/** @deprecated Use writeWordDetailCharacterTab. */
export const writeYueWordDetailTab = writeWordDetailCharacterTab;

/**
 * Narrows an annotation to the selected word. Raw root-and-pattern annotation
 * must be linearized before indexing because one displayed token can represent
 * multiple stored morphemes.
 */
export function formatL10nWordAsAnnotatedText(
  annotatedText: AnnotatedText,
  tokenIndex = 0,
): FormattedL10nWordDetail | null {
  const { linearizedAText, morphemesPerLinearToken } =
    linearizeTemplaticAText(annotatedText);
  const token = linearizedAText.tokens[tokenIndex];
  if (!token) return null;

  // Direct raw-word callers historically omitted wordSubMorphemes. Preserve
  // the detail/action path by treating the selected token as one morpheme.
  const wordSubMorphemes = morphemesPerLinearToken[tokenIndex] ?? [
    { morpheme: token.text, gloss: token.gloss ?? "" },
  ];

  return {
    annotatedText: {
      ...linearizedAText,
      lang_text: token.text,
      tokens: [token],
    },
    wordSubMorphemes,
  };
}
