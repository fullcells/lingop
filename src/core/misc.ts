import type { AnnotatedToken } from "./annotation/types.js";
import { getLangName } from "./language/utils.js";
import type { TranslationRow } from "./translation/types.js";

export type ReferenceDB = {
  db: {
    table: string;
    column: string;
    id: number;
    // Optional segment coordinates narrow a document-level DB row to a
    // LocalizationSegment. Omit them for refs that target the whole row/doc.
    line_idx?: number;
    seg_idx?: number;
  };
};

export type ReferenceableFile = "lingodex" | "cl_learn_cefr" | "OAT" | "WORDS";

export type ReferenceFile = {
  file: ReferenceableFile;
};

export type ContentReference = ReferenceDB | ReferenceFile;

export type BaseContent = {
  owner_id: string | null;
  lang: string;
  text: string;
  ref: ContentReference;
};

export type SourceContent = BaseContent;

export type Localization = {
  text: string;
  l10n_lang: string;
  // `Localization` represents the returned document/string. Some callers pass
  // a segment-sized localization by carrying line_idx/seg_idx in
  // sourceContent.ref.db; helpers that derive annotation refs must preserve
  // those coordinates so the subset remains addressable.
  sourceContent: SourceContent;
  translationRow?: TranslationRow | null;
};

type LocalePrice = {
  cost: string;
  currencyAbbrev: string;
  link: string;
};

type RegionCode = "US" | "AU" | "NZ" | "GB" | "CA" | "SG" | "HK" | "JP" | "EU";

export type LocalePriceOptions = {
  locale?: string;
  timeZone?: string;
};

const REGION_PRICES: Record<RegionCode, LocalePrice> = {
  US: {
    cost: "$8",
    currencyAbbrev: "USD",
    link: "https://buy.stripe.com/28EbJ1gvE8e28Iw5F4eQM0b",
  },
  AU: {
    cost: "$15",
    currencyAbbrev: "AUD",
    link: "https://buy.stripe.com/9B6fZhfrAbqe6Ao3wWeQM08",
  },
  NZ: {
    cost: "$17",
    currencyAbbrev: "NZD",
    link: "https://buy.stripe.com/aFacN51AK1PE8Iw7NceQM07",
  },
  GB: {
    cost: "£8",
    currencyAbbrev: "",
    link: "https://buy.stripe.com/6oU8wP93cama0c00kKeQM06",
  },
  CA: {
    cost: "$13",
    currencyAbbrev: "CAD",
    link: "https://buy.stripe.com/8x25kD4MW2TI2k89VkeQM05",
  },
  SG: {
    cost: "$15",
    currencyAbbrev: "SGD",
    link: "https://buy.stripe.com/dRm7sL4MW8e26AogjIeQM04",
  },
  HK: {
    cost: "$80",
    currencyAbbrev: "HKD",
    link: "https://buy.stripe.com/28EdR9frAfGu5wkd7weQM03",
  },
  JP: {
    cost: "¥888",
    currencyAbbrev: "JPY",
    link: "https://buy.stripe.com/7sYeVd6V43XMbUI2sSeQM09",
  },
  EU: {
    cost: "€8",
    currencyAbbrev: "",
    link: "https://buy.stripe.com/00wdR90wGama6AoebAeQM0a",
  },
};

const CANADIAN_TIMEZONE_LOCATIONS = new Set([
  "TORONTO",
  "VANCOUVER",
  "EDMONTON",
  "WINNIPEG",
  "HALIFAX",
  "ST_JOHNS",
  "REGINA",
  "WHITEHORSE",
  "YELLOWKNIFE",
  "IQALUIT",
  "RANKIN_INLET",
  "RESOLUTE",
  "GLACE_BAY",
  "GOOSE_BAY",
  "MONCTON",
  "SWIFT_CURRENT",
  "PANGNIRTUNG",
  "INUVIK",
  "CRESTON",
  "DAWSON",
  "DAWSON_CREEK",
  "FORT_NELSON",
  "CAMBRIDGE_BAY",
  "ATIKOKAN",
  "THUNDER_BAY",
  "NIPIGON",
  "RAINY_RIVER",
]);

