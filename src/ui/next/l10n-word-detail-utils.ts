export * from "../l10n-word-detail-utils.js";
import {
  DEFAULT_STROKE_VIEW,
  isStrokeView,
  type StrokeView,
} from "../../stroke-order/figure.js";
import {
  DEFAULT_WORD_DETAIL_CHARACTER_TAB,
  WORD_DETAIL_CHARACTER_TAB_STORAGE_KEY,
  WORD_DETAIL_STROKE_VIEW_STORAGE_KEY,
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

export function readWordDetailStrokeView(): StrokeView {
  try {
    if (typeof window === "undefined") return DEFAULT_STROKE_VIEW;
    const stored = window.localStorage.getItem(WORD_DETAIL_STROKE_VIEW_STORAGE_KEY);
    return isStrokeView(stored) ? stored : DEFAULT_STROKE_VIEW;
  } catch {
    return DEFAULT_STROKE_VIEW;
  }
}

export function writeWordDetailStrokeView(view: StrokeView): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORD_DETAIL_STROKE_VIEW_STORAGE_KEY, view);
    }
  } catch {
    // The in-memory selection still works when browser storage is unavailable.
  }
}

/** @deprecated Use readWordDetailCharacterTab. */
export const readYueWordDetailTab = readWordDetailCharacterTab;
/** @deprecated Use writeWordDetailCharacterTab. */
export const writeYueWordDetailTab = writeWordDetailCharacterTab;
