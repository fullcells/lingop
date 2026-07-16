// 20260109: Note: .speak with ContentContext as MEMBER_CONTENT is untested atm.

import { getBEApiBaseUrl } from "../../core/backend-api.js";
import { LANGS } from "../../core/language/data/langs.js";
import { deepEqual, ilike, type ContentReference } from "../../core/misc.js";

export const LOCALSTORE_PREF_VOICE_SPEED = "UI_PREF_VOICE_SPEED";
const LOCALSTORE_PREF_VOICES = "UI_PREF_VOICES";

export type SpeechSynthTTSVoice = {
  service: "BROWSER" | "MICROSOFT" | "GOOGLE" | "OPENAI";
  // voice.voiceURI <- for browsers. e.g. Chrome:"Google 粤語（香港）", Safari:"com.apple.voice.compact.en-US.Samantha". In the past, voice.voiceURI might not have necessarily been unique (e.g. "Flo"), but it seems like they've since been fixed to ensure uniqueness: e.g. "Shelley (Japanese (Japan))"
  voice_id: string;
  // ~ currently storing as the full voiceLangCode (e.g. en-US), rather than OA-LangCode (e.g. en)
  voice_lang: string;
};

export type SpeechSynthVoiceOptions = {
  // ↓ To add more data later
  available: {
    voices: SpeechSynthTTSVoice[];
    // defaultBrowserVoice: SpeechSynthTTSVoice|null,
    defaultAPIVoice: SpeechSynthTTSVoice | null;
  };
  unavailableAPIVoices: SpeechSynthTTSVoice[];
};

export type APICreateSpeechInput = {
  lang: string;
  text_for_db: string;
  text_for_tts: string;
  ref: unknown;
  character_label?: string | null;
  voice_prompt: string | null;
  synth_voice: SpeechSynthTTSVoice;
  private_override_key?: string;
};

export type APIVoiceAccessProfile = "NONE" | "ONE_PER_LANG" | "ALL"; // Future:`… | "ALL" | {[lang:string]:SpeechSynthTTSVoice[]}`

export type AudioMetaRow = {
  id: number;
  lang: string;
  text: string;
  filename: string;
  owner_id: string;
  character_label: string | null;
  service: string;
  voice_id: string | null;
  ref: unknown | null;
  created_at: string;
};

export type ContentContext =
  | "MEMBER_CONTENT"
  | "LIMITED_TEMP_ANON"
  | "PUBLIC_CONTENT"; // 20260109: Only used for /utils/speechSynthTTS atm.

type SpeechFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

type SpeechFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<SpeechFetchResponse>;

type SpeechSupabaseSelectResult = {
  data: unknown[] | null;
  error: unknown | null;
};

type SpeechSupabaseQuery = PromiseLike<SpeechSupabaseSelectResult> & {
  eq(column: string, value: unknown): SpeechSupabaseQuery;
  ilike(column: string, value: string): SpeechSupabaseQuery;
};

export type SpeechSynthSupabaseClient = {
  from(table: "audio_meta"): {
    select(columns: string): SpeechSupabaseQuery;
  };
  auth?: {
    getUser?: () => Promise<{
      data: { user: { id: string } | null };
      error?: unknown;
    }>;
    getSession?: () => Promise<{
      data: { session: { access_token: string } | null };
      error?: unknown;
    }>;
  };
};

export type SpeechSynthTTSOptions = {
  fetchImpl?: SpeechFetch;
  supabaseClient?: SpeechSynthSupabaseClient;
  useStagingBackend?: boolean;
};

let userPreferredVoices: Record<string, SpeechSynthTTSVoice> = {};
if (typeof window !== "undefined" && window.localStorage) {
  userPreferredVoices = JSON.parse(localStorage.getItem(LOCALSTORE_PREF_VOICES) ?? "{}") ?? {};
}

// ----------------------------------------------------
// VOICES (Browser, API, User-Preferred)

