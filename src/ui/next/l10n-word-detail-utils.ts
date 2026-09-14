import { linearizeTemplaticAText } from "../../core/annotation/converters.js";
import type {
  AnnotatedText,
  ATokenSubMorphemes,
} from "../../core/annotation/types.js";
import type { HancharReading } from "../../core/hanchar-decomposition.js";

export type FormattedL10nWordDetail = {
  annotatedText: AnnotatedText;
  wordSubMorphemes: ATokenSubMorphemes;
};

export type YueWordDetailTab = "COMPONENTS" | "SIMPLE_SCRIPT";

export const DEFAULT_YUE_WORD_DETAIL_TAB: YueWordDetailTab = "COMPONENTS";
export const YUE_WORD_DETAIL_TAB_STORAGE_KEY =
  "UI_PREF_YUE_WORD_DETAIL_CHARACTER_TAB";

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

/** Formats all available readings for the word's language without duplicates. */
export function formatHancharReadings(
  readings: HancharReading[],
  lang: string | undefined,
): string | null {
  const normalizedLang = lang?.trim().toLowerCase() ?? "";
  const values = [
    ...new Set(
      readings
        .filter((reading) => reading.lang.trim().toLowerCase() === normalizedLang)
        .map((reading) => reading.reading.trim())
        .filter(Boolean),
    ),
  ];
  if (values.length === 0) return null;
  return values.join(normalizedLang === "ja" ? "・" : " / ");
}

export type ReadingDisplayPart = {
  text: string;
  sharedWithNativeSpelling: boolean;
};

/**
 * Splits a component reading around its longest meaningful contiguous overlap
 * with the character's modern spelling. A match must be at least two
 * characters, so tone values are never emphasized on their own; e.g. keoi5
 * and geoi6 share the spelling "eoi".
 */
export function splitReadingByNativeSpelling(
  reading: string,
  nativeSpelling: string | null,
): ReadingDisplayPart[] {
  if (!nativeSpelling) {
    return [{ text: reading, sharedWithNativeSpelling: false }];
  }

  let longestMatch = "";
  for (let start = 0; start < reading.length; start += 1) {
    for (let end = start + 2; end <= reading.length; end += 1) {
      const candidate = reading.slice(start, end);
      if (
        candidate.length > longestMatch.length &&
        nativeSpelling.includes(candidate)
      ) {
        longestMatch = candidate;
      }
    }
  }

  if (!longestMatch) {
    return [{ text: reading, sharedWithNativeSpelling: false }];
  }

  const matchStart = reading.indexOf(longestMatch);
  return [
    ...(matchStart > 0
      ? [{ text: reading.slice(0, matchStart), sharedWithNativeSpelling: false }]
      : []),
    { text: longestMatch, sharedWithNativeSpelling: true },
    ...(matchStart + longestMatch.length < reading.length
      ? [{
          text: reading.slice(matchStart + longestMatch.length),
          sharedWithNativeSpelling: false,
        }]
      : []),
  ];
}

export function readYueWordDetailTab(): YueWordDetailTab {
  try {
    if (typeof window === "undefined") return DEFAULT_YUE_WORD_DETAIL_TAB;
    const stored = window.localStorage.getItem(YUE_WORD_DETAIL_TAB_STORAGE_KEY);
    return stored === "COMPONENTS" || stored === "SIMPLE_SCRIPT"
      ? stored
      : DEFAULT_YUE_WORD_DETAIL_TAB;
  } catch {
    return DEFAULT_YUE_WORD_DETAIL_TAB;
  }
}

export function writeYueWordDetailTab(tab: YueWordDetailTab): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(YUE_WORD_DETAIL_TAB_STORAGE_KEY, tab);
    }
  } catch {
    // The in-memory selection still works when browser storage is unavailable.
  }
}

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
