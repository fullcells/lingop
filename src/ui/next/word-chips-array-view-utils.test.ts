import { describe, expect, it } from "vitest";

import {
  buildCanonicalWordCaseMap,
  resolveWordDisplayCase,
} from "./word-chips-array-view-utils.js";

describe("WordChipsArrayView casing", () => {
  it("indexes canonical cases by uppercase word and prefers lowercase duplicates", () => {
    expect(
      buildCanonicalWordCaseMap([
        { word: "APPLE" },
        { word: "apple" },
        { word: "I" },
      ]),
    ).toEqual({ APPLE: "apple", I: "I" });
  });

  it("uses canonical cases only for case-sensitive scripts", () => {
    const canonicalWordCases = { APPLE: "Apple" };

    expect(
      resolveWordDisplayCase({
        word: "APPLE",
        isLangCaseSensitive: true,
        canonicalWordCases,
      }),
    ).toBe("Apple");
    expect(
      resolveWordDisplayCase({
        word: "かな",
        isLangCaseSensitive: false,
        canonicalWordCases: null,
      }),
    ).toBe("かな");
  });
});