function getFetch(fetchImpl?: SpeechFetch): SpeechFetch {
  if (fetchImpl) return fetchImpl;
  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required for speech synthesis API calls.");
  }
  return globalThis.fetch.bind(globalThis) as SpeechFetch;
}

function getLocalStorageItem(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return localStorage.getItem(key);
}

// BROWSER VOICES - ORDERED with DEFAULT FIRST (DEV-DESIRE)
let inFlightRawBrowserVoices: Promise<SpeechSynthesisVoice[]> | null = null;

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

function browserVoiceSortScore(v: SpeechSynthesisVoice): number {
  let score = 5;
  const nameUpper = v.name.toUpperCase();

  if (v.default) score = 0;
  else if (nameUpper.includes("GOOGLE")) score = 1;
  else if (nameUpper.includes("PREMIUM")) score = 2;
  else if (nameUpper.includes("MICROSOFT")) score = 3; // untested if this exists on Microsoft - 20260707
  else if (nameUpper.includes("ENHANCED")) score = 4;
  else if (!v.localService) score = 4;

  if (hasVoiceNamePart(v.name, getBrowserVoiceLangNameParts(v.lang))) score += 20;
  if (hasVoiceNamePart(v.name, DEPRIORITIZED_BROWSER_VOICE_NAME_PARTS)) score += 40;

  return score;
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

async function getRawBrowserVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
    return Promise.resolve([]);
  }
  const synth = window.speechSynthesis;

  if (inFlightRawBrowserVoices) return inFlightRawBrowserVoices;

  inFlightRawBrowserVoices = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    // Load Function
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const tryLoad = () => {
      let voices = synth.getVoices();
      if (voices.length) {
        if (timeoutId) clearTimeout(timeoutId);
        if ("onvoiceschanged" in synth) synth.onvoiceschanged = null;
        voices = sortAndDedupeBrowserVoices(voices);
        resolve(voices);
      }
    };
    // 1. Immediate attempt
    tryLoad();
    // 2. Event listener
    if ("onvoiceschanged" in synth) synth.onvoiceschanged = tryLoad;
    // 3. Fallback: resolve with whatever we have after timeout
    timeoutId = setTimeout(() => {
      if ("onvoiceschanged" in synth) synth.onvoiceschanged = null;
      console.warn(`Timed out waiting for browser voices. Timeout duration: ${timeoutMs}`);
      resolve([]);
    }, timeoutMs);
  });
  return inFlightRawBrowserVoices;
}

let inFlightBrowserVoices: Promise<SpeechSynthTTSVoice[]> | null = null;
async function getBrowserVoices(): Promise<SpeechSynthTTSVoice[]> {
  const rawBrowserVoices = await getRawBrowserVoices();
  if (inFlightBrowserVoices) return inFlightBrowserVoices;
  inFlightBrowserVoices = (async () => {
    return rawBrowserVoices.map((bv) => ({
      service: "BROWSER",
      voice_id: bv.voiceURI,
      voice_lang: bv.lang,
    }));
  })();
  return inFlightBrowserVoices;
}

// API VOICES

const siDefaultOpenAIVoice: SpeechSynthTTSVoice = {
  service: "OPENAI",
  voice_id: "cedar",
  voice_lang: "si",
}; // DEV TEMP: manually set until OpenAI Voices can be delivered via BE API // SINHALA
// OPENAI Voice Note: Cedar ♂ and Marin ♀ were released in August 2025. [Ash Ballad, Coral, Sage, Verse] were Oct 2024. [Alloy, Echo, Fable, Onyx, Nova, Shimmer] were Nov 2023 (initial launch). (Different ones are available depending on which TTS API is used).

