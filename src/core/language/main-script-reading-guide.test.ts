import { describe, expect, it } from "vitest";

import { getMainScriptReadingGuidePart } from "./main-script-reading-guide.js";

describe("getMainScriptReadingGuidePart", () => {
  it("ports local main-script conversions from OmniAccess", async () => {
    await expect(getMainScriptReadingGuidePart("el", "γεια")).resolves.toEqual([
      "γεια",
      "gia",
    ]);
    await expect(getMainScriptReadingGuidePart("ko", "한국")).resolves.toEqual([
      "한국",
      "hangug",
    ]);
    await expect(getMainScriptReadingGuidePart("th", "ไทย")).resolves.toEqual([
      "ไทย",
      "thai",
    ]);
    await expect(getMainScriptReadingGuidePart("tok", "pona")).resolves.toEqual([
      "pona",
      "pona",
    ]);
    await expect(
      getMainScriptReadingGuidePart("arz", "مرحبا"),
    ).resolves.toEqual(["مرحبا", "abḥrm"]);

    const sinhalaGuide = await getMainScriptReadingGuidePart("si", "සිංහල");
    expect(sinhalaGuide?.[0]).toBe("සිංහල");
    expect(sinhalaGuide?.[1]).toBeTruthy();
  });

  it("returns null for languages without a local reading guide", async () => {
    await expect(getMainScriptReadingGuidePart("en", "hello")).resolves.toBeNull();
  });
});
