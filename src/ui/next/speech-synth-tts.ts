import { LANGS } from "../../core/language/data/langs.js";
import { ilike } from "../../core/misc.js";
import type { ContentReference } from "../../core/misc.js";
import { getAPIVoices, selectVoiceOptions, getSpeechFileURL, speakableTextFromDisplayText } from "../../speech/shared.js";
import type { SpeechSynthTTSVoice, SpeechSynthVoiceOptions, APIVoiceAccessProfile, ContentContext, SpeechSynthTTSOptions } from "../../speech/shared.js";
export { fetchSpeech, speakableTextFromDisplayText, API_VOICE_ACCESS_PROFILE__CAMPLINGOV1 } from "../../speech/shared.js";
export type { SpeechSynthTTSVoice, SpeechSynthVoiceOptions, APIVoiceAccessProfile, ContentContext, SpeechSynthTTSOptions, SpeechSynthSupabaseClient, AudioMetaRow, APICreateSpeechInput } from "../../speech/shared.js";

// 20260109: Note: .speak with ContentContext as MEMBER_CONTENT is untested atm.

export const LOCALSTORE_PREF_VOICE_SPEED = "UI_PREF_VOICE_SPEED";
const LOCALSTORE_PREF_VOICES = "UI_PREF_VOICES";
export const DEFAULT_USER_PREFERRED_VOICE_SPEED = 1.0;
export const MIN_USER_PREFERRED_VOICE_SPEED = 0.5;
export const MAX_USER_PREFERRED_VOICE_SPEED = 2.0;
let runtimeUserPreferredVoiceSpeed = DEFAULT_USER_PREFERRED_VOICE_SPEED;

let userPreferredVoices: Record<string, SpeechSynthTTSVoice> = {};
if (typeof window !== "undefined") {
  try {
    const storedVoices = JSON.parse(
      window.localStorage.getItem(LOCALSTORE_PREF_VOICES) ?? "{}",
    ) as unknown;
    if (
      storedVoices &&
      typeof storedVoices === "object" &&
      !Array.isArray(storedVoices)
    ) {
      userPreferredVoices = storedVoices as Record<
        string,
        SpeechSynthTTSVoice
      >;
    }
  } catch {
    // Ignore malformed or unavailable storage and retain runtime defaults.
  }
}

// ----------------------------------------------------
// VOICES (Browser, API, User-Preferred)

function getLocalStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Reads Lingop's persisted speech speed, falling back safely on the server. */
export function getUserPreferredVoiceSpeed(): number {
  const storedSpeed = Number(getLocalStorageItem(LOCALSTORE_PREF_VOICE_SPEED));
  if (!Number.isFinite(storedSpeed) || storedSpeed <= 0) {
    return runtimeUserPreferredVoiceSpeed;
  }
  runtimeUserPreferredVoiceSpeed = Math.min(
    MAX_USER_PREFERRED_VOICE_SPEED,
    Math.max(MIN_USER_PREFERRED_VOICE_SPEED, storedSpeed),
  );
  return runtimeUserPreferredVoiceSpeed;
}

/** Validates and persists the speech speed used by browser and cloud playback. */
export function setUserPreferredVoiceSpeed(speed: number): number {
  const normalizedSpeed = Number.isFinite(speed)
    ? Math.min(
        MAX_USER_PREFERRED_VOICE_SPEED,
        Math.max(MIN_USER_PREFERRED_VOICE_SPEED, speed),
      )
    : DEFAULT_USER_PREFERRED_VOICE_SPEED;
  runtimeUserPreferredVoiceSpeed = normalizedSpeed;

  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem(
        LOCALSTORE_PREF_VOICE_SPEED,
        String(normalizedSpeed),
      );
    } catch {
      // Storage may be unavailable in privacy modes; retain safe playback.
    }
  }
  return normalizedSpeed;
}

// BROWSER VOICES - ORDERED with DEFAULT FIRST (DEV-DESIRE)
let inFlightRawBrowserVoices: Promise<SpeechSynthesisVoice[]> | null = null;
let inFlightBrowserVoices: Promise<SpeechSynthTTSVoice[]> | null = null;
let inFlightVOICES: Promise<SpeechSynthTTSVoice[]> | null = null;
let browserVoiceLifecycleListenersInitialized = false;
let browserSpeechNeedsLifecycleRecovery = false;

