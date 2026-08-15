import { LANGS } from "./data/langs.js";
import { LANGSCRIPTS } from "./data/lang-scripts.js";
import { LANGSNAMES } from "./data/lang-names.js";
import type { Lang, LangScript } from "./types.js";

export const langScriptsDict: Record<string, LangScript> = Object.fromEntries(
  LANGSCRIPTS.map((langScript) => [langScript.g_script, langScript]),
);

const lowerToMixedCaseLangMap: Record<string, string> = {
  "yue-hans": "yue-Hans",
  "cmn-hant": "cmn-Hant",
  "cmn-hans": "cmn-Hans",
};

const langCodeAliases: Record<string, string> = {
  "zh-cn": "cmn-hans",
  "zh-tw": "cmn-hant",
  "zh-hk": "yue",
  "zh-hant": "cmn-hant",
  "zh-hans": "cmn-hans",
  "ar-eg": "arz",
  "ar-ma": "ary",
};

export function getLang(gcodeMain: string): Lang | undefined {
  if (!gcodeMain) return undefined;

  const lowerCode = gcodeMain.toLowerCase();
  const targetCode = langCodeAliases[lowerCode] ?? lowerCode;
  return LANGS.find((lang) => lang.gcode_main.toLowerCase() === targetCode);
}

export function estimateNumWords({
  lang,
  text,
}: {
  lang: string;
  text: string;
}): number {
  // Note: Using Intl.Segmenter(locale, { granularity: "word" }) would produce
  // more accurate word counts.
  const langObj = getLang(lang);
  if (!langObj) {
    console.warn(
      `⚠️ estimateNumWords: langObj not found for lang with code: ${lang}`,
    );
  }
  const isWordSpacedLang = langObj
    ? getLangScript(langObj.g_script)?.is_word_spaced
    : undefined;

  const averageGraphemesPerWordByLang: Record<string, number> = {
    // Non-spaced, non-alphabetic languages.
    ja: 2.5,
    yue: 2.5,
    "yue-hans": 2.5,
    "cmn-hant": 2.5,
    "cmn-hans": 2.5,
    // Non-spaced, alphabetic languages.
    th: 5,
  };
  const canonicalLang = langObj?.gcode_main ?? lang.toLowerCase();
  let averageGraphemesPerWord =
    averageGraphemesPerWordByLang[canonicalLang];

  if (!averageGraphemesPerWord) {
    if (isWordSpacedLang) {
      // A fixed grapheme ratio was previously used here. Counting whitespace-
      // separated words avoids splitting short multi-word expressions poorly.
      return text.trim().split(/\s+/).filter(Boolean).length;
    }

    // Fall back to the historical non-spaced alphabetic-language estimate for
    // unknown languages as well.
    averageGraphemesPerWord = 5;
  }

  const graphemeSegmenter = new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  });
  const numGraphemes = [...graphemeSegmenter.segment(text)].length;
  return numGraphemes / averageGraphemesPerWord;
}

export function getLangName(
  gcodeMain: string,
  targetLang: string,
): string | undefined {
  const langObj = getLang(gcodeMain);
  const targetLangLower = targetLang.toLowerCase();
  const gcodeMainLower = gcodeMain.toLowerCase();

  if (langObj) {
    if (gcodeMainLower === targetLangLower) {
      return langObj.name_natural;
    }

    if (targetLangLower === "en") {
      return langObj.name_english;
    }
  }

  let output = LANGSNAMES[gcodeMainLower]?.[targetLangLower];
  if (output) return output;

  const codeSegments = gcodeMain.split("-");
  if (codeSegments.length < 2) return undefined;

  const outputSegments = codeSegments
    .map((segment) => LANGSNAMES[segment.toLowerCase()]?.[targetLangLower])
    .filter((segment): segment is string => Boolean(segment));

  if (outputSegments.length === 0) return undefined;

  return `${outputSegments[0]} (${outputSegments.slice(1).join(", ")})`;
}

export function getLangScript(gscript: string): LangScript | undefined {
  if (!gscript) return undefined;
  const normalizedScript = gscript.toLowerCase().trim();
  return LANGSCRIPTS.find(
    (script) => script.g_script.toLowerCase() === normalizedScript,
  );
}

export function isLangWordSpaced(gcodeMain: string): boolean | undefined {
  const lang = getLang(gcodeMain);
  return lang ? getLangScript(lang.g_script)?.is_word_spaced : undefined;
}

export function getLangCodingVarName(langCode: string): string {
  return langCode.toLowerCase().replace(/-/g, "_");
}

export function doesLangHaveMicrosoftVoice(langCode: string): boolean {
  const langObj = getLang(langCode);
  return Boolean(langObj?.mttslocale_main);
}

export function toMixedCaseLang(lowerCaseLangCode: string): string {
  return lowerToMixedCaseLangMap[lowerCaseLangCode] ?? lowerCaseLangCode;
}

export function isAdvocatableLang(lang: string): boolean {
  return [
    "yue",
    "eu",
    "fil",
    "mt",
    "gl",
    "lb",
    "hak",
    "nan",
    "wuu",
    "si",
    "ha",
    "ta",
    "gu",
    "mr",
    "mk",
  ].includes(lang);
}

export function doesLangMainScriptHaveReadingGuide(lang: string): boolean {
  return ["si", "el", "ko", "th", "arz", "tok"].includes(lang);
}
