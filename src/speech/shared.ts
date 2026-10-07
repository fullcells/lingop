import type { BackendTarget } from "../core/backend-api.js";
import { getBEApiBaseUrl } from "../core/backend-api.js";
import { LANGS } from "../core/language/data/langs.js";
import { ilike, type ContentReference } from "../core/misc.js";
import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
} from "../core/supabase.js";

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

export type SpeechSynthSupabaseClient = SupabaseClientLike;

export type SpeechSynthTTSOptions = {
  fetchImpl?: SpeechFetch;
  supabaseClient?: SpeechSynthSupabaseClient;
  backendTarget?: BackendTarget | undefined;
  useStagingBackend?: boolean | undefined;
};

function getFetch(fetchImpl?: SpeechFetch): SpeechFetch {
  if (fetchImpl) return fetchImpl;
  if (!globalThis.fetch) {
    throw new Error(
      "A fetch implementation is required for speech synthesis API calls.",
    );
  }
  return globalThis.fetch.bind(globalThis) as SpeechFetch;
}

// API VOICES

const siDefaultOpenAIVoice: SpeechSynthTTSVoice = {
  service: "OPENAI",
  voice_id: "cedar",
  voice_lang: "si",
}; // DEV TEMP: manually set until OpenAI Voices can be delivered via BE API // SINHALA
// OPENAI Voice Note: Cedar ♂ and Marin ♀ were released in August 2025. [Ash Ballad, Coral, Sage, Verse] were Oct 2024. [Alloy, Echo, Fable, Onyx, Nova, Shimmer] were Nov 2023 (initial launch). (Different ones are available depending on which TTS API is used).

const apiVoiceRequests = new Map<string, Promise<SpeechSynthTTSVoice[]>>();
export async function getAPIVoices(
  options: SpeechSynthTTSOptions = {},
): Promise<SpeechSynthTTSVoice[]> {
  const key = JSON.stringify([
    getBEApiBaseUrl(options),
    getRequestOptionIdentity(options.fetchImpl),
  ]);
  const cached = apiVoiceRequests.get(key);
  if (cached) return cached;

  const request = (async () => {
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
      console.error(
        `${fetchUrl} failed on \n > ${res.status} - Data: ${JSON.stringify(jsonResponse)}`,
      );
      throw new Error(`API voice request failed with status ${res.status}.`);
    }
    const data = await res.json();
    const voices = Array.isArray(data)
      ? data.filter(isSpeechSynthTTSVoice)
      : [];
    voices.push(siDefaultOpenAIVoice); // DEV TEMP: Manually add SINHALA OPENAI Voices (since OpenAI Voices aren't provided )
    return voices;
  })();

  apiVoiceRequests.set(key, request);
  try {
    return await request;
  } catch (error) {
    // A temporary network/backend failure must not poison later voice lookups.
    if (apiVoiceRequests.get(key) === request) apiVoiceRequests.delete(key);
    throw error;
  }
}

export function getVoiceSearchLangSuffixes(lang: string): string[] {
  // Note: Suffixes are used in a case-insensitive manner.
  // A. Old Brute Overrides
  if (lang == "cmn-hans") return ["zh-cn"];
  if (lang == "cmn-hant") return ["zh-tw"];
  if (lang == "yue") return ["zh-hk", "yue"];
  if (lang == "arz") return ["ar-eg", "arz", "ar"];

  // B. New Scalable Standard way for getting Voice Search Suffixes (from LANGS.mttslocale_main + LANGS.mttslocale_options)
  const langEntry = LANGS.find(
    (l) => l.gcode_main.toLowerCase() === lang.toLowerCase(),
  );

  const mttsFallbacks = [
    langEntry?.mttslocale_main,
    ...(langEntry?.mttslocale_options?.split(",") ?? []),
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);

  // De-dupe while preserving order (mttslocale_main/options can overlap, e.g. tok's are identical)
  const seen = new Set<string>();
  const suffixes: string[] = [];
  for (const suffix of [lang, ...mttsFallbacks]) {
    const key = suffix.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suffixes.push(suffix);
  }
  return suffixes;
}