function invalidateBrowserVoiceCache(): void {
  inFlightRawBrowserVoices = null;
  inFlightBrowserVoices = null;
  inFlightVOICES = null;
}

function ensureBrowserVoiceLifecycleListeners(): void {
  if (browserVoiceLifecycleListenersInitialized || typeof window === "undefined") return;
  browserVoiceLifecycleListenersInitialized = true;

  const invalidate = () => {
    invalidateBrowserVoiceCache();
    browserSpeechNeedsLifecycleRecovery = true;
  };
  window.addEventListener?.("focus", invalidate);
  window.addEventListener?.("pagehide", invalidate);
  window.addEventListener?.("pageshow", invalidate);

  if (typeof document !== "undefined") {
    document.addEventListener("freeze", invalidate);
    document.addEventListener("resume", invalidate);
    document.addEventListener("visibilitychange", invalidate);
  }
}

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

function getBrowserVoiceDefaultPriority(v: SpeechSynthesisVoice): number | null {
  const map = getBrowserVoiceDefaultPriorityMap();
  const key = browserVoiceDefaultsKey(v.voiceURI, v.lang);
  return map.has(key) ? map.get(key)! : null;
}

function browserVoiceSortScore(v: SpeechSynthesisVoice): number {
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

function browserVoiceDedupeKey(v: SpeechSynthesisVoice): string {
  return [
    v.voiceURI,
    v.lang,
    v.name,
    String(v.default),
    String(v.localService),
  ].join("\u0000");
}

function sortBrowserVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => {
    return browserVoiceSortScore(a) - browserVoiceSortScore(b);
  });
}

function dedupeBrowserVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const seen = new Set<string>();
  return voices.filter((voice) => {
    const key = browserVoiceDedupeKey(voice);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortAndDedupeBrowserVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return dedupeBrowserVoices(sortBrowserVoices(voices));
}

export function filterLowQualityMacVoices<T extends Pick<SpeechSynthesisVoice, "name" | "lang">>(voices: T[]): T[] {
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

async function getRawBrowserVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
    return Promise.resolve([]);
  }
  ensureBrowserVoiceLifecycleListeners();
  const synth = window.speechSynthesis;

  if (inFlightRawBrowserVoices) return inFlightRawBrowserVoices;

  inFlightRawBrowserVoices = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    let listeningWithEventTarget = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (listeningWithEventTarget) {
        synth.removeEventListener("voiceschanged", tryLoad);
      } else if (synth.onvoiceschanged === tryLoad) {
        synth.onvoiceschanged = null;
      }
    };
    const tryLoad = () => {
      if (settled) return;
      const voices = synth.getVoices();
      if (voices.length) {
        settled = true;
        cleanup();
        resolve(sortAndDedupeBrowserVoices(voices));
      }
    };

    if (typeof synth.addEventListener === "function") {
      listeningWithEventTarget = true;
      synth.addEventListener("voiceschanged", tryLoad);
    } else if ("onvoiceschanged" in synth) {
      synth.onvoiceschanged = tryLoad;
    }
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn(`Timed out waiting for browser voices. Timeout duration: ${timeoutMs}`);
      resolve([]);
    }, timeoutMs);
    tryLoad();
  });
  return inFlightRawBrowserVoices;
}

async function getBrowserVoices(): Promise<SpeechSynthTTSVoice[]> {
  const rawBrowserVoices = await getRawBrowserVoices();
  if (inFlightBrowserVoices) return inFlightBrowserVoices;
  inFlightBrowserVoices = (async () => {
    const isMac = typeof navigator !== "undefined" &&
      (/Macintosh|Mac OS X/.test(navigator.userAgent) || /Mac/.test(navigator.platform));
    const selectableVoices = isMac ? filterLowQualityMacVoices(rawBrowserVoices) : rawBrowserVoices;
    return selectableVoices.map((bv) => ({
      service: "BROWSER",
      voice_id: bv.voiceURI,
      voice_lang: bv.lang,
    }));
  })();
  return inFlightBrowserVoices;
}

