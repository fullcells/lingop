import { describe, expect, it } from "vitest";
import {
  getWordExplanationsForWord,
  wordExplanationsByLang,
  wordExplanationsLookup,
} from "./word-explanations.js";

function expectNonEmptyExplanations(explanations: string[]): void {
  expect(explanations.length).toBeGreaterThan(0);
  expect(explanations.every((explanation) => explanation.trim().length > 0)).toBe(true);
}

describe("word explanations", () => {
  it("returns explanations for known words", () => {
    expectNonEmptyExplanations(getWordExplanationsForWord("ja", "食べ"));
  });

  it("indexes slash-separated variants independently", () => {
    const explanationForVariant = getWordExplanationsForWord("yue", "你哋");

    expectNonEmptyExplanations(explanationForVariant);
    expect(getWordExplanationsForWord("yue", "佢哋")).toEqual(explanationForVariant);
  });

  it("normalizes lookup casing and whitespace", () => {
    const canonicalResult = getWordExplanationsForWord("ja", "またね");

    expectNonEmptyExplanations(canonicalResult);
    expect(getWordExplanationsForWord("ja", " またね ")).toEqual(canonicalResult);
  });

  it("keeps exported raw data and lookup in sync", () => {
    expect(wordExplanationsByLang.ja?.["食べ"]).toBeDefined();
    expect(wordExplanationsLookup.ja?.["食べ"]).toEqual([
      wordExplanationsByLang.ja?.["食べ"],
    ]);
  });
});
