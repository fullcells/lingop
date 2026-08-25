import { describe, expect, it } from "vitest";

import { traditionalToSimplifiedChinese } from "./chinese-script.js";

describe("traditionalToSimplifiedChinese", () => {
  it("converts Traditional Chinese characters", async () => {
    await expect(traditionalToSimplifiedChinese("繁體中文")).resolves.toBe(
      "繁体中文",
    );
  });
});