// VOICES - i.e. Browser + API Voices
async function getVOICES(options: SpeechSynthTTSOptions = {}): Promise<SpeechSynthTTSVoice[]> { // ~10,000+ Voices
  if (inFlightVOICES) return inFlightVOICES;
  let request!: Promise<SpeechSynthTTSVoice[]>;
  request = (async () => {
    const [browserResult, apiResult] = await Promise.allSettled([
      getBrowserVoices(),
      getAPIVoices(options),
    ]);
    const browserVoices = browserResult.status === "fulfilled" ? browserResult.value : [];
    const apiVoices = apiResult.status === "fulfilled" ? apiResult.value : [];
    if (browserResult.status === "rejected") {
      console.warn("Could not load browser voices:", browserResult.reason);
      if (inFlightVOICES === request) invalidateBrowserVoiceCache();
    }
    if (apiResult.status === "rejected") {
      console.warn("Could not load API voices:", apiResult.reason);
      // Return browser voices now, but let the next lookup retry cloud voices.
      if (inFlightVOICES === request) inFlightVOICES = null;
    }
    return [...browserVoices, ...apiVoices];
  })();
  inFlightVOICES = request;
  return request;
}

export async function getVoiceOptionsForLang(
  lang: string,
  apiVoiceAccessProfile: APIVoiceAccessProfile,
  options: SpeechSynthTTSOptions = {},
): Promise<SpeechSynthVoiceOptions> {
  return selectVoiceOptions(lang, apiVoiceAccessProfile, apiVoiceAccessProfile === "NONE"
    ? await getBrowserVoices() : await getVOICES(options));
}

// USER PREFERRED VOICES
// - ~ SideNote: In the past: USER_PREFERRED_VOICES was stored as localStorage.getItem("_KEY_FAV_WEB_VOICES").
export function updateUserPreferredVoice(lang: string, voice: SpeechSynthTTSVoice): void {
  userPreferredVoices[lang] = voice;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCALSTORE_PREF_VOICES,
      JSON.stringify(userPreferredVoices),
    );
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
}

