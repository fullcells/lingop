export * from "../l10n-word-detail-utils.js";
import {
  DEFAULT_WORD_DETAIL_CHARACTER_TAB,
  WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY,
  type WordDetailCharacterTab,
} from "../l10n-word-detail-utils.js";

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

export function writeWordDetailCharacterTab(tab: WordDetailCharacterTab): void {
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
