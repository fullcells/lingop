import { linearizeTemplaticAText } from "../../core/annotation/converters.js";
import type {
  AnnotatedText,
  ATokenSubMorphemes,
} from "../../core/annotation/types.js";

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
