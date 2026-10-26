import { LANGS } from "../core/language/data/langs.js";
import type { SpeechSynthTTSVoice } from "./shared.js";

/** Raw browser voice metadata; this module never enumerates voices or starts playback. */
export type BrowserSpeechVoice = Pick<SpeechSynthesisVoice,
  "voiceURI" | "name" | "lang" | "default" | "localService">;
export type BrowserVoiceRankingOptions = {
  /** Apply the browser UI's macOS novelty-voice filter. Defaults to false. */
  isMacOS?: boolean;
  /** Keep an explicit user choice selectable even if the novelty filter would hide it. */
  preferredVoices?: readonly Pick<BrowserSpeechVoice, "voiceURI" | "lang">[];
};

export const BROWSER_VOICES_DEFAULTS: Record<string, SpeechSynthTTSVoice[]> = {
  yue: [
    { service: "BROWSER", voice_id: "Google 粤語（香港）", voice_lang: "zh-HK" },
    { service: "BROWSER", voice_id: "Sinji", voice_lang: "zh-HK" },
    { service: "BROWSER", voice_id: "Sinji", voice_lang: "yue-HK" }, // 20260305: MacOS renamed voice_lang for Cantonese
  ],
  en: [
    { service: "BROWSER", voice_id: "Google US English", voice_lang: "en-US" },
    { service: "BROWSER", voice_id: "Samantha", voice_lang: "en-US" },
    { service: "BROWSER", voice_id: "Karen", voice_lang: "en-AU" },
    { service: "BROWSER", voice_id: "Alex", voice_lang: "en-US" },
  ],
  ja: [
    { service: "BROWSER", voice_id: "Google 日本語", voice_lang: "ja-JP" },
    { service: "BROWSER", voice_id: "Otoya", voice_lang: "ja-JP" },
  ],
  es: [
    { service: "BROWSER", voice_id: "Juan (Enhanced)", voice_lang: "es-MX" },
    { service: "BROWSER", voice_id: "Juan", voice_lang: "es-MX" },
    { service: "BROWSER", voice_id: "Paulina", voice_lang: "es-MX" },
    { service: "BROWSER", voice_id: "Mónica", voice_lang: "es-ES" },
  ],
  fr: [
    { service: "BROWSER", voice_id: "Google français", voice_lang: "fr-FR" },
    { service: "BROWSER", voice_id: "Thomas (Enhanced)", voice_lang: "fr-FR" },
    { service: "BROWSER", voice_id: "Thomas", voice_lang: "fr-FR" },
    { service: "BROWSER", voice_id: "Amélie", voice_lang: "fr-CA" },
  ],
  ms: [
    { service: "BROWSER", voice_id: "Amira", voice_lang: "ms-MY" },
  ],
  de: [
    { service: "BROWSER", voice_id: "Martin", voice_lang: "de-DE" },
    { service: "BROWSER", voice_id: "Helena", voice_lang: "de-DE" },
    { service: "BROWSER", voice_id: "Anna", voice_lang: "de-DE" },
    { service: "BROWSER", voice_id: "Google Deutsch", voice_lang: "de-DE" },
    { service: "BROWSER", voice_id: "Eddy", voice_lang: "de-DE" },
  ],
  "cmn-hant": [
    { service: "BROWSER", voice_id: "Google 國語（臺灣）", voice_lang: "zh-TW" },
    { service: "BROWSER", voice_id: "Meijia", voice_lang: "zh-TW" },
  ],
  pt: [
    { service: "BROWSER", voice_id: "Felipe (Enhanced)", voice_lang: "pt-BR" },
    { service: "BROWSER", voice_id: "Felipe", voice_lang: "pt-BR" },
    { service: "BROWSER", voice_id: "Joaquim (Enhanced)", voice_lang: "pt-PT" },
    { service: "BROWSER", voice_id: "Joaquim", voice_lang: "pt-PT" },
  ],
};