// ----------------------------------------------------
export const BROWSER_VOICES_DEFAULTS: Record<string, SpeechSynthTTSVoice[]> = { // From CAMPLINGO-V1 // [+] Future: To use when picking Voices' BrowserVoices' Default (or prioritizing certain voices when they're sorted) - assuming the browser-voice is available in the browser (not always available) // Future: To use for determining preferred default browser voice (which should, if lang isn't explicitly specified, still work on reducing bad-voice options)
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

// ----------------------------------------------------
// ACTIVE VOICE + SPEAK
export async function getActiveVoiceForLang(
  lang: string,
  apiVoiceAccessProfile: APIVoiceAccessProfile,
  options: SpeechSynthTTSOptions = {},
): Promise<SpeechSynthTTSVoice | null> {
  const voiceOptions = await getVoiceOptionsForLang(lang, apiVoiceAccessProfile, options);
  // 1. Return User-Preferred Voice if it's still available.
  const userPreferredVoice = userPreferredVoices[lang] ?? null;
  if (userPreferredVoice) {
    if (
      voiceOptions.available.voices.some((v) =>
        v.voice_id === userPreferredVoice.voice_id && v.service === userPreferredVoice.service,
      )
    ) {
      return userPreferredVoice;
    }
  }
  // 2. Return first available voice.
  return voiceOptions.available.voices[0] ?? null;
}

export async function speak({
  text,
  lang,
  apiVoiceAccessProfile,
  contentContext,
  ref,
  voiceOverride,
  ...options
}: {
  text: string;
  lang: string;
  apiVoiceAccessProfile: APIVoiceAccessProfile;
  contentContext?: ContentContext | undefined;
  ref?: ContentReference | undefined;
  /**
   * Plays one currently available voice without changing the user's saved
   * preference. The access profile still governs whether the voice is usable.
   */
  voiceOverride?: SpeechSynthTTSVoice | undefined;
} & SpeechSynthTTSOptions): Promise<void> {
  let voice: SpeechSynthTTSVoice | null = null;
  if (voiceOverride) {
    const voiceOptions = await getVoiceOptionsForLang(
      lang,
      apiVoiceAccessProfile,
      options,
    );
    voice = voiceOptions.available.voices.find(
      (candidate) =>
        candidate.service === voiceOverride.service &&
        candidate.voice_id === voiceOverride.voice_id &&
        candidate.voice_lang === voiceOverride.voice_lang,
    ) ?? null;
    if (!voice) {
      console.error(
        `Voice override '${voiceOverride.voice_id}' is not available for lang '${lang}' under the active voice-access profile.`,
      );
      return;
    }
  } else {
    voice = await getActiveVoiceForLang(lang, apiVoiceAccessProfile, options);
  }
  if (!voice) {
    console.error(`Lang '${lang}' does not have an available voice.`);
    return;
  }

  // YUE OVERRIDE TO USE API VOICE IF AVAILABLE FOR PROBLEMATIC TEXTS // Potential Future: Browser Voices Improvement: 1. Brute forces-replace characters that should almost always be pronounced a certain way but are currently pronounced incorrectly [彈,近,抹]. 2. We feed in an optional AText - and use the 'spelling' there.
  if (!voiceOverride && ilike(lang, "yue")) {
    if (["覺", "彈", "近", "坐", "抹", "畫", "偈", "頂", "訂", "定", "正"].some((word) => text.includes(word))) {
      const voiceOptions = await getVoiceOptionsForLang(lang, apiVoiceAccessProfile, options);
      const cloudVoice = voiceOptions.available.voices.find((v) => v.service !== "BROWSER");
      if (cloudVoice) {
        await speakAPIVoice({ text, lang, contentContext, ref, voice: cloudVoice, ...options });
        return;
      }
    }
  }

  // --- STANDARD -------------------------------

  // BROWSER VOICE
  if (voice.service == "BROWSER") {
    try {
      await speakBrowserVoice(text, lang, voice);
    } catch (error) {
      // NONE is a browser-only access contract, so recovery must not trigger a remote request.
      if (
        error instanceof BrowserSpeechStartTimeoutError &&
        apiVoiceAccessProfile !== "NONE" &&
        !voiceOverride
      ) {
        const voiceOptions = await getVoiceOptionsForLang(lang, apiVoiceAccessProfile, options);
        const fallbackVoice = voiceOptions.available.voices.find((v) => v.service !== "BROWSER");
        if (fallbackVoice) {
          await speakAPIVoice({
            text,
            lang,
            contentContext,
            ref,
            voice: fallbackVoice,
            ...options,
          });
          return;
        }
      }
      throw error;
    }
  }
  // API VOICE
  if (voice.service !== "BROWSER") {
    await speakAPIVoice({ text, lang, contentContext, ref, voice, ...options });
  }
}

/**
 * PreloadSpeech - Fine to call this on any voice - it'll only 'Preload an Audio File' if its API-Speech (as opposed to Browser-Speech).
 */
export async function preloadSpeech({
  text,
  lang,
  apiVoiceAccessProfile,
  contentContext,
  ref,
  ...options
}: {
  text: string;
  lang: string;
  apiVoiceAccessProfile: APIVoiceAccessProfile;
  contentContext?: ContentContext | undefined;
  ref?: ContentReference | undefined;
} & SpeechSynthTTSOptions): Promise<void> {
  const voice = await getActiveVoiceForLang(lang, apiVoiceAccessProfile, options);
  if (!voice) {
    console.error(`Lang '${lang}' does not have an available voice.`);
    return;
  }
  if (voice.service == "BROWSER") return;
  // Get SpeechFileURL
  const fileURL = await getSpeechFileURL({ text, lang, contentContext, ref, voice, ...options });
  if (!fileURL) return;
  // Preload SpeechFile
  try {
    await preloadSpeechFile(fileURL);
  } catch (err) {
    console.error("Could not preload speech file:", err);
  }
}

const audioPreloadCache = new Map<string, HTMLAudioElement>(); // Note: May need to Restrict the Max Size of this (clearing older ones as we go)
const audioPreloadInFlight = new Map<string, Promise<HTMLAudioElement>>();
async function preloadSpeechFile(fileURL: string): Promise<HTMLAudioElement> {
  // Reuse if already preloaded
  const cached = audioPreloadCache.get(fileURL);
  if (cached) return cached;

  const inFlight = audioPreloadInFlight.get(fileURL);
  if (inFlight) return inFlight;

  const preloadPromise = (async () => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = fileURL;

    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve(); // enough buffered to play through
      audio.onerror = () => reject(new Error(`Failed to preload audio: ${fileURL}`));
      audio.load(); // triggers fetch/buffering
    });

    audioPreloadCache.set(fileURL, audio);
    return audio;
  })();

  audioPreloadInFlight.set(fileURL, preloadPromise);
  try {
    return await preloadPromise;
  } finally {
    if (audioPreloadInFlight.get(fileURL) === preloadPromise) {
      audioPreloadInFlight.delete(fileURL);
    }
  }
}

