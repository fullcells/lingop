import { describe, expect, it } from "vitest";

import { formatLingopLanguagePair } from "./language-pair.js";

describe("formatLingopLanguagePair", () => {
  it("uses Lingop's canonical abbreviated language codes", () => {
    expect(formatLingopLanguagePair("en", "ja")).toBe("EN→JA");
    expect(formatLingopLanguagePair("en", "zh-HK")).toBe("EN→YUE");
  });
});
