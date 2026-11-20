import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OATDataProvider } from "../../oat/react/index.js";
import type { StrokeCharacterData } from "../../stroke-order/index.js";
import { StrokeCharacterDiagram } from "./stroke-order-view.js";

describe("StrokeCharacterDiagram", () => {
  it("renders one progressively accumulated diagram per stroke", () => {
    const data: StrokeCharacterData = {
      character: "一",
      source: "KANJIVG",
      strokes: ["M1 1L9 1", "M1 5L9 5", "M1 9L9 9"],
      viewBox: "0 0 10 10",
      pathKind: "STROKE",
    };
    const html = renderToStaticMarkup(
      <OATDataProvider
        guiLang="en"
        focusLang={null}
        initialOATranslationsByLang={{}}
        loaders={{
          loadTranslations: async () => null,
          loadStaticAnnotations: async () => null,
        }}
      >
        <StrokeCharacterDiagram data={data} />
      </OATDataProvider>,
    );

    expect(html.match(/<svg[^>]*data-path-kind=/g)).toHaveLength(3);
    expect(html.match(/<path/g)).toHaveLength(7);
    expect(html.match(/data-active="true"/g)).toHaveLength(3);
    expect(html).toContain("3 strokes");
    expect(html).toContain('title="Stroke source: KanjiVG"');
    expect(html).not.toContain("drawing steps");
  });

  it("shows a stroke and its continuation shapes as one step", () => {
    const data: StrokeCharacterData = {
      character: "あ",
      source: "ANIMCJK_JA",
      strokes: ["M1 1L9 1", "M5 1L5 9", "M1 5L9 9", "M9 9L1 5"],
      viewBox: "0 0 10 10",
      pathKind: "OUTLINE",
      continuations: [3],
    };
    const html = renderToStaticMarkup(
      <OATDataProvider
        guiLang="en"
        focusLang={null}
        initialOATranslationsByLang={{}}
        loaders={{
          loadTranslations: async () => null,
          loadStaticAnnotations: async () => null,
        }}
      >
        <StrokeCharacterDiagram data={data} />
      </OATDataProvider>,
    );

    expect(html.match(/<svg[^>]*data-path-kind=/g)).toHaveLength(3);
    expect(html.match(/<path/g)).toHaveLength(1 + 1 + 2 + 4); // source icon + steps
    expect(html.match(/data-active="true"/g)).toHaveLength(1 + 1 + 2);
    expect(html).toContain("3 strokes");
  });
});
