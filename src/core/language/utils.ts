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

export function getLang(gcodeMain: string): Lang | undefined {
  if (!gcodeMain) return undefined;

  const targetCode = gcodeMain.toLowerCase();
  return LANGS.find((lang) => lang.gcode_main.toLowerCase() === targetCode);
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
  return ["si", "el", "ko", "th", "arz"].includes(lang);
}
