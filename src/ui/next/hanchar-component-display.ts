export type HancharComponentLayout = {
  direction: "horizontal" | "vertical" | "overlay";
  operator: string | null;
};

/**
 * Supplementary-plane Han characters have inconsistent system-font coverage.
 * When decomposition data is available, render their component structure as a
 * compact glyph instead of allowing the browser to show a tofu/LastResort box.
 */
export function shouldUseHancharCompositionGlyph(
  literal: string,
  hasComponents: boolean,
): boolean {
  if (!hasComponents) return false;
  const characters = Array.from(literal);
  return characters.length === 1 && (characters[0]?.codePointAt(0) ?? 0) > 0xffff;
}

export function getHancharComponentLayout(
  decomposition: string | null | undefined,
): HancharComponentLayout {
  const operator = Array.from(decomposition ?? "")[0] ?? null;
  if (operator === "⿱" || operator === "⿳") {
    return { direction: "vertical", operator };
  }
  if (operator === "⿰" || operator === "⿲") {
    return { direction: "horizontal", operator };
  }
  if (operator && "⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿".includes(operator)) {
    return { direction: "overlay", operator };
  }
  return { direction: "horizontal", operator: null };
}
