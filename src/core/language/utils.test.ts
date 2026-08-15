import { describe, expect, it } from "vitest";

import {
  doesLangHaveMicrosoftVoice,
  doesLangMainScriptHaveReadingGuide,
  estimateNumWords,
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

  it("resolves backend-compatible language aliases", () => {
    expect(getLang("zh-CN")?.gcode_main).toBe("cmn-hans");
    expect(getLang("zh-TW")?.gcode_main).toBe("cmn-hant");
    expect(getLang("zh-HK")?.gcode_main).toBe("yue");
    expect(getLang("zh-Hant")?.gcode_main).toBe("cmn-hant");
    expect(getLang("zh-Hans")?.gcode_main).toBe("cmn-hans");
    expect(getLang("ar-EG")?.gcode_main).toBe("arz");
    expect(getLang("ar-MA")?.gcode_main).toBe("ary");
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

  it("estimates word counts for spaced and non-spaced languages", () => {
    expect(estimateNumWords({ lang: "en", text: "one two three" })).toBe(3);
    expect(estimateNumWords({ lang: "ja", text: "日本語です" })).toBe(2);
    expect(estimateNumWords({ lang: "zh-CN", text: "中文测试" })).toBe(1.6);
  });
});
