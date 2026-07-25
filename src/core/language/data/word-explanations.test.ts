import { describe, expect, it } from "vitest";
import {
  getWordExplanationsForWord,
  wordExplanationsByLang,
  wordExplanationsLookup,
} from "./word-explanations.js";

describe("word explanations", () => {
  it("returns explanations for exact words", () => {
    expect(getWordExplanationsForWord("ja", "食べ")).toEqual([
      "Stem of 食べる. Means “eat” and appears in compound words and polite forms.",
    ]);
  });

  it("indexes slash-separated variants independently", () => {
    expect(getWordExplanationsForWord("yue", "你哋")).toEqual([
      "When Personal Pronouns are followed by a 'classifier' or '嘅', they become possessive ('s)",
    ]);
  });

  it("normalizes lookup casing and whitespace", () => {
    expect(getWordExplanationsForWord("ja", " またね ")).toEqual([
      "Casual “see you” or “bye.” さようなら is more like “farewell” and is not used as casually.",
    ]);
  });

  it("keeps exported raw data and lookup in sync", () => {
    expect(wordExplanationsByLang.ja?.["食べ"]).toBeDefined();
    expect(wordExplanationsLookup.ja?.["食べ"]).toEqual([
      wordExplanationsByLang.ja?.["食べ"],
    ]);
  });
});
