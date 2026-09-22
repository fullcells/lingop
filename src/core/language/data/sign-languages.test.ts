import { describe, expect, it } from "vitest";

import {
  GLOSS_LANGUAGE_NAMES,
  SIGN_LANGUAGE_GLOSS_LANGUAGES,
  SIGN_LANGUAGE_NAMES,
  SIGN_LANGUAGE_SUPPLEMENTARY_LEXICON_SOURCES,
} from "./sign-languages.js";

describe("sign language data", () => {
  it("defines every available gloss language", () => {
    for (const glossLanguages of Object.values(SIGN_LANGUAGE_GLOSS_LANGUAGES)) {
      for (const glossLanguage of glossLanguages) {
        expect(GLOSS_LANGUAGE_NAMES[glossLanguage]).toBeTruthy();
      }
    }
  });

  it("keeps supplementary lexicon sources directional and valid", () => {
    expect(SIGN_LANGUAGE_SUPPLEMENTARY_LEXICON_SOURCES.jsl).toEqual([
      { code: "kvk", weight: 1 },
    ]);
    expect(SIGN_LANGUAGE_SUPPLEMENTARY_LEXICON_SOURCES.kvk).toBeUndefined();

    for (const [target, sources] of Object.entries(
      SIGN_LANGUAGE_SUPPLEMENTARY_LEXICON_SOURCES,
    )) {
      expect(SIGN_LANGUAGE_NAMES[target as keyof typeof SIGN_LANGUAGE_NAMES]).toBeTruthy();
      for (const source of sources) {
        expect(SIGN_LANGUAGE_NAMES[source.code]).toBeTruthy();
        expect(source.code).not.toBe(target);
        expect(source.weight).toBeGreaterThan(0);
      }
    }
  });
});