const EURO_LANGUAGE_CODES = new Set([
  "de",
  "nl",
  "fr",
  "hr",
  "el",
  "et",
  "fi",
  "it",
  "lv",
  "lt",
  "lb",
  "mt",
  "sk",
  "sl",
  "pt",
]);

export function replaceAllCurlyTexts(
  originalText: string,
  replacementText: string,
): string {
  const openBrackets = "[{｛﹛❴]";
  const closeBrackets = "[}｝﹜❵]";
  return originalText.replace(
    new RegExp(`${openBrackets}[^}｝﹜❵]*${closeBrackets}`, "g"),
    replacementText,
  );
}

export function replaceCurliesWithPrettyLang(
  originalText: string,
  focusLang: string,
  guiLang: string,
): string {
  let langName = "";
  if (focusLang) {
    langName = getLangName(focusLang, guiLang) ?? `(${focusLang.toUpperCase()})`;
  }
  langName = removeBracketedContent(langName);

  return replaceAllCurlyTexts(originalText, langName);
}

export function getLocalePrice(options: LocalePriceOptions = {}): LocalePrice {
  return REGION_PRICES[guessUserRegion(options)];
}

export function prettyPrintCreditsAmount(amount: number): string {
  return Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function toCleanFilename(input: string, len: number): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, "_")
    .replace(/[\s.,。，,]/g, "_")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .slice(0, len)
    .toLowerCase();
}

export const STANDARD_AUDIO_TEXT_REPLACEMENTS = {
  SQUARE_BRACKETS: { label: "[squareBrackets]", pattern: "\\[.*?\\]" },
  CURLY_BRACKETS: { label: "{curlyBrackets}", pattern: "\\{.*?\\}" },
  XML_TAGS: { label: "<XMLTags>", pattern: "<[^>]+>" },
  UNDERSCORE_PREFIX: { label: "_underscorePrefix", pattern: "\\b_\\w+\\b" },
  DOLLAR_PREFIX: { label: "$dollarPrefix", pattern: "\\$\\w+\\b" },
} as const;

export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
  );
}