const DEPRIORITIZED_BROWSER_VOICE_NAME_PARTS = [
  "Albert",
  "Bad News",
  "Bahh",
  "Bells",
  "Boing",
  "Bubbles",
  "Cellos",
  "Deranged",
  "Eddy",
  "Flo",
  "Good News",
  "Grandma",
  "Hysterical",
  "Junior",
  "Pipe Organ",
  "Princess",
  "Reed",
  "Rocko",
  "Sandy",
  "Shelley",
  "Superstar",
  "Trinoids",
  "Whisper",
  "Zarvox",
] as const;

// Web Speech does not expose macOS's novelty-voice trait. Keep this list
// conservative and only hide a voice when another option for its exact locale
// remains. Alex is deliberately retained: its age alone is not a quality test.
const LOW_QUALITY_MAC_VOICE_NAME_PARTS = [
  ...DEPRIORITIZED_BROWSER_VOICE_NAME_PARTS,
  "Anika", "Anima Robot", "Anxious Andy", "Fast Test",
  "Female 1", "Female 2", "Female 3", "Female 4", "Female 5",
  "Male 1", "Male 2", "Male 3", "Male 4", "Male 5", "Male 6", "Male 7", "Male 8",
  "Grandpa", "Croak", "Demonic", "ESpeak", "Half-Life Announcement System",
  "Jester", "Klatt", "Mr Serious", "Organ", "Robosoft", "Wobble",
] as const;

function getIntlDisplayName(
  locale: string,
  type: "language" | "region",
  code: string,
): string | undefined {
  if (!("DisplayNames" in Intl)) return undefined;
  try {
    return new Intl.DisplayNames([locale], { type }).of(code);
  } catch {
    return undefined;
  }
}

function getBrowserVoiceLangNameParts(langCode: string): string[] {
  const [languageCode, regionCode] = langCode.split(/[-_]/);
  const parts = new Set<string>();

  const lang = languageCode
    ? LANGS.find((l) => l.gcode_main.toLowerCase() === languageCode.toLowerCase())
    : undefined;
  if (lang?.name_english) parts.add(lang.name_english);
  if (lang?.name_natural) parts.add(lang.name_natural);

  if (languageCode) {
    const englishLanguageName = getIntlDisplayName("en", "language", languageCode);
    const nativeLanguageName = getIntlDisplayName(languageCode, "language", languageCode);
    if (englishLanguageName) parts.add(englishLanguageName);
    if (nativeLanguageName) parts.add(nativeLanguageName);
  }

  if (regionCode) {
    const englishRegionName = getIntlDisplayName("en", "region", regionCode);
    const nativeRegionName = getIntlDisplayName(
      languageCode || "en",
      "region",
      regionCode,
    );
    if (englishRegionName) parts.add(englishRegionName);
    if (nativeRegionName) parts.add(nativeRegionName);
  }

  return [...parts].filter((part) => part.length > 1);
}