async function playSpeechFile(fileURL: string): Promise<void> {
  const audio = audioPreloadCache.get(fileURL) ?? await preloadSpeechFile(fileURL);
  // If this same element was played before, reset it
  audio.currentTime = 0;
  // Speed
  audio.playbackRate = getUserPreferredVoiceSpeed();
  // Play
  await new Promise<void>((resolve) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };

    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = (e: Event) => {
      console.error("Audio playback failed", fileURL, e);
      cleanup();
      resolve(); // keep your "brute force resolve" behavior
    };

    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });

    audio.play().catch((err: unknown) => {
      console.error("audio.play() failed", fileURL, err);
      cleanup();
      resolve();
    });
  });
}

async function speakAPIVoice({
  text,
  lang,
  contentContext,
  ref,
  voice,
  ...options
}: {
  text: string;
  lang: string;
  contentContext?: ContentContext | undefined;
  ref?: ContentReference | undefined;
  voice: SpeechSynthTTSVoice;
} & SpeechSynthTTSOptions): Promise<void> {
  // Get SpeechFileURL
  const fileURL = await getSpeechFileURL({ text, lang, contentContext, ref, voice, ...options });
  if (!fileURL) return;
  // Play Speech File
  try {
    await playSpeechFile(fileURL);
  } catch (err) {
    console.error("Could not play speech file:", err);
  }
}

// Browser speech engines can take more than a second to start on their first
// use, particularly just after loading or refreshing the system voice list.
const BROWSER_SPEECH_START_TIMEOUT_MS = 3000;
const BROWSER_SPEECH_RESET_SETTLE_MS = 120;

class BrowserSpeechStartTimeoutError extends Error {
  constructor() {
    super(`Browser speech synthesis did not start within ${BROWSER_SPEECH_START_TIMEOUT_MS}ms.`);
    this.name = "BrowserSpeechStartTimeoutError";
  }
}

async function resetBrowserSpeechSynthesis(): Promise<void> {
  speechSynthesis.cancel();
  speechSynthesis.resume();
  browserSpeechNeedsLifecycleRecovery = false;

  // Chrome updates its speech queue asynchronously. Let the canceled queue
  // settle before submitting the replacement utterance so streamed voices do
  // not lose their first audio frames.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, BROWSER_SPEECH_RESET_SETTLE_MS);
  });
}

async function speakBrowserUtterance(
  text: string,
  voice: SpeechSynthesisVoice,
  rate: number,
): Promise<void> {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = rate;

  await new Promise<void>((resolve, reject) => {
    let started = false;
    let settled = false;
    const startTimeoutId = setTimeout(() => {
      if (settled || started) return;
      settled = true;
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      reject(new BrowserSpeechStartTimeoutError());
    }, BROWSER_SPEECH_START_TIMEOUT_MS);

    utterance.onstart = () => {
      started = true;
      clearTimeout(startTimeoutId);
    };
    utterance.onend = () => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimeoutId);
      if (!started) {
        reject(new BrowserSpeechStartTimeoutError());
        return;
      }
      resolve();
    };
    utterance.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimeoutId);
      // Starting speech elsewhere intentionally interrupts the current
      // utterance. Treat that as normal early completion so callers can clear
      // their playback state without masking genuine synthesis failures.
      if (event.error === "interrupted" || event.error === "canceled") {
        resolve();
        return;
      }
      reject(new Error(`Browser speech synthesis failed: ${event.error}`, { cause: event }));
    };
    speechSynthesis.speak(utterance);
  });
}

