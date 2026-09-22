export const SIGN_LANGUAGE_NAMES = {
  ase: "American Sign Language",
  bvl: "Bolivian Sign Language",
  csn: "Colombian Sign Language",
  fcs: "Québec Sign Language",
  jsl: "Japanese Sign Language",
  kvk: "Korean Sign Language",
  "luka-pona": "luka pona",
  prl: "Peruvian Sign Language",
  ssr: "Swiss-French Sign Language",
  tss: "Taiwan Sign Language",
  tsq: "Thai Sign Language",
} as const;

export type SignLanguageCode = keyof typeof SIGN_LANGUAGE_NAMES;

export const GLOSS_LANGUAGE_NAMES = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  ko: "Korean",
  th: "Thai",
  "cmn-hant": "Traditional Chinese",
  tok: "toki pona",
} as const;

export type GlossLanguageCode = keyof typeof GLOSS_LANGUAGE_NAMES;

// Gloss languages currently available for each SignWords collection. Keep
// generated or machine-translated coverage here only once it is usable by
// consuming products.
export const SIGN_LANGUAGE_GLOSS_LANGUAGES = {
  ase: ["en", "es", "th"],
  bvl: ["es", "en"],
  csn: ["es", "ko"],
  fcs: ["fr"],
  jsl: ["ja"],
  kvk: ["ko", "ja", "en"],
  "luka-pona": ["en", "tok"],
  prl: ["es"],
  ssr: ["fr"],
  tss: ["en", "cmn-hant"],
  tsq: ["th", "en"],
} as const satisfies Record<SignLanguageCode, readonly GlossLanguageCode[]>;

export type SignLanguageSupplementaryLexiconSource = {
  code: SignLanguageCode;
  weight: number;
};

// Directional product relationships for supplementing smaller SignWords
// collections. They are not claims of reciprocal linguistic kinship.
export const SIGN_LANGUAGE_SUPPLEMENTARY_LEXICON_SOURCES = {
  bvl: [{ code: "ase", weight: 1 }],
  jsl: [{ code: "kvk", weight: 1 }],
  tsq: [{ code: "ase", weight: 1 }],
} as const satisfies Partial<
  Record<SignLanguageCode, readonly SignLanguageSupplementaryLexiconSource[]>
>;
