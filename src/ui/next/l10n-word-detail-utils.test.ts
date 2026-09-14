import { describe, expect, it, vi } from "vitest";

import type { AnnotatedText } from "../../core/annotation/types.js";
import {
  DEFAULT_YUE_WORD_DETAIL_TAB,
  formatL10nWordAsAnnotatedText,
  formatHancharReadings,
  getUniqueHanCharacters,
  readYueWordDetailTab,
  splitReadingByNativeSpelling,
  supportsHancharComponents,
  writeYueWordDetailTab,
  YUE_WORD_DETAIL_TAB_STORAGE_KEY,
} from "./l10n-word-detail-utils.js";

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

describe("Han-character word details", () => {
  it("enables components only for the requested languages", () => {
    expect(supportsHancharComponents("ja")).toBe(true);
    expect(supportsHancharComponents("YUE")).toBe(true);
    expect(supportsHancharComponents("cmn-hant")).toBe(true);
    expect(supportsHancharComponents("cmn-hans")).toBe(false);
    expect(supportsHancharComponents("ko")).toBe(false);
  });

  it("extracts unique Han characters in display order", () => {
    expect(getUniqueHanCharacters("日本語かな語，𠄘")).toEqual([
      "日",
      "本",
      "語",
      "𠄘",
    ]);
  });

  it("formats unique component readings for the selected language", () => {
    const readings = [
      { lang: "ja", reading: "ご", readingType: "on", source: null },
      { lang: "JA", reading: "われ", readingType: "kun", source: null },
      { lang: "ja", reading: "ご", readingType: "on", source: null },
      { lang: "yue", reading: "ng4", readingType: "jyutping", source: null },
    ];
    expect(formatHancharReadings(readings, "ja")).toBe("ご・われ");
    expect(formatHancharReadings(readings, "yue")).toBe("ng4");
    expect(formatHancharReadings(readings, "cmn-hant")).toBeNull();
  });

  it("marks the meaningful spelling shared by a phonetic component", () => {
    expect(splitReadingByNativeSpelling("geoi6", "keoi5")).toEqual([
      { text: "g", sharedWithNativeSpelling: false },
      { text: "eoi", sharedWithNativeSpelling: true },
      { text: "6", sharedWithNativeSpelling: false },
    ]);
    expect(splitReadingByNativeSpelling("ng4", "keoi5")).toEqual([
      { text: "ng4", sharedWithNativeSpelling: false },
    ]);
  });

  it("defaults and persists the Cantonese character-detail tab", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    try {
      expect(readYueWordDetailTab()).toBe(DEFAULT_YUE_WORD_DETAIL_TAB);
      writeYueWordDetailTab("SIMPLE_SCRIPT");
      expect(values.get(YUE_WORD_DETAIL_TAB_STORAGE_KEY)).toBe("SIMPLE_SCRIPT");
      expect(readYueWordDetailTab()).toBe("SIMPLE_SCRIPT");
      values.set(YUE_WORD_DETAIL_TAB_STORAGE_KEY, "UNKNOWN");
      expect(readYueWordDetailTab()).toBe(DEFAULT_YUE_WORD_DETAIL_TAB);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