async function speakBrowserVoice(
  text: string,
  lang: string,
  voice: SpeechSynthTTSVoice,
): Promise<void> {
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
    console.error("Browser speech synthesis is not available.");
    return;
  }

  // Get browser voice
  const rawBrowserVoices = await getRawBrowserVoices();
  let speechSynthVoice = rawBrowserVoices.find((bv) => bv.voiceURI == voice.voice_id);
  if (!speechSynthVoice) {
    throw new Error(`Browser voice could not be resolved: ${voice.voice_id}`);
  } // shouldn't happen

  // Process Text - (currently replace "_" sequences)
  text = speakableTextFromDisplayText({ lang, text });

  // Override Texts
  if (ilike(lang, "ja")) {
    if (text == "何") text = "なに"; // This forces it to pronounce it as "なに".
    if (text == "男" && voice.voice_id == "Google 日本語") {
      text = "男。"; // This forces it to pronounce it as "おとこ" as opposed to just "お".
    }
  }

  const speed = getUserPreferredVoiceSpeed();

  // An unconditional cancel/restart clips the beginning of some streamed
  // Google voices on repeated playback. Keep the reset behavior that Chrome
  // needs after page lifecycle changes and when interrupting an active queue,
  // while allowing ordinary idle replays to reuse the healthy audio pipeline.
  if (
    browserSpeechNeedsLifecycleRecovery ||
    speechSynthesis.speaking ||
    speechSynthesis.pending ||
    speechSynthesis.paused
  ) {
    await resetBrowserSpeechSynthesis();
  }

  // If Chrome accepts the utterance but never starts it, discard cached voice
  // objects, reset the engine, and retry once with a fresh voice object.
  try {
    await speakBrowserUtterance(text, speechSynthVoice, speed);
  } catch (error) {
    if (!(error instanceof BrowserSpeechStartTimeoutError)) throw error;

    await resetBrowserSpeechSynthesis();
    invalidateBrowserVoiceCache();
    const refreshedBrowserVoices = await getRawBrowserVoices();
    speechSynthVoice = refreshedBrowserVoices.find((bv) => bv.voiceURI == voice.voice_id);
    if (!speechSynthVoice) {
      throw new Error(`Browser voice could not be reacquired: ${voice.voice_id}`, { cause: error });
    }
    await speakBrowserUtterance(text, speechSynthVoice, speed);
  }
}

export function prettifyVoiceId(voice_id: string): string {
  let prettyVoiceId = voice_id;
  prettyVoiceId = prettyVoiceId.split(":")[0]!; // remove `:DragonNeural…` suffix
  prettyVoiceId = prettyVoiceId.split("-").pop() ?? ""; // remove `af-ZA-` prefix
  prettyVoiceId = prettyVoiceId.replace(/([a-z])([A-Z])/g, "$1 $2"); // Add a space between sequential lowercase and UPPERCASE (e.g. "JohnDoe" => "John Doe")
  return prettyVoiceId.trim();
}

// LIKELY FUTURE STUFF:
// export async function getAPISpeechFileDownloadLink(text:string, lang:string, apiVoiceAccessProfile:APIVoiceAccessProfile) {}
// export async function preloadAPISpeechFile(text:string, lang:string, apiVoiceAccessProfile:APIVoiceAccessProfile) {}

// ----------------------------------------------------
// [OPTIONAL] INIT when this file utils/speechSynthTTS is imported into a page - invoked exactly once (per browser tab/page load) // Otherwise, this will just naturally trigger when downstream functions are called anyway.
// In lingop this is explicit to avoid fetch/window side effects during Next SSR imports.
export async function initSpeechSynthTTS(options: SpeechSynthTTSOptions = {}): Promise<void> {
  await getVOICES(options);
  // console.log(`VOICES:`, VOICES);
}

// ----------------------------------------------------
// ----------------------------------------------------
