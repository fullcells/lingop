import { getLang, getLangName } from "../../core/language/index.js";

const focusLangDisplayOverrides: Record<string, string> = {
  yue: "yue-hant",
  wuu: "wuu-hans",
  nan: "nan-hant",
  hak: "hak-hant",
};

export function getLanguagePickerLocalizedScripts(
  focusLangOptions: readonly string[],
  guiLang: string,
): Record<string, string> {
  return Object.fromEntries(
    focusLangOptions.flatMap((focusLang) => {
      // Brute overrides for some langs.
      const normalizedLang = focusLangDisplayOverrides[focusLang] ?? focusLang;
      // Check for a second element, which determines whether there is a script.
      const parts = normalizedLang.split("-");
      const scriptCode = parts[1];
      if (!scriptCode) return [];
      const scriptName = getLangName(scriptCode, guiLang) ?? "";
      if (!scriptName) return [];
      return [[focusLang, scriptName]];
    }),
  );
}

export function sortLanguagePickerFocusLangOptions(
  focusLangOptions: readonly string[],
  guiLang: string,
  shouldFocusLangNotEqualGuiLang = false,
): string[] {
  let options = [...focusLangOptions];

  // Filter out GuiLang if shouldFocusLangNotEqualGuiLang.
  if (shouldFocusLangNotEqualGuiLang) {
    options = options.filter((focusLang) => focusLang !== guiLang);
  }

  // Set GuiLangName to a sortable guiLangName variant.
  let sortableGuiLang = guiLang;
  if (sortableGuiLang === "ja") sortableGuiLang = "ja-hiragana";
  if (sortableGuiLang === "yue") sortableGuiLang = "yue-jyutping";
  if (sortableGuiLang.startsWith("cmn-")) sortableGuiLang = "cmn-pinyin";

  // Sort by GUI-language name.
  options.sort((a, b) => {
    const nameA = getLangName(a, sortableGuiLang);
    const nameB = getLangName(b, sortableGuiLang);
    // If both are undefined, sort by language code.
    if (nameA === undefined && nameB === undefined) return a.localeCompare(b);
    // If nameA is undefined, it goes last.
    if (nameA === undefined) return 1;
    // If nameB is undefined, it goes last.
    if (nameB === undefined) return -1;
    // Both are strings; compare them.
    return nameA.localeCompare(nameB);
  });

  return options;
}

export function filterLanguagePickerFocusLangOptions({
  focusLangOptions,
  guiLang,
  localizedScripts,
  searchValue,
}: {
  focusLangOptions: readonly string[];
  guiLang: string;
  localizedScripts: Readonly<Record<string, string>>;
  searchValue: string;
}): string[] {
  if (!searchValue) return [...focusLangOptions];

  // Filter against codes plus localized, natural, English, and script names.
  const searchLower = searchValue.toLowerCase();
  return focusLangOptions.filter((focusLangOption) => {
    const lang = getLang(focusLangOption);
    return [
      focusLangOption, // yue
      getLangName(focusLangOption, guiLang), // Cantonese
      lang?.name_natural, // 粵語：廣東話
      lang?.name_english, // Cantonese
      localizedScripts[focusLangOption] ?? "", // Traditional Chinese script
    ].some((alternativeName) =>
      alternativeName?.toLowerCase().includes(searchLower),
    );
  });
}
