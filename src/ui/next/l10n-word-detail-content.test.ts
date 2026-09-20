import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./l10n-word-detail-content.tsx", import.meta.url),
  "utf8",
);

describe("WordDetails character tabs", () => {
  it("places Strokes after Components and before Simple", () => {
    const tabOrder = source.slice(
      source.indexOf("const characterTabs"),
      source.indexOf("const selectedCharacterTab"),
    );
    const components = tabOrder.indexOf('["COMPONENTS"]');
    const strokes = tabOrder.indexOf('["STROKES"]');
    const simple = tabOrder.indexOf('["SIMPLE_SCRIPT"]');

    expect(components).toBeGreaterThanOrEqual(0);
    expect(strokes).toBeGreaterThan(components);
    expect(simple).toBeGreaterThan(strokes);
    expect(source).toContain("<StrokeOrderView");
  });
});
