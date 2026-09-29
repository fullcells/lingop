/** Keep plain number runs together while preserving actual emoji graphemes. */
export function segmentGlossEmoji(emoji: string): string[] {
  const graphemes =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter("en", { granularity: "grapheme" }).segment(emoji),
          ({ segment }) => segment,
        )
      : Array.from(emoji);

  const segments: string[] = [];
  for (const grapheme of graphemes) {
    const previousIndex = segments.length - 1;
    const previous = segments[previousIndex];
    if (
      /^[0-9]$/.test(grapheme) &&
      previous !== undefined &&
      /^[0-9]+$/.test(previous)
    ) {
      segments[previousIndex] = previous + grapheme;
    } else {
      segments.push(grapheme === " " ? "\u2002" : grapheme);
    }
  }
  return segments;
}
