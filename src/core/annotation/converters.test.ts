import { describe, expect, it, vi } from "vitest";

import {
  convertAnnotatedEntryToAText,
  convertAnnotatedTextToFullGlossString,
  convertAnnotatedTextToFullPhoneticString,
  convertAnnotatedTokensToAEntry,
  convertAnnotatedTokensToAText,
  convertATokensToAEntryLangTokens,
} from "./converters.js";
import type { AnnotatedToken, AnnotationEntry } from "./types.js";

const rawAnnotationEntry: AnnotationEntry = {
  lang: "th",
  lang_text: "สวัสดีครับ",
  lang_tokens: {
    texts: ["สวัสดี", "ครับ"],
    isWordList: [1, 1],
  },
  lang_gloss: ["hello", null],
  lang_phonetics_2: [
    [
      ["sa", "sa"],
      ["wat", "wat"],
      ["di", "dee"],
    ],
    [["khrap", "khráp"]],
  ],
  ref: { source: "legacy" },
  owner_id: "owner-1",
};

describe("annotation conversions", () => {
  it("converts a raw annotation entry into frontend-friendly annotated text", () => {
    expect(convertAnnotatedEntryToAText(rawAnnotationEntry)).toEqual({
      lang: "th",
      lang_text: "สวัสดีครับ",
      tokens: [
        {
          text: "สวัสดี",
          isWord: 1,
          gloss: "hello",
          phoneticToken: [
            ["sa", "sa"],
            ["wat", "wat"],
            ["di", "dee"],
          ],
        },
        {
          text: "ครับ",
          isWord: 1,
          gloss: null,
          phoneticToken: [["khrap", "khráp"]],
        },
      ],
      containsGloss: true,
      containsPhonetics: true,
      ref: { source: "legacy" },
      owner_id: "owner-1",
    });
  });

  it("returns null and logs when raw annotation arrays have mismatched lengths", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const malformedEntry: AnnotationEntry = {
      ...rawAnnotationEntry,
      lang_gloss: ["hello"],
    };

    expect(convertAnnotatedEntryToAText(malformedEntry)).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("Malformed annotation data.");

    consoleError.mockRestore();
  });

  it("converts annotated tokens back into the raw annotation entry shape", () => {
    const tokens: AnnotatedToken[] = [
      { text: "foo", isWord: 1, gloss: "bar" },
      { text: " ", isWord: 0 },
      { text: "baz", isWord: 1, phoneticToken: [["baz", "bazz"]] },
    ];

    expect(
      convertAnnotatedTokensToAEntry({
        lang: "en",
        lang_text: "foo baz",
        tokens,
        ref: null,
        owner_id: "owner-2",
      }),
    ).toEqual({
      lang: "en",
      lang_text: "foo baz",
      lang_tokens: {
        texts: ["foo", " ", "baz"],
        isWordList: [1, 0, 1],
      },
      lang_gloss: ["bar", null, null],
      lang_phonetics_2: [null, null, [["baz", "bazz"]]],
      ref: null,
      owner_id: "owner-2",
    });
  });

  it("marks gloss and phonetic availability from explicit token fields", () => {
    const output = convertAnnotatedTokensToAText({
      lang: "en",
      lang_text: "hello",
      tokens: [{ text: "hello", isWord: 1, gloss: null }],
      ref: null,
      owner_id: null,
    });

    expect(output?.containsGloss).toBe(true);
    expect(output?.containsPhonetics).toBe(false);
  });

  it("creates full display strings for gloss and phonetics", () => {
    const annotatedText = convertAnnotatedEntryToAText(rawAnnotationEntry);

    expect(annotatedText).not.toBeNull();
    expect(convertAnnotatedTextToFullGlossString(annotatedText!)).toBe("hello ครับ");
    expect(convertAnnotatedTextToFullPhoneticString(annotatedText!)).toBe("sawatdee khráp");
  });

  it("extracts lang token arrays from annotated tokens", () => {
    expect(
      convertATokensToAEntryLangTokens([
        { text: "hi", isWord: 1 },
        { text: "!", isWord: 0 },
      ]),
    ).toEqual({
      texts: ["hi", "!"],
      isWordList: [1, 0],
    });
  });
});