export const API_VOICE_ACCESS_PROFILE__CAMPLINGOV1: Record<
  string,
  SpeechSynthTTSVoice[]
> = {
  ja: [
    {
      service: "MICROSOFT",
      voice_id: "ja-JP-KeitaNeural",
      voice_lang: "ja-JP",
    },
  ],
  es: [
    {
      service: "MICROSOFT",
      voice_id: "es-CO-GonzaloNeural",
      voice_lang: "es-CO",
    },
  ], // Note: Columbian Spanish was selected at the time as it typically was the most neutral-sounding variant of Spanish.
  yue: [
    {
      service: "MICROSOFT",
      voice_id: "zh-HK-WanLungNeural",
      voice_lang: "zh-HK",
    },
  ],
  fil: [
    {
      service: "MICROSOFT",
      voice_id: "fil-PH-AngeloNeural",
      voice_lang: "fil-PH",
    },
  ],
  uz: [
    {
      service: "MICROSOFT",
      voice_id: "uz-UZ-SardorNeural",
      voice_lang: "uz-UZ",
    },
  ],
  kk: [
    {
      service: "MICROSOFT",
      voice_id: "kk-KZ-DauletNeural",
      voice_lang: "kk-KZ",
    },
  ],
  ta: [
    {
      service: "MICROSOFT",
      voice_id: "ta-LK-KumarNeural",
      voice_lang: "ta-LK",
    },
  ],
  ms: [
    {
      service: "MICROSOFT",
      voice_id: "ms-MY-OsmanNeural",
      voice_lang: "ms-MY",
    },
  ],
  eu: [
    {
      service: "MICROSOFT",
      voice_id: "eu-ES-AinhoaNeural",
      voice_lang: "eu-ES",
    },
  ],
  mt: [
    {
      service: "MICROSOFT",
      voice_id: "mt-MT-JosephNeural",
      voice_lang: "mt-MT",
    },
  ],
  gl: [
    { service: "MICROSOFT", voice_id: "gl-ES-RoiNeural", voice_lang: "gl-ES" },
  ],
  gu: [
    {
      service: "MICROSOFT",
      voice_id: "gu-IN-DhwaniNeural",
      voice_lang: "gu-IN",
    },
  ],
  mr: [
    {
      service: "MICROSOFT",
      voice_id: "mr-IN-ManoharNeural",
      voice_lang: "mr-IN",
    },
  ],
  mk: [
    {
      service: "MICROSOFT",
      voice_id: "mk-MK-AleksandarNeural",
      voice_lang: "mk-MK",
    },
  ],
  de: [
    {
      service: "MICROSOFT",
      voice_id: "de-DE-FlorianMultilingualNeural",
      voice_lang: "de-DE",
    },
  ],
  mndn: [
    {
      service: "MICROSOFT",
      voice_id: "zh-TW-YunJheNeural",
      voice_lang: "zh-TW",
    },
  ],
  wuu: [
    {
      service: "MICROSOFT",
      voice_id: "wuu-CN-YunzheNeural",
      voice_lang: "wuu-CN",
    },
  ],
  en: [
    {
      service: "MICROSOFT",
      voice_id: "en-US-AndrewMultilingualNeural",
      voice_lang: "en-US",
    },
  ],
  si: [siDefaultOpenAIVoice],
  "cmn-hant": [
    {
      service: "MICROSOFT",
      voice_id: "zh-TW-HsiaoChenNeural",
      voice_lang: "zh-TW",
    },
  ],
};

