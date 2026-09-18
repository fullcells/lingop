import { describe, expect, it } from "vitest";

import {
  getHancharComponentLayout,
  shouldUseHancharCompositionGlyph,
} from "./hanchar-component-display.js";

describe("Han-character component display", () => {
  it("uses a decomposition glyph for supplementary-plane components", () => {
    expect(shouldUseHancharCompositionGlyph("𢆶", true)).toBe(true);
  });

  it("keeps normal glyphs and atomic supplementary characters unchanged", () => {
    expect(shouldUseHancharCompositionGlyph("苗", true)).toBe(false);
    expect(shouldUseHancharCompositionGlyph("𢆶", false)).toBe(false);
  });

  it("preserves the composition direction at every recursive level", () => {
    expect(getHancharComponentLayout("⿰幺幺")).toEqual({
      direction: "horizontal",
      operator: "⿰",
    });
    expect(getHancharComponentLayout("⿱艹田")).toEqual({
      direction: "vertical",
      operator: "⿱",
    });
    expect(getHancharComponentLayout("⿻戈𢆶")).toEqual({
      direction: "overlay",
      operator: "⿻",
    });
  });
});
