import { describe, expect, it } from "vitest";

import { SpellingSystem, SpellingSystemsByLang } from "./spelling-systems.js";

describe("spelling systems", () => {
  it("retains OmniAccess's default spelling system order", () => {
    expect(SpellingSystemsByLang.ja?.[0]).toBe(SpellingSystem.JA_ROMAJI);
    expect(SpellingSystemsByLang.yue?.[0]).toBe(
      SpellingSystem.YUE_JYUTPING,
    );
    expect(SpellingSystemsByLang["cmn-hant"]?.[0]).toBe(
      SpellingSystem.CMN_PINYIN,
    );
    expect(SpellingSystemsByLang.en?.[0]).toBe(SpellingSystem.EN_WIKI);
  });

  it("retains persisted legacy enum values", () => {
    expect(SpellingSystem.YUE_IPA_SLWONG_DIACRITCS).toBe(
      "YUE_IPA_SLWONG_DIACRITICS",
    );
    expect(SpellingSystem.YUE_IPA_TONE_NUMBERS).toBe("YUE_IPA_TONE_NUMBER");
  });
});
