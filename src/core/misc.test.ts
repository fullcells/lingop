import { describe, expect, it } from "vitest";

import {
  contentRefFromLocalization,
  convertCantoJyutpingToSLWongRomanizedDiacritics,
  convertCantoJyutpingToTZWDiacritic,
  convertCantoJyutpingToYale,
  getLocalePrice,
  isLocalizationDefinitelyFromPublicSource,
  isSourceContentDefinitelyPublic,
  replaceAllCurlyTexts,
  replaceCurliesWithPrettyLang,
  stripDisambiguatorFromToken,
  toCleanFilename,
} from "./misc.js";
import type { AnnotatedToken } from "./annotation/types.js";

describe("misc utilities", () => {
  it("replaces curly placeholders with plain or localized language text", () => {
    expect(replaceAllCurlyTexts("Learn {lang} now", "Thai")).toBe("Learn Thai now");
    expect(replaceAllCurlyTexts("Learn ｛lang｝ now", "Thai")).toBe("Learn Thai now");
    expect(replaceCurliesWithPrettyLang("Learn {lang}", "cmn-Hant", "en")).toBe(
      "Learn Mandarin",
    );
  });

  it("gets locale prices from explicit timezone or locale inputs", () => {
    expect(getLocalePrice({ timeZone: "Asia/Hong_Kong" }).currencyAbbrev).toBe("HKD");
    expect(getLocalePrice({ timeZone: "America/Toronto" }).currencyAbbrev).toBe("CAD");
    expect(getLocalePrice({ timeZone: "Pacific/Auckland" }).currencyAbbrev).toBe("NZD");
    expect(getLocalePrice({ timeZone: "UTC", locale: "fr-FR" }).cost).toBe("€8");
  });

  it("keeps legacy formatting helpers", () => {
    expect(toCleanFilename("Olá, World.txt", 12)).toBe("ola--world-t");
  });

  it("converts Cantonese Jyutping into display romanizations", () => {
    expect(convertCantoJyutpingToTZWDiacritic("ngo5")).toBe("ngo̗");
    expect(convertCantoJyutpingToSLWongRomanizedDiacritics("zeoi3")).toBe("¯dzeue");
    expect(convertCantoJyutpingToYale("nei5 hou2")).toBe("néih hóu");
  });

  it("strips parenthesized disambiguators from annotated tokens", () => {
    const token: AnnotatedToken = {
      text: "orange (color)",
      isWord: 1,
      gloss: "orange (color)",
      phoneticToken: [
        ["orange", "AO1 R IH0 N JH"],
        ["color", "K AH1 L ER0"],
      ],
    };

    expect(stripDisambiguatorFromToken(token)).toEqual({
      text: "orange",
      isWord: 1,
      gloss: "orange",
      phoneticToken: [["orange", "AO1 R IH0 N JH"]],
    });
  });

  it("returns content references from localization data", () => {
    expect(
      contentRefFromLocalization({
        text: "สวัสดี",
        translationRow: { id: 42 },
        l10n_lang: "th",
        sourceContent: {
          owner_id: null,
          lang: "en",
          text: "hello",
          ref: { file: "lingodex" },
        },
      }),
    ).toEqual({ db: { table: "translations", column: "target_text", id: 42 } });

    expect(
      contentRefFromLocalization({
        text: "สวัสดี",
        translationRow: { id: 43 },
        l10n_lang: "th",
        sourceContent: {
          owner_id: null,
          lang: "en",
          text: "hello",
          ref: {
            db: {
              table: "documents",
              column: "body",
              id: 7,
              line_idx: 4,
              seg_idx: 1,
            },
          },
        },
      }),
    ).toEqual({
      db: {
        table: "translations",
        column: "target_text",
        id: 43,
        line_idx: 4,
        seg_idx: 1,
      },
    });

    expect(
      contentRefFromLocalization({
        text: "hello",
        l10n_lang: "en",
        sourceContent: {
          owner_id: null,
          lang: "EN",
          text: "hello",
          ref: { file: "lingodex" },
        },
      }),
    ).toEqual({ file: "lingodex" });
  });

  it("detects definitely public source content", () => {
    expect(
      isSourceContentDefinitelyPublic({
        owner_id: null,
        lang: "en",
        text: "cat",
        ref: { file: "lingodex" },
      }),
    ).toBe(true);
    expect(
      isSourceContentDefinitelyPublic({
        owner_id: null,
        lang: "en",
        text: "cat",
        ref: { db: { table: "words", column: "text", id: 1 } },
      }),
    ).toBe(true);
    expect(
      isSourceContentDefinitelyPublic({
        owner_id: null,
        lang: "en",
        text: "cat",
        ref: { db: { table: "private", column: "text", id: 1 } },
      }),
    ).toBe(false);
    expect(
      isLocalizationDefinitelyFromPublicSource({
        text: "cat",
        l10n_lang: "en",
        sourceContent: {
          owner_id: null,
          lang: "en",
          text: "cat",
          ref: { db: { table: "homographs", column: "text", id: 1 } },
        },
      }),
    ).toBe(true);
  });
});
