export enum SpellingSystem {
  JA_HIRAGANA = "JA_HIRAGANA",
  JA_ROMAJI = "JA_ROMAJI",
  JA_KATAKANA = "JA_KATAKANA",
  YUE_JYUTPING = "YUE_JYUTPING",
  YUE_JYUTPING_DIACRITICS_TZW = "YUE_JYUTPING_DIACRITICS_TZW",
  YUE_SLWONG_ROMAN_DIACRITICS = "YUE_SLWONG_ROMAN_DIACRITICS",
  YUE_IPA = "YUE_IPA",
  YUE_IPA_SLWONG_DIACRITCS = "YUE_IPA_SLWONG_DIACRITICS",
  YUE_IPA_TONE_NUMBERS = "YUE_IPA_TONE_NUMBER",
  YUE_YALE = "YUE_YALE",
  CMN_PINYIN = "CMN_PINYIN",
  CMN_BOPOMOFO = "CMN_BOPOMOFO",
  EN_ARPABET_CMU = "EN_ARPABET_CMU",
  EN_IPA = "EN_IPA",
  EN_WIKI = "EN_WIKI",
  EN_CL_DIACRITICS = "EN_CL_DIACRITICS",
  EN_CL_DIACRITICS_BRE = "EN_CL_DIACRITICS_BRE",
  EN_CL_DIACRITICS_RP = "EN_CL_DIACRITICS_RP",
  EN_CL_DIACRITICS_SCOTLAND = "EN_CL_DIACRITICS_SCOTLAND",
  EN_CL_DIACRITICS_CARIBBEAN = "EN_CL_DIACRITICS_CARIBBEAN",
  EN_CL_DIACRITICS_LANCASTER = "EN_CL_DIACRITICS_LANCASTER",
  EN_CL_DIACRITICS_WEST_MIDLANDS = "EN_CL_DIACRITICS_WEST_MIDLANDS",
}

export const SpellingSystemsByLang: Record<string, SpellingSystem[]> = {
  // The first spelling system for each language is its default.
  ja: [
    SpellingSystem.JA_ROMAJI,
    SpellingSystem.JA_HIRAGANA,
    SpellingSystem.JA_KATAKANA,
  ],
  yue: [
    SpellingSystem.YUE_JYUTPING,
    SpellingSystem.YUE_JYUTPING_DIACRITICS_TZW,
    SpellingSystem.YUE_YALE,
    SpellingSystem.YUE_SLWONG_ROMAN_DIACRITICS,
    SpellingSystem.YUE_IPA,
    SpellingSystem.YUE_IPA_SLWONG_DIACRITCS,
    SpellingSystem.YUE_IPA_TONE_NUMBERS,
  ],
  "cmn-hant": [
    SpellingSystem.CMN_PINYIN,
    SpellingSystem.CMN_BOPOMOFO,
  ],
  en: [
    SpellingSystem.EN_WIKI,
    SpellingSystem.EN_CL_DIACRITICS,
    SpellingSystem.EN_CL_DIACRITICS_BRE,
    SpellingSystem.EN_CL_DIACRITICS_RP,
    SpellingSystem.EN_CL_DIACRITICS_SCOTLAND,
    SpellingSystem.EN_CL_DIACRITICS_CARIBBEAN,
    SpellingSystem.EN_CL_DIACRITICS_LANCASTER,
    SpellingSystem.EN_CL_DIACRITICS_WEST_MIDLANDS,
    SpellingSystem.EN_IPA,
    SpellingSystem.EN_ARPABET_CMU,
  ],
  // More languages can be added as their selectable spelling systems mature.
};
