import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AnnotatedText } from "../../core/annotation/types.js";
import { AnnotatedTextView } from "./annotated-text.js";
import { formatL10nWordAsAnnotatedText } from "./l10n-word-detail-utils.js";

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
  it("top-aligns token content while filling the annotated row's hit area", () => {
    const html = renderToStaticMarkup(
      createElement(AnnotatedTextView, {
        annotatedText,
        showGlossEmoji: "NEVER",
        showGlossText: "ALWAYS",
      }),
    );

    expect(html).toContain("align-items:flex-start");
    expect(html).toContain("align-self:stretch");
    expect(html).toContain("align-items:stretch");
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
    expect(html).toContain('class="gloss-emoji-size-reserve"');
    expect(html).toContain("visibility:hidden");
  });

  it("reserves the requested audio-action slot before voice detection resolves", () => {
    const html = renderToStaticMarkup(
      createElement(AnnotatedTextView, {
        annotatedText,
        showActionPlayAudio: true,
        actionsPlacement: "TOP",
      }),
    );

    expect(html).toContain('class="annotated-text-actions"');
    expect(html).toContain("min-height:32px");
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

describe("AnnotatedTextView word spaces", () => {
  // Stored English phrases include whitespace-only phonetic parts. Normal CSS
  // whitespace collapses those flex items to zero width, joining the words.
  const phrase: AnnotatedText = {
    lang: "en",
    lang_text: "what kind of",
    tokens: [{
      text: "what kind of",
      isWord: 1,
      gloss: "what kind of",
      phoneticToken: [["what", "whăt"], [" "], ["kind", "kînd"], [" "], ["of", "ŏf"]],
    }],
    containsGloss: true,
    containsPhonetics: true,
    ref: null,
    owner_id: null,
  };

  it.each([16, 32])("preserves phrase spaces at a main-text size of %ipx", (mainTextSize) => {
    const wordDetail = formatL10nWordAsAnnotatedText(phrase)!;
    const html = renderToStaticMarkup(createElement(AnnotatedTextView, {
      annotatedText: mainTextSize === 32 ? wordDetail.annotatedText : phrase,
      astyle: { mainTextSize },
      showGlossEmoji: "NEVER",
    }));

    expect(html.match(/class="main-text"[^>]*white-space:pre[^>]*> <\/span>/g)).toHaveLength(2);
    expect(html.match(/class="phonic-spelling"[^>]*white-space:pre[^>]*> <\/span>/g)).toHaveLength(2);
  });

  it("preserves phrase spaces in spelling-only mode", () => {
    const html = renderToStaticMarkup(createElement(AnnotatedTextView, {
      annotatedText: phrase,
      showMainText: false,
      showGlossEmoji: "NEVER",
    }));

    expect(html).not.toContain('class="main-text"');
    expect(html.match(/class="phonic-spelling"[^>]*white-space:pre[^>]*> <\/span>/g)).toHaveLength(2);
  });

  it("preserves separate space tokens without phonetics", () => {
    const html = renderToStaticMarkup(createElement(AnnotatedTextView, {
      annotatedText: {
        ...phrase,
        tokens: [{ text: "what", isWord: 1 }, { text: " ", isWord: 0 }, { text: "kind", isWord: 1 }],
        containsPhonetics: false,
        containsGloss: false,
      },
    }));

    expect(html.match(/class="main-text"[^>]*white-space:pre[^>]*> <\/span>/g)).toHaveLength(1);
  });

  it.each(["ja", "th", "unknown"])("does not infer word spaces for %s", (lang) => {
    const html = renderToStaticMarkup(createElement(AnnotatedTextView, {
      annotatedText: { ...phrase, lang },
      showGlossEmoji: "NEVER",
    }));

    expect(html).not.toContain("white-space:pre");
    expect(html).not.toContain("column-gap:");
  });
});
