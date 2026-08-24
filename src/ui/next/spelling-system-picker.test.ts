import { describe, expect, it } from "vitest";

import {
  SpellingSystem,
  SpellingSystemsByLang,
} from "../../core/language/index.js";
import {
  getSpellingSystemPickerOptions,
  getSpellingSystemSegmentOptions,
} from "./spelling-system-picker.js";

describe("SpellingSystemPicker option policy", () => {
  it("uses every configured system unless beginner options are requested", () => {
    expect(getSpellingSystemPickerOptions("yue")).toEqual(
      SpellingSystemsByLang.yue,
    );
    expect(getSpellingSystemPickerOptions("unknown")).toEqual([]);
  });

  it("retains the current language-specific beginner choices", () => {
    expect(getSpellingSystemPickerOptions("ja", true)).toEqual([
      SpellingSystem.JA_ROMAJI,
      SpellingSystem.JA_HIRAGANA,
    ]);
    expect(getSpellingSystemPickerOptions("yue", true)).toEqual([
      SpellingSystem.YUE_YALE,
      SpellingSystem.YUE_JYUTPING,
    ]);
    expect(getSpellingSystemPickerOptions("en", true)).toEqual([
      SpellingSystem.EN_WIKI,
      SpellingSystem.EN_CL_DIACRITICS,
      SpellingSystem.EN_CL_DIACRITICS_BRE,
      SpellingSystem.EN_IPA,
    ]);
  });

  it("limits the compact segment to its three representative choices", () => {
    expect(getSpellingSystemSegmentOptions("yue")).toEqual([
      SpellingSystem.YUE_JYUTPING,
      SpellingSystem.YUE_YALE,
      SpellingSystem.YUE_IPA,
    ]);
    expect(getSpellingSystemSegmentOptions("en")).toEqual([
      SpellingSystem.EN_CL_DIACRITICS,
      SpellingSystem.EN_WIKI,
      SpellingSystem.EN_IPA,
    ]);
    expect(getSpellingSystemSegmentOptions("ja")).toEqual([
      SpellingSystem.JA_ROMAJI,
      SpellingSystem.JA_HIRAGANA,
      SpellingSystem.JA_KATAKANA,
    ]);
  });
});
