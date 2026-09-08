import type { SBWordRow2 } from "../../core/sb-words.js";

/** Build the case-insensitive lookup used to restore stored uppercase words. */
export function buildCanonicalWordCaseMap(
  rows: ReadonlyArray<Pick<SBWordRow2, "word">>,
): Record<string, string> {
  const wordCases: Record<string, string> = {};

  for (const { word } of rows) {
    const upperWord = word.toUpperCase();
    const existingWord = wordCases[upperWord];
    if (!existingWord) {
      wordCases[upperWord] = word;
      continue;
    }

    // Prefer an all-lowercase form where duplicate case variants exist.
    if (word === word.toLowerCase()) wordCases[upperWord] = word;
  }

  return wordCases;
}

export function resolveWordDisplayCase({
  word,
  isLangCaseSensitive,
  canonicalWordCases,
}: {
  word: string;
  isLangCaseSensitive: boolean;
  canonicalWordCases: Record<string, string> | null;
}): string {
  if (!isLangCaseSensitive) return word;
  return canonicalWordCases?.[word.toUpperCase()] ?? word.toLowerCase();
}
