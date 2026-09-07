import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AnnotatedText } from "../../core/annotation/types.js";
import { AnnotatedTextView } from "./annotated-text.js";

const annotatedText: AnnotatedText = {
  lang: "zh",
  lang_text: "你幾好？",
  tokens: [
    {
      text: "你",
      isWord: 1,
      gloss: null,
      phoneticToken: [["你", "nǐ"]],
    },
    {
      text: "幾",
      isWord: 1,
      gloss: "how many",
      phoneticToken: [["幾", "jǐ"]],
    },
    {
      text: "好",
      isWord: 1,
      gloss: null,
      phoneticToken: [["好", "hǎo"]],
    },
    { text: "？", isWord: 0, gloss: null },
  ],
  containsGloss: true,
  containsPhonetics: true,
  ref: null,
  owner_id: null,
};

describe("AnnotatedTextView row layout", () => {
  it("top-aligns token groups when only one token displays annotation rows", () => {
    const html = renderToStaticMarkup(
      createElement(AnnotatedTextView, {
        annotatedText,
        showGlossEmoji: "NEVER",
        showGlossText: "ALWAYS",
      }),
    );

    expect(html).toContain("align-items:flex-start");
    expect(html).not.toContain("align-items:flex-end");
  });

  it("spaces the main, emoji, and gloss rows by default", () => {
    const html = renderToStaticMarkup(
      createElement(AnnotatedTextView, {
        annotatedText,
        showGlossEmoji: "ALWAYS",
      }),
    );

    expect(html).toContain("gap:3px");
    expect(html).toContain('class="gloss" style="display:inline-flex');
    expect(html).toContain("gap:2px");
  });

  it.each([
    { showMainText: true, punctuationRow: "main-text" },
    { showMainText: false, punctuationRow: "phonic-spelling" },
  ])(
    "keeps punctuation at the $punctuationRow row when main-text visibility is $showMainText",
    ({ showMainText, punctuationRow }) => {
      const html = renderToStaticMarkup(
        createElement(AnnotatedTextView, {
          annotatedText,
          showGlossEmoji: "ALWAYS",
          showMainText,
        }),
      );

      // The grouped tokens may stretch to the word's full annotated height.
      // They must retain start alignment so punctuation is not pushed down
      // beside the gloss rows.
      expect(html).not.toContain("justify-content:flex-end");
      expect(html).toMatch(
        new RegExp(`class="${punctuationRow}"[^>]*>？</span>`),
      );
    },
  );
});
