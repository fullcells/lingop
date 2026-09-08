import type { SBCacheWordListL10nWordsRow } from "../../core/index.js";

/** Returns one list's localized words in source order without exact duplicates. */
export function getUniqueLocalizedWordsForList(
  rows: readonly SBCacheWordListL10nWordsRow[],
  listTitle: string,
): string[] {
  return [
    ...new Set(
      rows.find((row) => row.list_title === listTitle)?.l10n_words ?? [],
    ),
  ];
}