export function ilike(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

export function removeBracketedContent(text: string | null | undefined): string {
  if (text === undefined || text === null) return "...";
  return text.replace(/(\(.*?\)|（.*?）)/g, "").trim();
}

export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (
      !deepEqual(
        (obj1 as Record<string, unknown>)[key],
        (obj2 as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }

  return true;
}

export function contentRefFromLocalization(
  l10n: Localization | null | undefined,
): ContentReference | null {
  if (!l10n) return null;
  if (l10n.translationRow) {
    const sourceDbRef = "db" in l10n.sourceContent.ref ? l10n.sourceContent.ref.db : null;
    return {
      db: {
        table: "translations",
        column: "target_text",
        id: l10n.translationRow.id,
        ...(sourceDbRef?.line_idx === undefined ? {} : { line_idx: sourceDbRef.line_idx }),
        ...(sourceDbRef?.seg_idx === undefined ? {} : { seg_idx: sourceDbRef.seg_idx }),
      },
    };
  }
  if (!l10n.translationRow && ilike(l10n.l10n_lang, l10n.sourceContent.lang)) {
    return l10n.sourceContent.ref;
  }
  return null;
}

export function convertCantoJyutpingToTZWDiacritic(jyutping: string): string {
  const vowels = "aeiouAEIOU";
  const cantoneseJyutpingAccentMarks: Record<string, string[]> = {
    a: ["ā", "á", "a", "a̖", "a̗", "a̱"],
    e: ["ē", "é", "e", "e̖", "e̗", "e̱"],
    i: ["ī", "í", "i", "i̖", "i̗", "i̱"],
    o: ["ō", "ó", "o", "o̖", "o̗", "o̱"],
    u: ["ū", "ú", "u", "u̖", "u̗", "u̱"],
    A: ["Ā", "Á", "A", "A̖", "A̗", "A̱"],
    E: ["Ē", "É", "E", "E̖", "E̗", "E̱"],
    I: ["Ī", "Í", "I", "I̖", "I̗", "I̱"],
    O: ["Ō", "Ó", "O", "O̖", "O̗", "O̱"],
    U: ["Ū", "Ú", "U", "U̖", "U̗", "U̱"],
  };

  if (jyutping === "m4") return "m̖";
  if (jyutping === "M4") return "M̖";

  const numberStr = jyutping.replace(/\D/g, "");
  const number = parseInt(numberStr, 10);
  if (Number.isNaN(number) || number > 6) return jyutping;

  const firstVowel = Array.from(jyutping).find((char) => vowels.includes(char));
  if (!firstVowel) return jyutping;

  const firstVowelDiacritic = cantoneseJyutpingAccentMarks[firstVowel]?.[number - 1];
  if (!firstVowelDiacritic) return jyutping;

  const firstVowelIndex = jyutping.split("").findIndex((char) => vowels.includes(char));
  const jyutpingDiacritic =
    jyutping.slice(0, firstVowelIndex) +
    firstVowelDiacritic +
    jyutping.slice(firstVowelIndex + 1);

  return jyutpingDiacritic.replace(/\d/g, "");
}

export function convertCantoJyutpingToSLWongRomanizedDiacritics(
  jyutping: string,
): string {
  const toneMarkers: Record<string, string> = {
    "1": "'",
    "2": "´",
    "3": "¯",
    "4": "ˌ",
    "5": "ˏ",
    "6": "_",
  };

  const toneMatch = jyutping.match(/([1-6])$/);
  const tone = toneMatch ? toneMatch[1] : "";
  let result = tone ? jyutping.slice(0, -1) : jyutping;

  result = result.replace(/c/g, "ts");
  result = result.replace(/z/g, "dz");

  result = result.replace(/eoi/g, "eue");
  result = result.replace(/oek/g, "euk");
  result = result.replace(/oe/g, "eu");
  result = result.replace(/eo/g, "eu");
  result = result.replace(/yu/g, "ue");

  result = result.replace(/j/g, "y");

  return (tone ? toneMarkers[tone] : "") + result;
}

export function convertCantoJyutpingToYale(jyutping: string): string {
  const toneMarkers: Record<string, string[]> = {
    a: ["ā", "á", "a", "à", "á", "a"],
    e: ["ē", "é", "e", "è", "é", "e"],
    i: ["ī", "í", "i", "ì", "í", "i"],
    o: ["ō", "ó", "o", "ò", "ó", "o"],
    u: ["ū", "ú", "u", "ù", "ú", "u"],
    m: ["m̄", "ḿ", "m", "m̀", "ḿ", "m"],
    ng: ["n̄g", "ńg", "ng", "ǹg", "ńg", "ng"],
  };

  return jyutping
    .split(/(?<=[1-6])/)
    .map((syllable) => convertSyllable(syllable.trim()))
    .join(" ");

  function convertSyllable(syllable: string): string {
    const toneMatch = syllable.match(/([1-6])$/);
    if (!toneMatch) return syllable;

    const toneNum = parseInt(toneMatch[1] as string, 10) - 1;
    let body = syllable.slice(0, -1);

    body = body.replace(/^jy/, "y");
    body = body.replace(/^j/, "y");
    body = body.replace(/^c(?!h)/, "ch");
    body = body.replace(/^z/, "j");

    body = body.replace(/eu(?=[^aeiou]|$)/, "eeu");
    body = body.replace(/aa$/, "a");
    body = body.replace(/oe/, "eu");
    body = body.replace(/eo/, "eu");

    if (/[aeiou]/.test(body)) {
      body = body.replace(/[aeiou]/, (vowel) => toneMarkers[vowel]?.[toneNum] ?? vowel);
    } else if (/^ng/.test(body)) {
      body = (toneMarkers.ng?.[toneNum] ?? "ng") + body.slice(2);
    } else if (/^m/.test(body)) {
      body = (toneMarkers.m?.[toneNum] ?? "m") + body.slice(1);
    }

    if (toneNum >= 3) {
      const withH = body.replace(/(ng|[mnptk])$/, "h$1");
      body = withH === body ? body + "h" : withH;
    }

    return body;
  }
}

export function stripDisambiguatorFromToken(token: AnnotatedToken): AnnotatedToken {
  const disambigPattern = /^(\S+)\s*\(.*\)$/;

  if (!disambigPattern.test(token.text)) return token;

  const baseWord = token.text.match(disambigPattern)?.[1] ?? token.text;
  const filteredPhoneticToken = token.phoneticToken
    ? token.phoneticToken.filter(([chars, spelling]) => spelling !== undefined && chars === baseWord)
    : token.phoneticToken;

  const outputToken: AnnotatedToken = {
    ...token,
    text: baseWord,
  };

  if (token.gloss !== undefined) {
    outputToken.gloss = token.gloss
      ? (token.gloss.match(disambigPattern)?.[1] ?? token.gloss)
      : token.gloss;
  }

  if (filteredPhoneticToken !== undefined) {
    outputToken.phoneticToken = filteredPhoneticToken;
  }

  return outputToken;
}

export const shuffle = <T>(arr: T[]): T[] =>
  arr.reduce(
    (a, _, i) => {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j] as T, a[i] as T];
      return a;
    },
    [...arr],
  );

