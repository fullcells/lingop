import { describe, expect, it } from "vitest";

import {
  getStrokeFigure,
  smoothStrokePath,
  STROKE_VIEWS,
  strokeOrderColor,
  strokeViewNeedsCentrelines,
} from "./figure.js";
import { localStrokeDataProvider } from "./provider.js";
import type { StrokeCharacterData } from "./types.js";

async function load(character: string, lang: string) {
  const data = await localStrokeDataProvider.get(character, lang, {
    centrelines: true,
  });
  if (!data) throw new Error(`No stroke data for ${character}`);
  return data;
}

function viewBoxOf(figure: { viewBox: string }) {
  const [x, y, width, height] = figure.viewBox.split(" ").map(Number);
  return { x: x!, y: y!, width: width!, height: height! };
}

describe("stroke figures", () => {
  it("keeps STEPS free of centrelines and every other view on them", () => {
    expect(STROKE_VIEWS.filter(strokeViewNeedsCentrelines)).toEqual([
      "NUMBERS",
      "ARROWS",
      "COLORS",
      "ANIMATED",
    ]);
  });

  it("runs order colours from blue to red", () => {
    expect(strokeOrderColor(0, 10)).toBe("#2563eb");
    expect(strokeOrderColor(9, 10)).toBe("#b91c1c");
    expect(strokeOrderColor(0, 1)).toBe("#2563eb");
  });

  it("draws centrelines as smooth curves", () => {
    const d = smoothStrokePath([
      [0, 0],
      [10, 5],
      [20, 0],
      [30, 5],
    ]);
    expect(d.startsWith("M0,0 C")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
    expect(smoothStrokePath([[1, 2], [3, 4]])).toBe("M1,2 L3,4");
  });

  it("needs centrelines", () => {
    const data: StrokeCharacterData = {
      character: "一",
      source: "KANJIVG",
      strokes: ["M1 1L9 1"],
      viewBox: "0 0 109 109",
      pathKind: "STROKE",
    };
    expect(getStrokeFigure(data)).toBeNull();
  });

  it.each([
    ["學", "zh-hant", 16], // Make Me a Hanzi outlines, dense top
    ["機", "ja", 16], // KanjiVG centrelines
    ["嚟", "yue", 18], // GlyphWiki outlines
    ["喫", "cmn-hant", 12], // AnimCJK zh-Hant
  ])("lays out non-overlapping labels for %s", async (character, lang, strokes) => {
    const data = await load(character, lang);
    const figure = getStrokeFigure(data, { sizePx: 112 })!;
    expect(figure.penStrokes).toHaveLength(strokes);
    const box = viewBoxOf(figure);
    const centres = figure.penStrokes.map(({ label }) => label.center);
    for (const [i, a] of centres.entries()) {
      expect(a[0] - figure.labelRadius).toBeGreaterThanOrEqual(box.x);
      expect(a[1] - figure.labelRadius).toBeGreaterThanOrEqual(box.y);
      expect(a[0] + figure.labelRadius).toBeLessThanOrEqual(box.x + box.width);
      expect(a[1] + figure.labelRadius).toBeLessThanOrEqual(box.y + box.height);
      for (const b of centres.slice(i + 1)) {
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(
          figure.labelRadius * 2,
        );
      }
    }
  });

  it("is deterministic and cached per size", async () => {
    const data = await load("龍", "zh-hant");
    const again = await load("龍", "zh-hant");
    expect(getStrokeFigure(data)).toBe(getStrokeFigure(again));
    expect(getStrokeFigure(data, { sizePx: 120 })).not.toBe(getStrokeFigure(data));
  });

  it("numbers pen strokes, not AnimCJK continuation shapes", async () => {
    const figure = getStrokeFigure(await load("あ", "ja"))!;
    expect(figure.penStrokes.map(({ shapes }) => shapes.map(({ index }) => index))).toEqual([
      [0],
      [1],
      [2, 3],
    ]);
  });

  it("schedules shapes in order with a pause between pen strokes", async () => {
    const figure = getStrokeFigure(await load("ぬ", "ja"))!;
    const shapes = figure.penStrokes.flatMap(({ shapes }) => shapes);
    for (let k = 1; k < shapes.length; k += 1) {
      const previous = shapes[k - 1]!;
      expect(shapes[k]!.delayMs).toBeGreaterThanOrEqual(previous.delayMs + previous.durationMs);
    }
    // Continuation shapes follow without a pen lift.
    const [, second] = figure.penStrokes;
    const [first, continuation] = second!.shapes;
    expect(continuation!.delayMs).toBe(first!.delayMs + first!.durationMs);
    const last = shapes[shapes.length - 1]!;
    expect(figure.animationMs).toBe(last.delayMs + last.durationMs);
  });
});
