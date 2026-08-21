import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANNOTATED_TEXT_STYLE,
  type AnnotatedTextStyle,
} from "./annotated-text.js";

describe("AnnotatedTextView astyle", () => {
  it("retains the OmniAccess defaults and public field names", () => {
    const style: AnnotatedTextStyle = DEFAULT_ANNOTATED_TEXT_STYLE;

    expect(style).toEqual({
      spellingColor: "#000",
      mainTextColor: "#000",
      glossTextColor: "#000",
      glossEmojiColor: "#000",
      spellingSize: 12,
      mainTextSize: 16,
      glossTextSize: 12,
      glossEmojiSize: 12,
      wordSpacing: 3,
      spellingTextTransform: null,
      mainTextTextTransform: null,
      mainTextFontWeight: null,
      glossTextTextTransform: null,
      glossTextFontStyle: null,
      spellingFontStyle: null,
      tokenPhonicsColumnGap: null,
      tokenPhonicSpellingLineHeight: null,
      spellingOnBottom: false,
      glossPlacement: "bottom",
      glossTextAboveEmoji: false,
    });
  });
});