let inFlightAPIVoices: Promise<SpeechSynthTTSVoice[]> | null = null;
async function getAPIVoices(options: SpeechSynthTTSOptions = {}): Promise<SpeechSynthTTSVoice[]> {
  if (inFlightAPIVoices) return inFlightAPIVoices;

  inFlightAPIVoices = (async () => {
    const fetchUrl = `${getBEApiBaseUrl(options)}/api/get-api-voices`; // `${apiHost}/api/lingoprocessor/translate` // Future: May need to change BE API in future so that it delivers one voice with multiple languages (to make it significantly more compact - as new API Voices (e.g. ElevenLabs, OpenAI, Google, etc. are added))
    const res = await getFetch(options.fetchImpl)(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      let jsonResponse: unknown = {};
      try {
        jsonResponse = JSON.parse(text);
      } catch {
        jsonResponse = { raw: text };
      }
      console.error(`${fetchUrl} failed on \n > ${res.status} - Data: ${JSON.stringify(jsonResponse)}`);
      return [];
    }
    const data = await res.json();
    const voices = Array.isArray(data) ? data.filter(isSpeechSynthTTSVoice) : [];
    voices.push(siDefaultOpenAIVoice); // DEV TEMP: Manually add SINHALA OPENAI Voices (since OpenAI Voices aren't provided )
    return voices;
  })();

  return inFlightAPIVoices;
}

// VOICES - i.e. Browser + API Voices
let inFlightVOICES: Promise<SpeechSynthTTSVoice[]> | null = null;
async function getVOICES(options: SpeechSynthTTSOptions = {}): Promise<SpeechSynthTTSVoice[]> { // ~10,000+ Voices
  if (inFlightVOICES) return inFlightVOICES;
  inFlightVOICES = (async () => {
    const [browserVoices, apiVoices] = await Promise.all([
      getBrowserVoices(),
      getAPIVoices(options),
    ]);
    return [...browserVoices, ...apiVoices];
  })();
  return inFlightVOICES;
}

