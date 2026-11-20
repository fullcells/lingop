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
    const html = render(
      <StrokeCharacterDiagram
        data={{
          character: "あ",
          source: "ANIMCJK_JA",
          strokes: ["M1 1L9 1", "M5 1L5 9", "M1 5L9 9", "M9 9L1 5"],
          viewBox: "0 0 10 10",
          pathKind: "OUTLINE",
          continuations: [3],
        }}
      />,
    );
    expect(html).toContain("3 strokes");
  });

  it("falls back to the step diagram when centrelines are missing", () => {
    const { centrelines: _, ...withoutCentrelines } = outlineData;
    const html = render(<StrokeCharacter data={withoutCentrelines} view="NUMBERS" />);
    expect(html).toContain("lingop-word-detail__stroke-steps");
  });

  it.each(["NUMBERS", "ARROWS", "COLORS", "ANIMATED"] as const)(
    "renders the %s view as one figure",
    (view) => {
      const html = render(<StrokeCharacter data={outlineData} view={view} />);
      expect(html).toContain(`data-view="${view.toLowerCase()}"`);
      expect(html).toContain("2 strokes");
    },
  );

  it("offers a stroke-view picker", () => {
    const html = render(<StrokeOrderView characters={["二"]} lang="cmn-hant" />);
    expect(html).toContain('aria-label="Stroke view"');
  });
});
