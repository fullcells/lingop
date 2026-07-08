import { describe, expect, it } from "vitest";

import {
  doesLangHaveMicrosoftVoice,
  doesLangMainScriptHaveReadingGuide,
  getLang,
  getLangCodingVarName,
  getLangName,
  getLangScript,
  isAdvocatableLang,
  isLangWordSpaced,
  langScriptsDict,
  toMixedCaseLang,
} from "./index.js";

describe("language utilities", () => {
  it("looks up languages case-insensitively", () => {
    expect(getLang("TH")?.name_english).toBe("Thai");
    expect(getLang("")).toBeUndefined();
  });

  it("gets natural, English, and translated language names", () => {
    expect(getLangName("th", "th")).toBe("แบบไทย");
    expect(getLangName("th", "en")).toBe("Thai");
    expect(getLangName("th", "ja-hiragana")).toBe("たいご");
    expect(getLangName("cmn-hant", "en")).toBe("Mandarin (Traditional Chinese)");
  });

  it("looks up scripts and word spacing", () => {
    expect(getLangScript(" thai ")?.font_label).toBe("Noto Sans Thai Looped");
    expect(langScriptsDict.Thai?.is_word_spaced).toBe(false);
    expect(isLangWordSpaced("th")).toBe(false);
    expect(isLangWordSpaced("en")).toBe(true);
  });

  it("keeps legacy helper behavior", () => {
    expect(getLangCodingVarName("cmn-Hant")).toBe("cmn_hant");
    expect(doesLangHaveMicrosoftVoice("th")).toBe(true);
    expect(toMixedCaseLang("cmn-hant")).toBe("cmn-Hant");
    expect(isAdvocatableLang("yue")).toBe(true);
    expect(doesLangMainScriptHaveReadingGuide("th")).toBe(true);
  });
});
