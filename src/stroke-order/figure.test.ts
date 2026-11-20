import { describe, expect, it } from "vitest";

import { getStrokeFigure, smoothStrokePath, strokeViewNeedsCentrelines } from "./figure.js";
import type { StrokeCharacterData } from "./types.js";

// 三 with a continuation shape on its last stroke; synthetic so layout or data
// changes upstream cannot break these behavioural checks.
const data: StrokeCharacterData = {
  character: "三",
  source: "KANJIVG",
  strokes: ["M20 20L90 20", "M25 55L85 55", "M10 90L60 90", "M60 90L100 90"],
  viewBox: "0 0 109 109",
  pathKind: "STROKE",
  continuations: [3],
  centrelines: [
    [[20, 20], [90, 20]],
    [[25, 55], [85, 55]],
    [[10, 90], [60, 90]],
    [[60, 90], [100, 90]],
  ],
};

describe("stroke figures", () => {
  it("only the step view works without centrelines", () => {
    expect(strokeViewNeedsCentrelines("STEPS")).toBe(false);
    expect(strokeViewNeedsCentrelines("NUMBERS")).toBe(true);
    const { centrelines: _, ...withoutCentrelines } = data;
    expect(getStrokeFigure(withoutCentrelines)).toBeNull();
  });

  it("draws centrelines as curves", () => {
    expect(smoothStrokePath([[0, 0], [10, 5], [20, 0]])).toMatch(/^M0,0 C/);
  });

  it("labels each pen stroke once, including continuation shapes", () => {
    const figure = getStrokeFigure(data)!;
    expect(figure.penStrokes.map(({ number }) => number)).toEqual([1, 2, 3]);
    expect(figure.penStrokes[2]!.shapes.map(({ index }) => index)).toEqual([2, 3]);
  });

  it("animates shapes one after another", () => {
    const shapes = getStrokeFigure(data)!.penStrokes.flatMap(({ shapes }) => shapes);
    for (let k = 1; k < shapes.length; k += 1) {
      expect(shapes[k]!.delayMs).toBeGreaterThanOrEqual(shapes[k - 1]!.delayMs);
    }
  });
});
