import { describe, expect, it } from "vitest";

import type { AnnotatedText } from "../../core/annotation/types.js";
import { formatL10nWordAsAnnotatedText } from "./l10n-word-detail-utils.js";

describe("formatL10nWordAsAnnotatedText", () => {
  it("narrows a regular annotation and supplies a raw-word morpheme", () => {
    const annotatedText: AnnotatedText = {
      lang: "ja",
      lang_text: "猫です",
      tokens: [
        { text: "猫", isWord: 1, gloss: "cat" },
        { text: "です", isWord: 1, gloss: "is" },
      ],
      containsGloss: true,
      containsPhonetics: false,
      ref: null,
      owner_id: null,
    };

    expect(formatL10nWordAsAnnotatedText(annotatedText, 0)).toEqual({
      annotatedText: {
        ...annotatedText,
        lang_text: "猫",
        tokens: [{ text: "猫", isWord: 1, gloss: "cat" }],
      },
      wordSubMorphemes: [{ morpheme: "猫", gloss: "cat" }],
    });
  });

  it("preserves root-and-pattern morphemes for the displayed word", () => {
    const annotatedText: AnnotatedText = {
      lang: "ar",
      lang_text: "كتب",
      tokens: [
        { text: "√كتب", isWord: 1, gloss: "write" },
        { text: "•••", isWord: 1, gloss: "perfect" },
      ],
      containsGloss: true,
      containsPhonetics: false,
      ref: null,
      owner_id: null,
    };

    expect(formatL10nWordAsAnnotatedText(annotatedText)).toMatchObject({
      annotatedText: {
        lang_text: "كتب",
        tokens: [{ text: "كتب", gloss: "write ⚭ perfect" }],
      },
      wordSubMorphemes: [
        { morpheme: "√كتب", gloss: "write" },
        { morpheme: "•••", gloss: "perfect" },
      ],
    });
  });
});
