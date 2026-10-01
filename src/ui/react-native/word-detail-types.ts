import type { LingoDataClient } from "../../core/lingo-data-client.js";
import type { UserWordStreaksDataContextType } from "../../react/user-word-streaks.js";
export type { L10nWordDetailData } from "../l10n-word-detail-types.js";

export type WordDetailClient = Pick<
  LingoDataClient,
  | "fetchLocalization"
  | "fetchAnnotation"
  | "getSBWordsForLangDir"
  | "getHancharDecomposition"
  | "fetchAndGenGloss"
  | "generateEmojis"
>;

/** Accepts the shared hook directly, or an app-owned implementation. */
export type NativeWordStreaksData = Pick<
  UserWordStreaksDataContextType,
  | "userWordStreaks"
  | "ensureUserWordStreaksForLang"
  | "setUserWordStreaksToValue"
  | "deleteUserWordStreaks"
>;
export type NativeTranslate = (text: string) => string;
export const defaultTranslate: NativeTranslate = (text) => text;
