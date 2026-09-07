import { describe, expect, it } from "vitest";

import {
  filterLanguagePickerFocusLangOptions,
  getLanguagePickerLocalizedScripts,
  sortLanguagePickerFocusLangOptions,
} from "./language-picker-gui-and-focus-utils.js";

describe("LanguagePicker_GuiAndFocus option policy", () => {
  it("excludes the GUI language when requested and sorts localized names", () => {
    expect(
      sortLanguagePickerFocusLangOptions(
        ["th", "en", "ja"],
        "en",
        true,
      ),
    ).toEqual(["ja", "th"]);
  });

  it("derives localized script labels for language variants", () => {
    expect(
      getLanguagePickerLocalizedScripts(["yue", "cmn-hans", "th"], "en"),
    ).toEqual({
      yue: "Traditional Chinese Script",
      "cmn-hans": "Simplified Chinese Script",
    });
  });

  it("searches codes and localized, natural, English, and script names", () => {
    const options = ["yue", "th", "ja"];
    const localizedScripts = getLanguagePickerLocalizedScripts(options, "en");

    expect(
      filterLanguagePickerFocusLangOptions({
        focusLangOptions: options,
        guiLang: "en",
        localizedScripts,
        searchValue: "traditional",
      }),
    ).toEqual(["yue"]);
    expect(
      filterLanguagePickerFocusLangOptions({
        focusLangOptions: options,
        guiLang: "en",
        localizedScripts,
        searchValue: "日本語",
      }),
    ).toEqual(["ja"]);
  });
});