export function selectVoiceOptions(
  lang: string,
  apiVoiceAccessProfile: APIVoiceAccessProfile,
  VOICES: SpeechSynthTTSVoice[],
): SpeechSynthVoiceOptions {
  const voiceLangSuffixes = getVoiceSearchLangSuffixes(lang);
  const voicesForLang: SpeechSynthTTSVoice[] = [];
  const matchedVoiceKeys = new Set<string>();
  for (const voiceLangSuffix of voiceLangSuffixes) {
    let matches: SpeechSynthTTSVoice[] = [];
    if (voiceLangSuffix.includes("-")) {
      // e.g. pt-BR
      matches = VOICES.filter((v) =>
        v.voice_lang.toUpperCase().startsWith(voiceLangSuffix.toUpperCase()),
      );
    }
    if (!voiceLangSuffix.includes("-")) {
      // e.g. 'en'
      matches = VOICES.filter(
        (v) =>
          ilike(v.voice_lang, voiceLangSuffix) || // e.g. exact match 'en'
          v.voice_lang
            .toUpperCase()
            .startsWith(voiceLangSuffix.toUpperCase() + "-"),
      ); // e.g. match 'en-**'
    }
    for (const voice of matches) {
      // A voice may match both the language and one of its locale fallbacks
      // (for example, Japanese voices match both `ja` and `ja-JP`). Keep the
      // public voice identity unique after combining those searches.
      const key = `${voice.service}\u0000${voice.voice_id}\u0000${voice.voice_lang}`;
      if (matchedVoiceKeys.has(key)) continue;
      matchedVoiceKeys.add(key);
      voicesForLang.push(voice);
    }
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
      const match = apiVoices.find(
        (v) =>
          v.voice_id === profileVoice.voice_id &&
          v.voice_lang === profileVoice.voice_lang,
      );
      if (match) {
        availableAPIVoices = [match];
        unavailableAPIVoices = apiVoices.filter((v) => v !== match);
      }
    }
    // B. Fallback on choosing an API Voice as the default
    if (availableAPIVoices.length === 0 && apiVoices.length > 0) {
      // Assumes service:'MICROSOFT': ↓
      let selected: SpeechSynthTTSVoice | null = null;
      for (const voiceLangSuffix of voiceLangSuffixes) {
        const suffix = voiceLangSuffix.toUpperCase();
        selected =
          apiVoices.find((v) => {
            const voiceId = v.voice_id.toUpperCase();
            return (
              // 1. Prioritize 'NEURAL' with 'LANG SUFFIX'
              (voiceId.includes("NEURAL") && voiceId.startsWith(suffix)) ||
              // 2. Prioritize 'NEURAL'
              voiceId.includes("NEURAL") ||
              // 3. Prioritize 'SUFFIX'
              voiceId.startsWith(suffix)
            );
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

export async function getSpeechFileURL({
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
    console.warn(
      "API speech metadata cannot be resolved without a contentContext.",
      {
        text,
        lang,
        ref,
        voice,
      },
    );
    return;
  }
  // GET AUDIO-META-ROW
  const audioMetaRow = await getAudioMetaRow({
    text,
    lang,
    contentContext,
    ref,
    voice,
    ...options,
  });
  if (!audioMetaRow) return;
  // PLAY AudioMetaRow
  const filename = audioMetaRow.filename;
  const fileURL = `https://omnilingual-access.s3.us-east-1.amazonaws.com/audio/${filename}`;
  // console.log(`TO PLAY: ${fileURL}`);
  return fileURL;
}

const audioMetaCache = new Map<string, AudioMetaRow>();
const audioMetaInFlight = new Map<string, Promise<AudioMetaRow | null>>();
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
  const request = { text, lang, voice, contentContext, ref };
  const requestKey = getAudioMetaRequestKey(request, options);
  const cached = audioMetaCache.get(requestKey);
  if (cached) return cached;
  const inFlight = audioMetaInFlight.get(requestKey);
  if (inFlight) return inFlight;

  const resolutionPromise = resolveAudioMetaRow({
    ...request,
    ...options,
  }).catch((error: unknown) => {
    console.error("Audio metadata resolution threw an unexpected error.", {
      request,
      error,
    });
    return null;
  });

  audioMetaInFlight.set(requestKey, resolutionPromise);
  try {
    const resolved = await resolutionPromise;
    if (resolved) audioMetaCache.set(requestKey, resolved);
    return resolved;
  } finally {
    if (audioMetaInFlight.get(requestKey) === resolutionPromise) {
      audioMetaInFlight.delete(requestKey);
    }
  }
}

async function resolveAudioMetaRow({
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
    // 1. Skip Fetching
    // 2. Create Limited Anon Speech
    const apiBaseUrl = getBEApiBaseUrl(options);
    const endpoint = `${apiBaseUrl}/api/speech-create-limited-anon`;
    const res2 = await getFetch(options.fetchImpl)(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createSpeechInput),
    });
    if (!res2.ok) {
      await logAudioMetaResponseFailure({
        endpoint,
        response: res2,
        request: { text, lang, contentContext, ref, voice },
      });
      return null;
    }
    // Cache AudioMeta and Return
    const createdAudioMeta = await parseAudioMetaResponse({
      endpoint,
      response: res2,
      request: { text, lang, contentContext, ref, voice },
    });
    if (!createdAudioMeta) return null;
    return createdAudioMeta;
  }

  // - MEMBER_CONTENT
  if (contentContext == "MEMBER_CONTENT") {
    // 0. Check Cache for Speech - match_on[text, voice_id]

    const runtimeSupabaseClient = asSupabaseRuntimeClient(
      options.supabaseClient,
    );
    if (!runtimeSupabaseClient) {
      console.error(
        "Audio metadata resolution requires a Supabase client for MEMBER_CONTENT.",
        {
          request: { text, lang, contentContext, ref, voice },
        },
      );
      return null;
    }

    // 1. Fetch Speech (for Member)
    const supabaseUserID =
      (await runtimeSupabaseClient.auth?.getUser?.())?.data.user?.id ?? null;
    if (!supabaseUserID) {
      console.error(
        "Audio metadata resolution could not retrieve the Supabase user ID.",
        {
          request: { text, lang, contentContext, ref, voice },
        },
      );
      return null;
    }
    const fetchedSpeech = await fetchSpeech({
      lang,
      ref,
      text,
      voice_id: voice.voice_id,
      match_on: ["text", "voice_id"],
      supabase: runtimeSupabaseClient,
      owner_id: supabaseUserID,
    });
    if (fetchedSpeech) return fetchedSpeech;

    // 2. Create Speech (direct BE Call)
    const session = await runtimeSupabaseClient.auth?.getSession?.();
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
      await logAudioMetaResponseFailure({
        endpoint: fetchUrl,
        response,
        request: { text, lang, contentContext, ref, voice },
      });
      return null;
    }
    // Cache AudioMeta and Return
    const createdAudioMeta = await parseAudioMetaResponse({
      endpoint: fetchUrl,
      response,
      request: { text, lang, contentContext, ref, voice },
    });
    if (!createdAudioMeta) return null;
    return createdAudioMeta;
  }

  // - PUBLIC_CONTENT
  if (contentContext == "PUBLIC_CONTENT") {
    // <- must provide REF
    if (!ref) {
      console.error(
        "Audio metadata resolution requires a ref for PUBLIC_CONTENT.",
        {
          request: { text, lang, contentContext, ref, voice },
        },
      );
      return null;
    }
    // 0. Check Cache for Speech - match_on[ref]
    // console.log('__getAudioMetaRow: PublicContent: No Match Found: ', ref, lang, text, audioMetaCache);

    // 1. Fetch Public Speech // Future: Can Fetch Multiple from FE first with PUBLIC_DATA_HOLDER_ID
    // 2. Get/Gen Public Speech (can only accept ref - in case it needs to create)
    const getPublicSpeechInput = {
      ref, // <- for t9ns, this is commonly a ref to db=>sb.translation, rather than to an explicit file
      lang,
      synth_voice: voice,
      file_text: text, // <- only relevant if ref is a "file"
    };
    const apiBaseUrl = getBEApiBaseUrl(options);
    const endpoint = `${apiBaseUrl}/api/speech-get-public`;
    const res2 = await getFetch(options.fetchImpl)(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getPublicSpeechInput),
    });
    if (!res2.ok) {
      await logAudioMetaResponseFailure({
        endpoint,
        response: res2,
        request: { text, lang, contentContext, ref, voice },
      });
      return null;
    }
    // Cache AudioMeta and Return
    const publicAudioMeta = await parseAudioMetaResponse({
      endpoint,
      response: res2,
      request: { text, lang, contentContext, ref, voice },
    });
    if (!publicAudioMeta) return null;
    return publicAudioMeta;
  }

  console.error(
    "Audio metadata resolution received an unsupported contentContext.",
    {
      request: { text, lang, contentContext, ref, voice },
    },
  );
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
  supabase: SupabaseClientLike;
  owner_id: string;
}): Promise<AudioMetaRow | null> {
  // FUTURE: Update this to be 'fetchSpeech[es]': INPUT: lang, match_on, items{text,ref,voice_id}. OUTPUT: items: (AudioMetaRow|null)[]
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabase);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to fetch speech.");
    return null;
  }

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
  let query = runtimeSupabaseClient
    .from("audio_meta")
    .select(
      "id, lang, text, filename, owner_id, character_label, service, voice_id, ref, created_at",
    )
    .eq("lang", lang)
    .eq("owner_id", owner_id);
  if (match_on.includes("voice_id")) query = query.eq("voice_id", voice_id!);
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
    if (
      !match_on.includes("text") &&
      text &&
      row.text?.toLowerCase() === text.toLowerCase()
    ) {
      matchCount++;
      matches.text = true;
    }
    if (
      !match_on.includes("voice_id") &&
      voice_id &&
      row.voice_id === voice_id
    ) {
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
    if (a.matches.voice_id !== b.matches.voice_id)
      return a.matches.voice_id ? -1 : 1;
    return (
      new Date(b.row.created_at).getTime() -
      new Date(a.row.created_at).getTime()
    );
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

type AudioMetaRequestDetails = {
  text: string;
  lang: string;
  voice: SpeechSynthTTSVoice;
  contentContext?: ContentContext | undefined;
  ref?: ContentReference | undefined;
};

const requestOptionIdentities = new WeakMap<object, number>();
let nextRequestOptionIdentity = 1;

function getRequestOptionIdentity(value: unknown): number | null {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return null;
  }
  const identityTarget = value as object;
  const existing = requestOptionIdentities.get(identityTarget);
  if (existing) return existing;
  const identity = nextRequestOptionIdentity++;
  requestOptionIdentities.set(identityTarget, identity);
  return identity;
}

