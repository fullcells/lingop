import { describe, expect, it } from "vitest";
import {
  getPrebakedLangPairKey,
  lookupPrebakedTranslation,
} from "./runtime.js";

describe("prebake runtime", () => {
  it("normalizes language-pair keys and falls back to source text", () => {
    expect(getPrebakedLangPairKey("EN", "ES")).toBe("en-to-es");
    expect(
      lookupPrebakedTranslation({
        sourceText: "Animals",
        sourceLang: "en",
        targetLang: "es",
        translationsByLangPair: {
          "en-to-es": { Animals: "Animales" },
        },
      }),
    ).toBe("Animales");
    expect(
      lookupPrebakedTranslation({
        sourceText: "Missing",
        sourceLang: "en",
        targetLang: "es",
        translationsByLangPair: { "en-to-es": {} },
      }),
    ).toBe("Missing");
    expect(
      lookupPrebakedTranslation({
        sourceText: "Loading",
        sourceLang: "en",
        targetLang: "fr",
        translationsByLangPair: {},
      }),
    ).toBeUndefined();
  });
});
