import type { PrebakedTranslationsByLangPair } from "./types.js";

export function getPrebakedLangPairKey(
  sourceLang: string,
  targetLang: string,
): string {
  return `${sourceLang.toLowerCase()}-to-${targetLang.toLowerCase()}`;
}

export function lookupPrebakedTranslation({
  sourceText,
  sourceLang,
  targetLang,
  translationsByLangPair,
}: {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  translationsByLangPair: PrebakedTranslationsByLangPair;
}): string | undefined {
  if (sourceLang.toLowerCase() === targetLang.toLowerCase()) return sourceText;
  const langPair = getPrebakedLangPairKey(sourceLang, targetLang);
  const translations = translationsByLangPair[langPair];
  if (!translations) return undefined;
  return translations[sourceText] ?? sourceText;
}