function getAudioMetaRequestKey(
  request: AudioMetaRequestDetails,
  options: SpeechSynthTTSOptions,
): string {
  return stableSerialize({
    contentContext: request.contentContext,
    lang: request.lang.toLowerCase(),
    text: request.text.toLowerCase(),
    ref: request.ref,
    voice: request.voice,
    apiBaseUrl: getBEApiBaseUrl(options),
    fetchImplIdentity: getRequestOptionIdentity(options.fetchImpl),
    supabaseClientIdentity: getRequestOptionIdentity(options.supabaseClient),
  });
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableSerialize(entryValue)}`,
    )
    .join(",")}}`;
}

async function logAudioMetaResponseFailure({
  endpoint,
  response,
  request,
}: {
  endpoint: string;
  response: SpeechFetchResponse;
  request: AudioMetaRequestDetails;
}): Promise<void> {
  let responseBody: string;
  try {
    responseBody = await response.text();
  } catch (error) {
    responseBody = `[response body could not be read: ${String(error)}]`;
  }
  console.error("Audio metadata endpoint rejected the request.", {
    endpoint,
    status: response.status,
    responseBody,
    request,
  });
}

async function parseAudioMetaResponse({
  endpoint,
  response,
  request,
}: {
  endpoint: string;
  response: SpeechFetchResponse;
  request: AudioMetaRequestDetails;
}): Promise<AudioMetaRow | null> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("Audio metadata endpoint returned invalid JSON.", {
      endpoint,
      status: response.status,
      error,
      request,
    });
    return null;
  }

  const audioMetaRow = parseAudioMetaRow(payload);
  if (!audioMetaRow) {
    console.error("Audio metadata endpoint returned an invalid AudioMetaRow.", {
      endpoint,
      status: response.status,
      payload,
      request,
    });
    return null;
  }
  return audioMetaRow;
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
    (typeof candidate.character_label === "string" ||
      candidate.character_label === null) &&
    typeof candidate.service === "string" &&
    (typeof candidate.voice_id === "string" || candidate.voice_id === null) &&
    typeof candidate.created_at === "string"
  );
}
