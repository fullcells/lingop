import type { SpellingSystem } from "../../core/language/index.js";

export function getSettingsVoiceLangs({
  guiLang,
  focusLang,
  showGuiLangVoiceSetting,
}: {
  guiLang: string;
  focusLang?: string | null;
  showGuiLangVoiceSetting: boolean;
}): string[] {
  return Array.from(
    new Set([
      ...(showGuiLangVoiceSetting ? [guiLang] : []),
      ...(focusLang ? [focusLang] : []),
    ]),
  );
}

export function resolvePreferredSpellingSystem({
  availableSystems,
  preferredSystem,
}: {
  availableSystems: readonly SpellingSystem[];
  preferredSystem?: SpellingSystem;
}): SpellingSystem | null {
  return preferredSystem && availableSystems.includes(preferredSystem)
    ? preferredSystem
    : (availableSystems[0] ?? null);
}