export function isJsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    if (Object.keys(aRecord).length !== Object.keys(bRecord).length) return false;
    for (const key in aRecord) {
      if (!(key in bRecord)) return false;
      if (!isJsonDeepEqual(aRecord[key], bRecord[key])) return false;
    }
    return true;
  }
  return false;
}

export function isSourceContentDefinitelyPublic(sourceContent: SourceContent): boolean {
  if ("file" in sourceContent.ref) {
    return true;
  }
  if (
    "db" in sourceContent.ref &&
    ["word_explicitations", "words", "homographs"].includes(sourceContent.ref.db.table)
  ) {
    return true;
  }
  return false;
}

export function isLocalizationDefinitelyFromPublicSource(
  localization: Localization,
): boolean {
  return isSourceContentDefinitelyPublic(localization.sourceContent);
}

function guessUserRegion({ locale, timeZone }: LocalePriceOptions): RegionCode {
  const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
  const resolvedTimeZone = timeZone ?? resolvedOptions.timeZone;

  if (resolvedTimeZone === "Asia/Hong_Kong") return "HK";
  if (resolvedTimeZone === "Asia/Singapore") return "SG";
  if (resolvedTimeZone.startsWith("Asia")) return "SG";

  if (resolvedTimeZone === "Europe/London") return "GB";
  if (resolvedTimeZone.startsWith("Europe")) return "EU";

  if (resolvedTimeZone.startsWith("Australia")) return "AU";
  if (resolvedTimeZone === "Pacific/Auckland") return "NZ";
  if (resolvedTimeZone === "Pacific/Chatham") return "NZ";

  if (resolvedTimeZone.startsWith("America")) {
    const location = resolvedTimeZone.split("/")[1];
    if (location && CANADIAN_TIMEZONE_LOCATIONS.has(location.toUpperCase())) {
      return "CA";
    }
    return "US";
  }

  const resolvedLocale = locale ?? resolvedOptions.locale;
  const region = regionFromLocale(resolvedLocale);
  if (region && region in REGION_PRICES) return region as RegionCode;

  const languageCode = resolvedLocale.split("-")[0]?.toLowerCase();
  if (languageCode && EURO_LANGUAGE_CODES.has(languageCode)) return "EU";

  return "US";
}

function regionFromLocale(locale: string): string | undefined {
  return locale.split("-").find((part) => /^[A-Z]{2}$/.test(part));
}
