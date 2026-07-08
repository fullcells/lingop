import type { AnnotatedMarkdownSegment, BinderDocRow, MarkdownSegment } from "./types.js";

export function convertBinderDocToMarkdownLines(
  doc: Pick<BinderDocRow, "text"> | null,
): MarkdownSegment[][] {
  if (!doc) return [];
  return convertTextToMarkdownLines(doc.text);
}

export function convertTextToMarkdownLines(text: string): MarkdownSegment[][] {
  if (!text) return [];
  return text.split("\n").map((line) => convertLineToMarkdownSegments(line));
}

export function convertLineToMarkdownSegments(lineText: string): MarkdownSegment[] {
  if (lineText.length === 0) return [];

  if (/^[\|\-\s]+$/.test(lineText)) {
    return [{ isMd: true, text: lineText }];
  }

  if (lineText.includes("|")) {
    const segments: MarkdownSegment[] = [];
    const parts = lineText.split(/(\|)/);
    for (const part of parts) {
      if (part === "") continue;
      segments.push(
        part === "|"
          ? { isMd: true, text: part }
          : { isMd: false, text: part.trim() },
      );
    }
    return segments;
  }

  const prefixPatterns = [/^(#{1,6} )/, /^(\d+\. )/, /^(- )/, /^(> )/];
  for (const pattern of prefixPatterns) {
    const match = lineText.match(pattern);
    if (!match) continue;

    const prefix = match[1] ?? "";
    const remainder = lineText.slice(prefix.length);
    return [
      { isMd: true, text: prefix },
      ...(remainder.length ? [{ isMd: false, text: remainder.trim() }] : []),
    ];
  }

  return [{ isMd: false, text: lineText.trim() }];
}

export function uniqueWordsFromAnnotatedMarkdownLines(
  lines: AnnotatedMarkdownSegment[][],
): string[] {
  const words = new Set<string>();
  for (const line of lines) {
    for (const segment of line) {
      if (segment.isMd || !segment.atext) continue;
      for (const token of segment.atext.tokens) {
        if (token.isWord) words.add(token.text.toUpperCase());
      }
    }
  }
  return Array.from(words).sort();
}

/**
 * @deprecated Use convertBinderDocToMarkdownLines.
 */
export const convertDocToRawMarkdownLines = convertBinderDocToMarkdownLines;

/**
 * @deprecated Use convertTextToMarkdownLines.
 */
export const convertTextToRawMarkdownLines = convertTextToMarkdownLines;

/**
 * @deprecated Use uniqueWordsFromAnnotatedMarkdownLines.
 */
export const uniqueWordsFromAnnotatedLines = uniqueWordsFromAnnotatedMarkdownLines;