export async function getVoiceOptionsForLang(
  lang: string,
  apiVoiceAccessProfile: APIVoiceAccessProfile,
  options: SpeechSynthTTSOptions = {},
): Promise<SpeechSynthVoiceOptions> {
  // Lang is treated as a case-insensitive suffix.
  let voiceLangSuffixes = [lang]; // e.g. "en"
  if (lang == "cmn-hans") voiceLangSuffixes = ["zh-cn"];
  if (lang == "cmn-hant") voiceLangSuffixes = ["zh-tw"];
  if (lang == "yue") voiceLangSuffixes = ["zh-hk", "yue"]; // 20260305: Apple seems to be quite sporadic with its Cantonese labels. E.g. on 20260305 it updated its Cantonese voice-lang labels from 'zh-HK' to 'yue-HK'.
  if (lang == "arz") voiceLangSuffixes = ["ar-eg", "arz", "ar"];

  const VOICES = await getVOICES(options);

  const voicesForLang: SpeechSynthTTSVoice[] = [];
  for (const voiceLangSuffix of voiceLangSuffixes) {
    let matches: SpeechSynthTTSVoice[] = [];
    if (voiceLangSuffix.includes("-")) { // e.g. pt-BR
      matches = VOICES.filter((v) =>
        v.voice_lang.toUpperCase().startsWith(voiceLangSuffix.toUpperCase()),
      );
    }
    if (!voiceLangSuffix.includes("-")) { // e.g. 'en'
      matches = VOICES.filter((v) =>
        ilike(v.voice_lang, voiceLangSuffix) || // e.g. exact match 'en'
        v.voice_lang.toUpperCase().startsWith(voiceLangSuffix.toUpperCase() + "-")); // e.g. match 'en-**'
    }
    voicesForLang.push(...matches);
  }

  // Split Voices by if service is BROWSER / NOT-BROWSER
  const browserVoices: SpeechSynthTTSVoice[] = [];
  const apiVoices: SpeechSynthTTSVoice[] = [];
  for (const voice of voicesForLang) {
    if (voice.service == "BROWSER") {
      browserVoices.push(voice);
    } else {
      apiVoices.push(voice);
    }
  }

  // Split API Voices by AVAILABLE or NOT
  let availableAPIVoices: SpeechSynthTTSVoice[] = [];
  let unavailableAPIVoices: SpeechSynthTTSVoice[] = [];
  if (apiVoiceAccessProfile == "NONE") unavailableAPIVoices = apiVoices;
  if (apiVoiceAccessProfile == "ALL") availableAPIVoices = apiVoices;
  if (apiVoiceAccessProfile == "ONE_PER_LANG") {
    // A. Use 'API_VOICE_ACCESS_PROFILE__CAMPLINGOV1' as a basis, if the voice is available
    if (API_VOICE_ACCESS_PROFILE__CAMPLINGOV1[lang]) {
      const profileVoice = API_VOICE_ACCESS_PROFILE__CAMPLINGOV1[lang][0]!;
      // if apiVoices contains profileVoice: set availableAPIVoices to an array with just that item, and unavailableAPIVoices to the rest
      // Find this voice in apiVoices by voice_id and voice_lang
      const match = apiVoices.find((v) =>
        v.voice_id === profileVoice.voice_id && v.voice_lang === profileVoice.voice_lang,
      );
      if (match) {
        availableAPIVoices = [match];
        unavailableAPIVoices = apiVoices.filter((v) => v !== match);
      }
    }
    // B. Fallback on choosing an API Voice as the default
    if (availableAPIVoices.length === 0 && apiVoices.length > 0) { // Assumes service:'MICROSOFT': ↓
      let selected: SpeechSynthTTSVoice | null = null;
      for (const voiceLangSuffix of voiceLangSuffixes) {
        const suffix = voiceLangSuffix.toUpperCase();
        selected = apiVoices.find((v) => {
          const voiceId = v.voice_id.toUpperCase();
          return (
            // 1. Prioritize 'NEURAL' with 'LANG SUFFIX'
            voiceId.includes("NEURAL") && voiceId.startsWith(suffix)) ||
            // 2. Prioritize 'NEURAL'
            voiceId.includes("NEURAL") ||
            // 3. Prioritize 'SUFFIX'
            voiceId.startsWith(suffix);
        }) ?? null;
        if (selected) break;
      }
      selected = selected ?? apiVoices[0]!;
      // Set Available/Unavailable API Voices
      availableAPIVoices = [selected];
      unavailableAPIVoices = apiVoices.filter((v) => v !== selected);
    }
  }

  const availableVoices = [...browserVoices, ...availableAPIVoices];

  return {
    available: {
      voices: availableVoices,
      defaultAPIVoice: availableAPIVoices[0] ?? null,
    },
    unavailableAPIVoices,
  };
}

// USER PREFERRED VOICES
// - ~ SideNote: In the past: USER_PREFERRED_VOICES was stored as localStorage.getItem("_KEY_FAV_WEB_VOICES").
export function updateUserPreferredVoice(lang: string, voice: SpeechSynthTTSVoice): void {
  userPreferredVoices[lang] = voice;
  localStorage.setItem(LOCALSTORE_PREF_VOICES, JSON.stringify(userPreferredVoices));
}

