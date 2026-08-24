import { describe, expect, it } from "vitest";

import { SpellingSystem } from "./spelling-systems.js";
import { getSpellingContent } from "./spelling-content.js";

describe("getSpellingContent", () => {
  it("returns a non-breaking space for a missing phonetic part", async () => {
    await expect(
      getSpellingContent("ja", null, SpellingSystem.JA_HIRAGANA, true),
    ).resolves.toBe("\u00A0");
  });

  it("formats and deduplicates Japanese spelling", async () => {
    await expect(
      getSpellingContent(
        "ja",
        ["ねこ", "ねこ"],
        SpellingSystem.JA_HIRAGANA,
        true,
      ),
    ).resolves.toBe("\u00A0");
    await expect(
      getSpellingContent(
        "ja",
        ["猫", "ねこ"],
        SpellingSystem.JA_ROMAJI,
        true,
      ),
    ).resolves.toBe("neko");
    await expect(
      getSpellingContent(
        "ja",
        ["猫", "ねこ"],
        SpellingSystem.JA_KATAKANA,
        true,
      ),
    ).resolves.toBe("ネコ");
  });

  it("selects Hakka's preferred available dialect", async () => {
    await expect(
      getSpellingContent(
        "hak",
        ["食", "海陸>shid|shidˋ:四縣>siid|siidˋ"],
        null,
        true,
      ),
    ).resolves.toBe("siid");
  });

  it("formats Cantonese and English spelling systems", async () => {
    await expect(
      getSpellingContent(
        "yue",
        ["粵", "jyut6"],
        SpellingSystem.YUE_YALE,
        true,
      ),
    ).resolves.not.toBe("jyut6");
    await expect(
      getSpellingContent(
        "en",
        ["cat", "K AE1 T"],
        SpellingSystem.EN_ARPABET_CMU,
        true,
      ),
    ).resolves.toBe("K·AE1·T");
    await expect(
      getSpellingContent(
        "en",
        ["cat", "K AE1 T"],
        SpellingSystem.EN_IPA,
        true,
      ),
    ).resolves.toBe("ˈkæt");
    await expect(
      getSpellingContent(
        "en",
        ["cat", "K AE1 T"],
        SpellingSystem.EN_WIKI,
        true,
      ),
    ).resolves.toBe("KAT");
    await expect(
      getSpellingContent(
        "en",
        ["cat", "K AE1 T"],
        SpellingSystem.EN_CL_DIACRITICS,
        true,
      ),
    ).resolves.toBe("cᷜa̭t");
  });

  it("uses external phonemizers for alternate writing systems and accents", async () => {
    await expect(
      getSpellingContent(
        "cmn-hant",
        ["漢", "hàn"],
        SpellingSystem.CMN_BOPOMOFO,
        true,
      ),
    ).resolves.toBe("ㄏㄢˋ");
    await expect(
      getSpellingContent(
        "en",
        ["cat", ""],
        SpellingSystem.EN_CL_DIACRITICS_BRE,
        true,
      ),
    ).resolves.toBe("cᷜa̭t");
  });

  it("normalizes affix spelling separators", async () => {
    await expect(
      getSpellingContent("ko", ["", "먹‿어"], null, true),
    ).resolves.toBe("먹-어");
  });
});
