import { describe, expect, it } from "vitest";
import { wordExplanationsByLang } from "../core/language/data/word-explanations.js";
import { segmentSpeechText } from "./text-segments.js";

describe("embedded words in English speech", () => {
  it("uses Cantonese for Han characters, even when Mandarin uses the same script", () => {
    expect(segmentSpeechText({ text: "Contraction of 嘅呀, meaning it is so.", lang: "en", embeddedLang: "yue" })).toEqual([
      { text: "Contraction of ", lang: "en" },
      { text: "嘅呀", lang: "yue" },
      { text: ", meaning it is so.", lang: "en" },
    ]);
  });

  it("keeps mixed kanji and kana together, including kana marks and examples", () => {
    expect(segmentSpeechText({ text: "Use 〜てください with 食べる, or コーヒー.", lang: "en-US", embeddedLang: "ja" })).toEqual([
      { text: "Use ", lang: "en-US" },
      { text: "〜てください", lang: "ja" },
      { text: " with ", lang: "en-US" },
      { text: "食べる", lang: "ja" },
      { text: ", or ", lang: "en-US" },
      { text: "コーヒー.", lang: "ja" },
    ]);
  });

  it("keeps punctuation between foreign words with the foreign voice", () => {
    const text = "Examples: 兩個，兩隻，兩歲.";
    expect(segmentSpeechText({ text, lang: "en", embeddedLang: "yue" })).toEqual([
      { text: "Examples: ", lang: "en" },
      { text: "兩個，兩隻，兩歲.", lang: "yue" },
    ]);
  });

  it("handles supplementary Han and decomposed kana without losing characters", () => {
    const text = "Say 𠮷 and は\u3099.";
    const segments = segmentSpeechText({ text, lang: "en", embeddedLang: "ja" });
    expect(segments.filter(s => s.lang === "ja").map(s => s.text)).toEqual(["𠮷", "は\u3099."]);
    expect(segments.map(s => s.text).join("")).toBe(text);
  });

  it.each([
    { text: "Use 人.", lang: "en" },
    { text: "Use 人.", lang: "en", embeddedLang: "en" },
    { text: "Use 人.", lang: "fr", embeddedLang: "ja" },
    { text: "Use hola.", lang: "en", embeddedLang: "es" },
    { text: "A person.", lang: "en", embeddedLang: "ja" },
  ])("leaves ambiguous or unrequested text unchanged: $text / $embeddedLang", request => {
    expect(segmentSpeechText(request)).toEqual([{ text: request.text, lang: request.lang }]);
  });

  it("preserves every character in the current Cantonese and Japanese explanations", () => {
    for (const embeddedLang of ["ja", "yue"] as const) {
      for (const text of Object.values(wordExplanationsByLang[embeddedLang]!)) {
        const segments = segmentSpeechText({ text, lang: "en", embeddedLang });
        expect(segments.map(s => s.text).join("")).toBe(text);
        expect(segments.every(s => /[\p{L}\p{N}]/u.test(s.text))).toBe(true);
      }
    }
  });
});
