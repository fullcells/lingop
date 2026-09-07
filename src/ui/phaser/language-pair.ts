import { getLang } from "../../core/language/utils.js";

/** Returns canonical Lingop language codes formatted for compact UI, e.g. EN→JA. */
export function formatLingopLanguagePair(guiLang: string, focusLang: string): string {
  const display = (lang: string): string => (getLang(lang)?.gcode_main ?? lang).toUpperCase();
  return `${display(guiLang)}→${display(focusLang)}`;
}