// ----------------------------------------------------
export const BROWSER_VOICES_DEFAULTS: Record<string, SpeechSynthTTSVoice[]> = { // From CAMPLINGO-V1 // Future: To use when picking Voices' BrowserVoices' Default - assuming the browser-voice is available in the browser (not always available) // Future: To use for determining preferred default browser voice (which should, if lang isn't explicitly specified, stil lwork on reducing bad-voice options)
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

export const API_VOICE_ACCESS_PROFILE__CAMPLINGOV1: Record<string, SpeechSynthTTSVoice[]> = {
  ja: [{ service: "MICROSOFT", voice_id: "ja-JP-KeitaNeural", voice_lang: "ja-JP" }],
  es: [{ service: "MICROSOFT", voice_id: "es-CO-GonzaloNeural", voice_lang: "es-CO" }], // Note: Columbian Spanish was selected at the time as it typically was the most neutral-sounding variant of Spanish.
  yue: [{ service: "MICROSOFT", voice_id: "zh-HK-WanLungNeural", voice_lang: "zh-HK" }],
  fil: [{ service: "MICROSOFT", voice_id: "fil-PH-AngeloNeural", voice_lang: "fil-PH" }],
  uz: [{ service: "MICROSOFT", voice_id: "uz-UZ-SardorNeural", voice_lang: "uz-UZ" }],
  kk: [{ service: "MICROSOFT", voice_id: "kk-KZ-DauletNeural", voice_lang: "kk-KZ" }],
  ta: [{ service: "MICROSOFT", voice_id: "ta-LK-KumarNeural", voice_lang: "ta-LK" }],
  ms: [{ service: "MICROSOFT", voice_id: "ms-MY-OsmanNeural", voice_lang: "ms-MY" }],
  eu: [{ service: "MICROSOFT", voice_id: "eu-ES-AinhoaNeural", voice_lang: "eu-ES" }],
  mt: [{ service: "MICROSOFT", voice_id: "mt-MT-JosephNeural", voice_lang: "mt-MT" }],
  gl: [{ service: "MICROSOFT", voice_id: "gl-ES-RoiNeural", voice_lang: "gl-ES" }],
  gu: [{ service: "MICROSOFT", voice_id: "gu-IN-DhwaniNeural", voice_lang: "gu-IN" }],
  mr: [{ service: "MICROSOFT", voice_id: "mr-IN-ManoharNeural", voice_lang: "mr-IN" }],
  mk: [{ service: "MICROSOFT", voice_id: "mk-MK-AleksandarNeural", voice_lang: "mk-MK" }],
  de: [{ service: "MICROSOFT", voice_id: "de-DE-FlorianMultilingualNeural", voice_lang: "de-DE" }],
  mndn: [{ service: "MICROSOFT", voice_id: "zh-TW-YunJheNeural", voice_lang: "zh-TW" }],
  wuu: [{ service: "MICROSOFT", voice_id: "wuu-CN-YunzheNeural", voice_lang: "wuu-CN" }],
  en: [{ service: "MICROSOFT", voice_id: "en-US-AndrewMultilingualNeural", voice_lang: "en-US" }],
  si: [siDefaultOpenAIVoice],
  "cmn-hant": [{ service: "MICROSOFT", voice_id: "zh-TW-HsiaoChenNeural", voice_lang: "zh-TW" }],
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

  // YUE OVERRIDE TO USE API VOICE IF AVAILABLE FOR PROBLEMATIC TEXTS // Potential Future: Browser Voices Improvement: 1. Brute forces-replace characters that should almost always be pronounced a certain way but are currently pronounced incorrectly [彈,近,抹]. 2. We feed in an optional AText - and use the 'spelling' there.
  if (ilike(lang, "yue")) {
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
    await speakBrowserVoice(text, lang, voice);
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
async function preloadSpeechFile(fileURL: string): Promise<HTMLAudioElement> {
  // Reuse if already preloaded
  const cached = audioPreloadCache.get(fileURL);
  if (cached) return cached;

  const audio = new Audio();
  audio.preload = "auto";
  audio.src = fileURL;
  audio.load(); // triggers fetch/buffering

  await new Promise<void>((resolve, reject) => {
    audio.oncanplaythrough = () => resolve(); // enough buffered to play through
    audio.onerror = () => reject(new Error(`Failed to preload audio: ${fileURL}`));
  });

  audioPreloadCache.set(fileURL, audio);
  return audio;
}

async function playSpeechFile(fileURL: string): Promise<void> {
  const audio = audioPreloadCache.get(fileURL) ?? await preloadSpeechFile(fileURL);
  // If this same element was played before, reset it
  audio.currentTime = 0;
  // Speed
  audio.playbackRate = Number(getLocalStorageItem(LOCALSTORE_PREF_VOICE_SPEED)) || 1.0;
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

async function getSpeechFileURL({
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
} & SpeechSynthTTSOptions): Promise<string | undefined> {
  if (!contentContext) {
    console.warn("active voice is a non-browser voice, but no contentContext was provided");
    return;
  }
  // GET AUDIO-META-ROW
  const audioMetaRow = await getAudioMetaRow({ text, lang, contentContext, ref, voice, ...options });
  if (!audioMetaRow) {
    console.error("No AudioMetaRow found nor generated.");
    return;
  }
  // PLAY AudioMetaRow
  const filename = audioMetaRow.filename;
  const fileURL = `https://omnilingual-access.s3.us-east-1.amazonaws.com/audio/${filename}`;
  // console.log(`TO PLAY: ${fileURL}`);
  return fileURL;
}

let audioMetaCache: AudioMetaRow[] = []; // API-Voice Only
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

async function getAudioMetaRow({
  text,
  lang,
  voice,
  contentContext,
  ref,
  ...options
}: {
  text: string;
  lang: string;
  voice: SpeechSynthTTSVoice;
  contentContext?: ContentContext | undefined;
  ref?: ContentReference | undefined;
} & SpeechSynthTTSOptions): Promise<AudioMetaRow | null> {
  // INPUT - For Creating Speech - Only used if Creation required.
  const createSpeechInput: APICreateSpeechInput = {
    lang,
    text_for_db: text,
    text_for_tts: speakableTextFromDisplayText({ lang, text }),
    ref,
    synth_voice: voice,
    character_label: null,
    voice_prompt: null,
  };

  // - LIMITED_TEMP_ANON
  if (contentContext == "LIMITED_TEMP_ANON") {
    // 0. Check Cache for Speech - match_on[text, voice_id]
    const match = audioMetaCache.find((row) => text && ilike(row.text, text) && row.voice_id === voice.voice_id);
    if (match) return match;
    // 1. Skip Fetching
    // 2. Create Limited Anon Speech
    const res2 = await getFetch(options.fetchImpl)("/api/lingoprocessor/speech-create-limited-anon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createSpeechInput),
    });
    if (!res2.ok) {
      console.error(`Failed. Status: ${res2.status} - Data: ${await res2.text()}`);
      return null;
    }
    // Cache AudioMeta and Return
    const createdAudioMeta = parseAudioMetaRow(await res2.json());
    if (!createdAudioMeta) return null;
    audioMetaCache.push(createdAudioMeta);
    return createdAudioMeta;
  }

  // - MEMBER_CONTENT
  if (contentContext == "MEMBER_CONTENT") {
    // 0. Check Cache for Speech - match_on[text, voice_id]
    const match = audioMetaCache.find((row) => text && ilike(row.text, text) && row.voice_id === voice.voice_id);
    if (match) return match;

    if (!options.supabaseClient) {
      console.error("A Supabase client is required for MEMBER_CONTENT speech.");
      return null;
    }

    // 1. Fetch Speech (for Member)
    const supabaseUserID = (await options.supabaseClient.auth?.getUser?.())?.data.user?.id ?? null;
    if (!supabaseUserID) {
      console.error("Supabase User ID couldn't be retrieved.");
      return null;
    }
    const fetchedSpeech = await fetchSpeech({
      lang,
      ref,
      text,
      voice_id: voice.voice_id,
      match_on: ["text", "voice_id"],
      supabase: options.supabaseClient,
      owner_id: supabaseUserID,
    });
    if (fetchedSpeech) return fetchedSpeech;

    // 2. Create Speech (direct BE Call)
    const session = await options.supabaseClient.auth?.getSession?.();
    const accessToken = session?.data.session?.access_token;
    const fetchUrl = `${getBEApiBaseUrl(options)}/api/create-speech`;
    const response = await getFetch(options.fetchImpl)(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(createSpeechInput),
    });
    if (!response.ok) {
      console.error(`Failed. Status: ${response.status} - Data: ${await response.text()}`);
      return null;
    }
    // Cache AudioMeta and Return
    const createdAudioMeta = parseAudioMetaRow(await response.json());
    if (!createdAudioMeta) return null;
    audioMetaCache.push(createdAudioMeta);
    return createdAudioMeta;
  }

  // - PUBLIC_CONTENT
  if (contentContext == "PUBLIC_CONTENT") { // <- must provide REF
    if (!ref) {
      console.error("ref required for PUBLIC_CONTENT");
      return null;
    }
    // 0. Check Cache for Speech - match_on[ref]
    const match = audioMetaCache.find((row) =>
      deepEqual(row.ref, ref) && ilike(row.lang, lang) && ilike(row.text, text),
    );
    if (match) return match;
    // console.log('__getAudioMetaRow: PublicContent: No Match Found: ', ref, lang, text, audioMetaCache);

    // 1. Fetch Public Speech // Future: Can Fetch Multiple from FE first with PUBLIC_DATA_HOLDER_ID
    // 2. Get/Gen Public Speech (can only accept ref - in case it needs to create)
    const getPublicSpeechInput = {
      ref, // <- for t9ns, this is commonly a ref to db=>sb.translation, rather than to an explicit file
      lang,
      synth_voice: voice,
      file_text: text, // <- only relevant if ref is a "file"
    };
    const res2 = await getFetch(options.fetchImpl)("/api/lingoprocessor/speech-get-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getPublicSpeechInput),
    });
    if (!res2.ok) {
      console.error(`Failed. Status: ${res2.status} - Data: ${await res2.text()}`);
      return null;
    }
    // Cache AudioMeta and Return
    const publicAudioMeta = parseAudioMetaRow(await res2.json());
    if (!publicAudioMeta) return null;
    audioMetaCache.push(publicAudioMeta);
    // - brute fix to remember original ref incase new one from /speech-get-public doesn't match (mismatch can happen when there are multiple translations with the same target_text (e.g. differing in source_text by case/slight-words that results in same target_lang translation)):
    if (!deepEqual(ref, publicAudioMeta.ref)) audioMetaCache.push({ ...publicAudioMeta, ref }); // add copy of audio-cache with original ref data. // <- Later: this could also be applied to other *_CONTENT types above.
    return publicAudioMeta;
  }

  return null;
}

export function speakableTextFromDisplayText({
  lang,
  text,
}: {
  lang: string;
  text: string;
}): string {
  // (currently replace "_" sequences) // <- added for LingoDexV2
  let speakableText = text;
  let underscoresReplacement = "";
  if (ilike(lang, "en")) underscoresReplacement = "hmm";
  if (ilike(lang, "es")) underscoresReplacement = "mmm";
  if (ilike(lang, "yue")) underscoresReplacement = "嗯";
  if (ilike(lang, "ja")) underscoresReplacement = "うーん";
  // if (ilike(lang,'el')) underscoresReplacement = 'χμμ'; // browser tts doesn't pronounce this correctly, so omitting
  speakableText = speakableText.replace(/_+/g, underscoresReplacement);
  return speakableText;
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

  // Clear the Queue (mainly since Google Chrome can get 'stuck')
  speechSynthesis.cancel();

  // Get browser voice
  const rawBrowserVoices = await getRawBrowserVoices();
  const speechSynthVoice = rawBrowserVoices.find((bv) => bv.voiceURI == voice.voice_id);
  if (!speechSynthVoice) {
    console.error("Browser Voice couldn't be refound", voice);
    return;
  } // shouldn't happen

  // Process Text - (currently replace "_" sequences)
  text = speakableTextFromDisplayText({ lang, text });

  // Override Texts
  if (ilike(lang, "ja") && voice.voice_id == "Google 日本語" && text == "男") {
    text = "男。"; // This forces it to pronounce it as "おとこ" as opposed to just "お".
  }

  // Speak and await completion
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = speechSynthVoice;
  const speed = Number(getLocalStorageItem(LOCALSTORE_PREF_VOICE_SPEED)) || 1.0;
  utterance.rate = speed;
  await new Promise<void>((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // (event) => reject(event); // not throwing reject for now: .onerror will occur if user interrupts the utterance and requests TTS on another thing, which is quite common.
    speechSynthesis.speak(utterance);
  });
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
export async function fetchSpeech({
  lang,
  ref,
  text,
  voice_id,
  match_on,
  supabase,
  owner_id,
}: {
  lang: string;
  ref: unknown;
  text?: string;
  voice_id?: string;
  match_on: ("text" | "ref" | "voice_id")[];
  supabase: SpeechSynthSupabaseClient;
  owner_id: string;
}): Promise<AudioMetaRow | null> {
  // FUTURE: Update this to be 'fetchSpeech[es]': INPUT: lang, match_on, items{text,ref,voice_id}. OUTPUT: items: (AudioMetaRow|null)[]

  // CHECKS
  if (!match_on.length) {
    console.warn("fetchSpeeches can not have empty match_on");
    return null;
  }
  if (match_on.includes("text") && !text) {
    console.warn("match_on text missing");
    return null;
  }
  if (match_on.includes("voice_id") && !voice_id) {
    console.warn("match_on voice_id missing");
    return null;
  }

  // -----------------------------------------
  // 1. Select based on match_on values
  let query = supabase
    .from("audio_meta")
    .select("id, lang, text, filename, owner_id, character_label, service, voice_id, ref, created_at")
    .eq("lang", lang)
    .eq("owner_id", owner_id);
  if (match_on.includes("text")) query = query.ilike("text", text!);
  if (match_on.includes("ref")) query = query.eq("ref", JSON.stringify(ref));
  const { data, error } = await query;
  if (error) {
    console.error("sb select error", error);
    return null;
  }
  const rows = (data ?? []).filter(isAudioMetaRow);
  if (rows.length == 0) return null;

  // 2. Return exact if only one match
  if (rows.length == 1) return rows[0]!;

  // 3. Prioritize row that matches other values, that weren't in match_on
  const scored = rows.map((row) => {
    let matchCount = 0;
    const matches = { text: false, voice_id: false, ref: false };
    // Check additional matches not in match_on
    if (!match_on.includes("text") && text && row.text?.toLowerCase() === text.toLowerCase()) {
      matchCount++;
      matches.text = true;
    }
    if (!match_on.includes("voice_id") && voice_id && row.voice_id === voice_id) {
      matchCount++;
      matches.voice_id = true;
    }
    if (!match_on.includes("ref") && ref && row.ref === JSON.stringify(ref)) {
      matchCount++;
      matches.ref = true;
    }
    return { row, matchCount, matches };
  });

  // Sort by match count (most matches first), then text match, then voice_id match, then newest
  scored.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    if (a.matches.text !== b.matches.text) return a.matches.text ? -1 : 1;
    if (a.matches.voice_id !== b.matches.voice_id) return a.matches.voice_id ? -1 : 1;
    return new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime();
  });

  // Return
  return scored[0]!.row;
}

function isSpeechSynthTTSVoice(value: unknown): value is SpeechSynthTTSVoice {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<SpeechSynthTTSVoice>;
  return (
    (candidate.service === "BROWSER" ||
      candidate.service === "MICROSOFT" ||
      candidate.service === "GOOGLE" ||
      candidate.service === "OPENAI") &&
    typeof candidate.voice_id === "string" &&
    typeof candidate.voice_lang === "string"
  );
}

function parseAudioMetaRow(value: unknown): AudioMetaRow | null {
  return isAudioMetaRow(value) ? value : null;
}

function isAudioMetaRow(value: unknown): value is AudioMetaRow {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<AudioMetaRow>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.lang === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.filename === "string" &&
    typeof candidate.owner_id === "string" &&
    (typeof candidate.character_label === "string" || candidate.character_label === null) &&
    typeof candidate.service === "string" &&
    (typeof candidate.voice_id === "string" || candidate.voice_id === null) &&
    typeof candidate.created_at === "string"
  );
}
