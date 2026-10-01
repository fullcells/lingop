import type { LingoDataClient } from "../../core/lingo-data-client.js";
import type { UserWordStreaksByLang } from "../../core/user-word-streaks.js";
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

/** Structurally compatible with the existing learning-state provider's API.
 * The host app owns persistence and publishes updated counts through this prop. */
export type NativeWordStreaksData = {
  userWordStreaks: UserWordStreaksByLang;
  ensureUserWordStreaksForLang(lang: string): Promise<void>;
  setUserWordStreaksToValue(
    lang: string,
    words: string[],
    value: number,
  ): Promise<void>;
  deleteUserWordStreaks(lang: string, words: string[]): Promise<void>;
};
export type NativeTranslate = (text: string) => string;
export const defaultTranslate: NativeTranslate = (text) => text;
