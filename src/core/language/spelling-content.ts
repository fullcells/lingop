import type { PhoneticPart } from "../annotation/types.js";
import {
  convertCantoJyutpingToSLWongRomanizedDiacritics,
  convertCantoJyutpingToTZWDiacritic,
  convertCantoJyutpingToYale,
  ilike,
} from "../misc.js";
import { arpabetToIPA } from "./arpabet-to-ipa.js";
import { jyutpingToIPA } from "./canto-jyutping-to-ipa.js";
import { ipaToEnWikiRespelling } from "./ipa-to-en-wiki.js";
import { SpellingSystem } from "./spelling-systems.js";
import { wordNIpaToCLDiacritics } from "./word-and-ipa-to-cl-diacritics.js";

const EMPTY_SPACE = "\u00A0";

/**
 * Formats one backend phonetic part for the user's selected spelling system.
 *
 * This preserves OmniAccess's existing spelling output while making the
 * conversion reusable by shared and consumer-owned annotated-text views.
 */
export async function getSpellingContent(
  lang: string,
  phoneticPart: PhoneticPart | null,
  spellingSystem: SpellingSystem | null,
  showMainText: boolean,
): Promise<string> {
  if (!phoneticPart) return EMPTY_SPACE;

  const phoneticPartChars = phoneticPart[0] || "";
  let phoneticPartSpelling = phoneticPart[1] || "";

  // YUE:
  if (ilike("yue", lang)) {
    // Backend default is Jyutping.
    // Tone-number superscripting may be added as another spelling-system option.
    if (spellingSystem === SpellingSystem.YUE_JYUTPING_DIACRITICS_TZW) {
      phoneticPartSpelling =
        convertCantoJyutpingToTZWDiacritic(phoneticPartSpelling);
    }
    if (spellingSystem === SpellingSystem.YUE_SLWONG_ROMAN_DIACRITICS) {
      phoneticPartSpelling =
        convertCantoJyutpingToSLWongRomanizedDiacritics(phoneticPartSpelling);
    }
    if (spellingSystem === SpellingSystem.YUE_IPA) {
      phoneticPartSpelling = jyutpingToIPA(phoneticPartSpelling);
    }
    if (spellingSystem === SpellingSystem.YUE_IPA_SLWONG_DIACRITCS) {
      phoneticPartSpelling = jyutpingToIPA(phoneticPartSpelling, "slwong");
    }
    if (spellingSystem === SpellingSystem.YUE_IPA_TONE_NUMBERS) {
      phoneticPartSpelling = jyutpingToIPA(phoneticPartSpelling, "numbers");
    }
    if (spellingSystem === SpellingSystem.YUE_YALE) {
      phoneticPartSpelling = convertCantoJyutpingToYale(phoneticPartSpelling);
    }
  }

  // JA:
  if (ilike("ja", lang)) {
    // Backend default is Hiragana.
    if (
      spellingSystem === SpellingSystem.JA_HIRAGANA &&
      phoneticPartSpelling === phoneticPartChars &&
      phoneticPartChars !== "ー" && // Reflect Katakana "ー" in Hiragana too.
      showMainText // Only dedupe when main text is visible.
    ) {
      phoneticPartSpelling = EMPTY_SPACE;
    }
    if (spellingSystem === SpellingSystem.JA_ROMAJI) {
      const { toRomaji } = await import("wanakana");
      phoneticPartSpelling = toRomaji(phoneticPartSpelling);
      if (!phoneticPartSpelling) phoneticPartSpelling = "–";
    }
    if (spellingSystem === SpellingSystem.JA_KATAKANA) {
      const { toKatakana } = await import("wanakana");
      phoneticPartSpelling = toKatakana(phoneticPartSpelling);
    }
  }

  // HAK
  if (ilike("hak", lang) && phoneticPartSpelling) {
    const dialectSpellings: Record<string, string[]> = {};
    for (const dialectPart of phoneticPartSpelling.split(":")) {
      const separatorIndex = dialectPart.indexOf(">");
      if (separatorIndex < 0) continue;
      const dialect = dialectPart.slice(0, separatorIndex);
      const spellings = dialectPart.slice(separatorIndex + 1).split("|");
      if (dialect) dialectSpellings[dialect] = spellings;
    }

    // Defaulting to Sixian as preferred default Dialect atm. (in future allow
    // toggle to Hailu (海陸)); ordered by most similar-sounding to "四縣".
    const firstDialect = Object.keys(dialectSpellings)[0];
    const preferredDialectSpellings =
      dialectSpellings["四縣"] ??
      dialectSpellings["大埔"] ??
      dialectSpellings["海陸"] ??
      dialectSpellings["饒平"] ??
      dialectSpellings["詔安"] ??
      (firstDialect ? dialectSpellings[firstDialect] : undefined) ??
      [phoneticPartSpelling];
    // Just using the first spelling for the selected dialect atm.
    phoneticPartSpelling =
      preferredDialectSpellings[0] ?? phoneticPartSpelling;
  }

  // CMN
  if (
    lang.startsWith("cmn-") &&
    spellingSystem === SpellingSystem.CMN_BOPOMOFO
  ) {
    // Backend default is Pinyin.
    const { pinyinToZhuyin } = await import("pinyin-zhuyin");
    phoneticPartSpelling = pinyinToZhuyin(phoneticPartSpelling);
  }

  // EN
  if (ilike(lang, "en")) {
    // ARPABET - RAW DATA
    if (spellingSystem === SpellingSystem.EN_ARPABET_CMU) {
      // Tidy up display.
      phoneticPartSpelling = phoneticPartSpelling.replaceAll(" ", "·");
    }

    // IPA-BASED FORMATS (ESPEAK) (Local Computation)
    if (spellingSystem?.startsWith("EN_CL_DIACRITICS_")) {
      const { phonemize } = await import("phonemizer");
      const enWord = phoneticPartChars;
      const espeakMap: Partial<Record<SpellingSystem, string>> = {
        [SpellingSystem.EN_CL_DIACRITICS_BRE]: "en-gb",
        [SpellingSystem.EN_CL_DIACRITICS_RP]: "en-gb-x-rp",
        [SpellingSystem.EN_CL_DIACRITICS_SCOTLAND]: "en-gb-scotland",
        [SpellingSystem.EN_CL_DIACRITICS_CARIBBEAN]: "en-029",
        [SpellingSystem.EN_CL_DIACRITICS_LANCASTER]: "en-gb-x-gbclan",
        [SpellingSystem.EN_CL_DIACRITICS_WEST_MIDLANDS]: "en-gb-x-gbcwmd",
      };
      const espeakLangCode = espeakMap[spellingSystem];
      const phonemizeResult = await phonemize(enWord, espeakLangCode);
      let ipa = phonemizeResult[0] ?? "";
      // IPA Override for ESpeak:
      if (enWord.toLowerCase() === "a") ipa = "ə"; // It's this 90% of the time, rather than /eɪ/.
      phoneticPartSpelling = wordNIpaToCLDiacritics(enWord, ipa);
    }

    // ARPABET => IPA-BASED FORMATS
    if (
      spellingSystem &&
      [
        SpellingSystem.EN_IPA,
        SpellingSystem.EN_WIKI,
        SpellingSystem.EN_CL_DIACRITICS,
      ].includes(spellingSystem)
    ) {
      const parts = phoneticPartSpelling.split("/");
      const result: string[] = [];
      for (const part of parts) {
        // CONVERSION FROM ARPABET (Arpabet (CMU,USA) stored in spelling)
        // i. IPA Conversion
        let optionFormatted = arpabetToIPA(part, {
          reduceAh0ToSchwa: true,
        });
        // ii. EN_WIKI Format
        if (spellingSystem === SpellingSystem.EN_WIKI) {
          optionFormatted = ipaToEnWikiRespelling(optionFormatted);
        }
        // iii. ipaToCLDiacritics
        if (spellingSystem === SpellingSystem.EN_CL_DIACRITICS) {
          optionFormatted = wordNIpaToCLDiacritics(
            phoneticPartChars,
            optionFormatted,
          );
        }
        result.push(optionFormatted);
      }
      phoneticPartSpelling = result.join("/");
    }

    // Display only one option (may toggle this in future).
    phoneticPartSpelling = phoneticPartSpelling.split("/")[0] ?? "";
  }

  // ----------------------------------------------------------------
  // AFFIX SPELLINGS (e.g. KO)
  phoneticPartSpelling = phoneticPartSpelling.replaceAll("‿", "-");

  return phoneticPartSpelling;
}
