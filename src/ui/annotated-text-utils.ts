import type { AnnotatedToken, PhoneticPart } from "../core/annotation/types.js";

export type IndexedAnnotatedToken = { index: number; token: AnnotatedToken };

/** Group tokens that should not wrap onto a line by themselves. */
export function groupAnnotatedTokensToPreventWidows(
  tokens: AnnotatedToken[],
): IndexedAnnotatedToken[][] {
  const groups: IndexedAnnotatedToken[][] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const indexedToken = { index, token };

    // Group the Japanese opening quote with the next token when one exists.
    if (indexedToken.token.text === "「" && index + 1 < tokens.length) {
      const nextToken = tokens[index + 1];
      if (!nextToken) continue;
      groups.push([indexedToken, { index: index + 1, token: nextToken }]);
      index += 1;
      continue;
    }

    // Standard: group a trailing non-word token with the preceding group so
    // punctuation cannot become a visual orphan on the next line.
    if (indexedToken.token.isWord !== 0 || groups.length === 0) {
      groups.push([indexedToken]);
    } else {
      groups[groups.length - 1]?.push(indexedToken);
    }
  }
  return groups;
}

export function phoneticPartToSpelling(
  [chars, spelling]: PhoneticPart,
  lang: string,
  showMainText: boolean,
): string {
  let phoneticPartSpelling = spelling ?? chars;

  if (lang.toLowerCase() === "ja") {
    // BE default is Hiragana. Hide duplicates when the main text already shows it.
    if (phoneticPartSpelling === chars && chars !== "ー" && showMainText) {
      phoneticPartSpelling = "\u00a0";
    }
  }

  return phoneticPartSpelling;
}

