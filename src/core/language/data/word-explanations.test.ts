import { describe, expect, it } from "vitest";
import {
  getWordExplanationsForWord,
  wordExplanationsByLang,
  wordExplanationsLookup,
} from "./word-explanations.js";

describe("word explanations", () => {
  it("returns explanations for exact words", () => {
    expect(getWordExplanationsForWord("ja", "食べ")).toEqual([
      "'eat'. 食べ is the universal stem of the verb 食べる.",
    ]);
  });

  it("indexes slash-separated variants independently", () => {
    expect(getWordExplanationsForWord("yue", "你哋")).toEqual([
      "When Personal Pronouns are followed by a 'classifier' or '嘅', they become possessive ('s)",
    ]);
  });

  it("normalizes lookup casing and whitespace", () => {
    expect(getWordExplanationsForWord("ja", " またね ")).toEqual([
      "“goodbye” (casual) - Alt: さようなら (“farewell”) (rarely used for “goodbye”)",
    ]);
  });

  it("keeps exported raw data and lookup in sync", () => {
    expect(wordExplanationsByLang.ja?.["食べ"]).toBeDefined();
    expect(wordExplanationsLookup.ja?.["食べ"]).toEqual([
      wordExplanationsByLang.ja?.["食べ"],
    ]);
  });
});
