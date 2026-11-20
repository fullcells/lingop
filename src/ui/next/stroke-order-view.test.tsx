import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OATDataProvider } from "../../oat/react/index.js";
import type { StrokeCharacterData } from "../../stroke-order/index.js";
import {
  StrokeCharacter,
  StrokeCharacterDiagram,
  StrokeOrderView,
} from "./stroke-order-view.js";

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <OATDataProvider
      guiLang="en"
      focusLang={null}
      initialOATranslationsByLang={{}}
      loaders={{
        loadTranslations: async () => null,
        loadStaticAnnotations: async () => null,
      }}
    >
      {node}
    </OATDataProvider>,
  );
}

// 二 with a continuation shape on its second stroke.
const outlineData: StrokeCharacterData = {
  character: "二",
  source: "MAKEMEAHANZI",
  strokes: ["M10 10L90 10L90 20Z", "M5 80L95 80L95 90Z", "M95 85L5 85Z"],
  viewBox: "0 0 100 100",
  pathKind: "OUTLINE",
  transform: "translate(0 100) scale(1 -1)",
  continuations: [2],
  centrelines: [
    [
      [10, 15],
      [90, 15],
    ],
    [
      [5, 85],
      [50, 86],
      [95, 85],
    ],
    [
      [95, 85],
      [5, 85],
    ],
  ],
};

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

  it("falls back to the step diagram when centrelines are missing", () => {
    const { centrelines: _, ...withoutCentrelines } = outlineData;
    const html = render(<StrokeCharacter data={withoutCentrelines} view="NUMBERS" />);
    expect(html).toContain("lingop-word-detail__stroke-steps");
    expect(html).not.toContain("lingop-word-detail__stroke-figure");
  });

  it("numbers each pen stroke once in one image", () => {
    const html = render(<StrokeCharacter data={outlineData} view="NUMBERS" />);
    expect(html.match(/class="lingop-word-detail__stroke-figure"/g)).toHaveLength(1);
    expect(html).toContain('data-view="numbers"');
    expect(html.match(/lingop-stroke-label-badge/g)).toHaveLength(2);
    expect(html.match(/class="lingop-stroke-shape"/g)).toHaveLength(3);
    expect(html).toContain("2 strokes");
  });

  it("draws one arrow per pen stroke over a faded character", () => {
    const html = render(<StrokeCharacter data={outlineData} view="ARROWS" />);
    expect(html.match(/data-tone="ghost"/g)).toHaveLength(3);
    expect(html.match(/<g class="lingop-stroke-arrows"[^]*?<\/g><\/g>/)?.[0].match(/<path/g)).toHaveLength(4);
  });

  it("colours shapes and labels by stroke order", () => {
    const html = render(<StrokeCharacter data={outlineData} view="COLORS" />);
    expect(html).toContain("fill:#2563eb");
    expect(html).toContain("fill:#b91c1c");
  });

  it("animates with clipped brushes, timed by CSS custom properties", () => {
    const html = render(<StrokeCharacter data={outlineData} view="ANIMATED" />);
    expect(html.match(/<clipPath/g)).toHaveLength(3);
    expect(html.match(/class="lingop-stroke-brush"/g)).toHaveLength(3);
    expect(html).toContain("--lingop-stroke-delay:0ms");
    expect(html).toContain("Replay");
  });

  it("offers every view in a picker, starting on steps", () => {
    const html = render(<StrokeOrderView characters={[]} lang="ja" />);
    expect(html).toContain("No characters with stroke-order data were found.");
    const offered = render(<StrokeOrderView characters={["二"]} lang="cmn-hant" />);
    expect(offered).toContain('role="radiogroup" aria-label="Stroke view"');
    expect(offered.match(/role="radio"/g)).toHaveLength(5);
    expect(offered).toContain('aria-checked="true" data-selected="true">Steps');
  });
});
