import { describe, expect, it } from "vitest";

import { SpellingSystem } from "../../core/language/index.js";
import {
  getSettingsVoiceLangs,
  resolvePreferredSpellingSystem,
} from "./settings-voices-n-annotations-utils.js";

describe("settings voices and annotations helpers", () => {
  it("deduplicates matching GUI and focus voice rows", () => {
    expect(
      getSettingsVoiceLangs({
        guiLang: "ja",
        focusLang: "ja",
        showGuiLangVoiceSetting: true,
      }),
    ).toEqual(["ja"]);
    expect(
      getSettingsVoiceLangs({
        guiLang: "en",
        focusLang: "ja",
        showGuiLangVoiceSetting: true,
      }),
    ).toEqual(["en", "ja"]);
  });

  it("uses a valid preferred spelling system or the first available option", () => {
    const availableSystems = [SpellingSystem.JA_ROMAJI, SpellingSystem.JA_HIRAGANA];
    expect(
      resolvePreferredSpellingSystem({
        availableSystems,
        preferredSystem: SpellingSystem.JA_HIRAGANA,
      }),
    ).toBe(SpellingSystem.JA_HIRAGANA);
    expect(
      resolvePreferredSpellingSystem({
        availableSystems,
        preferredSystem: SpellingSystem.EN_IPA,
      }),
    ).toBe(SpellingSystem.JA_ROMAJI);
  });
});