function hasVoiceNamePart(name: string, parts: readonly string[]): boolean {
  const nameUpper = name.toUpperCase();
  return parts.some((part) => {
    const partUpper = part.toUpperCase();
    if (!partUpper) return false;
    if (/^[A-Z0-9 ]+$/.test(partUpper)) {
      const escapedPart = partUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^A-Z0-9])${escapedPart}([^A-Z0-9]|$)`).test(
        nameUpper,
      );
    }
    return nameUpper.includes(partUpper);
  });
}

let browserVoiceDefaultPriorityMap: Map<string, number> | null = null;

function browserVoiceDefaultsKey(voiceId: string, voiceLang: string): string {
  return `${voiceId}\u0000${voiceLang.toUpperCase()}`;
}

function getBrowserVoiceDefaultPriorityMap(): Map<string, number> {
  if (browserVoiceDefaultPriorityMap) return browserVoiceDefaultPriorityMap;
  const map = new Map<string, number>();
  for (const defaults of Object.values(BROWSER_VOICES_DEFAULTS)) {
    defaults.forEach((voice, index) => {
      const key = browserVoiceDefaultsKey(voice.voice_id, voice.voice_lang);
      if (!map.has(key)) map.set(key, index); // first occurrence wins if duplicated across langs
    });
  }
  browserVoiceDefaultPriorityMap = map;
  return map;
}

function getBrowserVoiceDefaultPriority(v: BrowserSpeechVoice): number | null {
  const map = getBrowserVoiceDefaultPriorityMap();
  const key = browserVoiceDefaultsKey(v.voiceURI, v.lang);
  return map.has(key) ? map.get(key)! : null;
}

function browserVoiceSortScore(v: BrowserSpeechVoice): number {
  // BROWSER_VOICES_DEFAULTS match => always sorts first, ordered by its listed position.
  const defaultPriority = getBrowserVoiceDefaultPriority(v);
  if (defaultPriority !== null) return -1_000_000 + defaultPriority;

  let scoreBucket = 5;
  const nameUpper = v.name.toUpperCase();

  if (v.default) scoreBucket = 0;
  else if (nameUpper.includes("GOOGLE")) scoreBucket = 1;
  else if (nameUpper.includes("PREMIUM")) scoreBucket = 2;
  else if (nameUpper.includes("MICROSOFT")) scoreBucket = 3; // untested if exists on Windows
  else if (nameUpper.includes("ENHANCED")) scoreBucket = 4;
  else if (!v.localService) scoreBucket = 4;

  let penalty = 0;
  if (hasVoiceNamePart(v.name, getBrowserVoiceLangNameParts(v.lang))) penalty += 20;
  if (hasVoiceNamePart(v.name, DEPRIORITIZED_BROWSER_VOICE_NAME_PARTS)) penalty += 40;

  return scoreBucket * 100 + penalty;
}

function browserVoiceDedupeKey(v: BrowserSpeechVoice): string {
  return [
    v.voiceURI,
    v.lang,
    v.name,
    String(v.default),
    String(v.localService),
  ].join("\u0000");
}

function sortBrowserVoices<T extends BrowserSpeechVoice>(voices: readonly T[]): T[] {
  return [...voices].sort((a, b) => {
    return browserVoiceSortScore(a) - browserVoiceSortScore(b);
  });
}

function dedupeBrowserVoices<T extends BrowserSpeechVoice>(voices: readonly T[]): T[] {
  const seen = new Set<string>();
  return voices.filter((voice) => {
    const key = browserVoiceDedupeKey(voice);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortAndDedupeBrowserVoices<T extends BrowserSpeechVoice>(voices: readonly T[]): T[] {
  return dedupeBrowserVoices(sortBrowserVoices(voices));
}

export function filterLowQualityMacVoices<T extends Pick<SpeechSynthesisVoice, "name" | "lang">>(voices: readonly T[]): T[] {
  const hasBetterVoiceForLocale = new Set(
    voices.filter((voice) => !hasVoiceNamePart(voice.name, LOW_QUALITY_MAC_VOICE_NAME_PARTS))
      .map((voice) => voice.lang.replaceAll("_", "-").toLowerCase()),
  );
  return voices.filter((voice) => {
    const locale = voice.lang.replaceAll("_", "-").toLowerCase();
    return !hasBetterVoiceForLocale.has(locale) ||
      !hasVoiceNamePart(voice.name, LOW_QUALITY_MAC_VOICE_NAME_PARTS);
  });
}

/** Reuse Lingop's curated priorities, quality ordering, deduplication and macOS policy.
 * Filter for localService before calling when the consumer requires offline speech.
 * Input order breaks equal-score ties; input objects and arrays are never changed.
 */
export function rankBrowserVoices<T extends BrowserSpeechVoice>(
  voices: readonly T[], options: BrowserVoiceRankingOptions = {},
): T[] {
  const ranked = sortAndDedupeBrowserVoices(voices);
  if (!options.isMacOS) return ranked;
  const selectable = new Set(filterLowQualityMacVoices(ranked));
  return ranked.filter(voice => selectable.has(voice) || options.preferredVoices?.some(preferred =>
    preferred.voiceURI === voice.voiceURI &&
    preferred.lang.replaceAll("_", "-").toLowerCase() === voice.lang.replaceAll("_", "-").toLowerCase(),
  ));
}
