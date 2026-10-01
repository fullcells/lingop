import type { ContentReference } from "../core/misc.js";
import {
  getAPIVoices,
  getSpeechFileURL,
  getVoiceSearchLangSuffixes,
  selectVoiceOptions,
  speakableTextFromDisplayText,
  type APIVoiceAccessProfile,
  type ContentContext,
  type SpeechSynthTTSOptions,
  type SpeechSynthTTSVoice,
} from "./shared.js";

export type DeviceSpeechVoice = {
  service: "DEVICE";
  voice_id: string;
  voice_lang: string;
  name: string;
  quality?: string;
};
export type LingopSpeechVoice = SpeechSynthTTSVoice | DeviceSpeechVoice;
export type SpeechRequest = {
  text: string;
  lang: string;
  contentContext?: ContentContext | undefined;
  ref?: ContentReference | undefined;
};
/** Platform code owns voice enumeration and playback, never language/backend rules. */
export type DeviceSpeechAdapter = {
  getVoices(): Promise<DeviceSpeechVoice[]>;
  speak(
    text: string,
    voice: DeviceSpeechVoice,
    rate: number,
    signal: AbortSignal,
  ): Promise<void>;
  stop(): Promise<void>;
};
export type SpeechAudioAdapter = {
  play(url: string, rate: number, signal: AbortSignal): Promise<void>;
  stop(): Promise<void>;
};
export type SpeechPreferences = {
  voices: Record<string, LingopSpeechVoice>;
  rate: number;
};
export type SpeechControllerOptions = SpeechSynthTTSOptions & {
  device: DeviceSpeechAdapter;
  audio?: SpeechAudioAdapter;
  /** Defaults to NONE; apps explicitly enable their existing API access profile. */
  apiVoiceAccessProfile?: APIVoiceAccessProfile;
  preferences?: Partial<SpeechPreferences>;
  /** The app can persist this snapshot in its own native/web settings store. */
  onPreferencesChange?: (preferences: SpeechPreferences) => void;
};
export type SpeechState = {
  status: "idle" | "loading" | "speaking" | "error";
  owner: object | null;
  error: string | null;
  voice: LingopSpeechVoice | null;
  preferences: SpeechPreferences;
};
export type SpeechVoiceList = {
  voices: LingopSpeechVoice[];
  /** Failure of one source must not hide working voices from the other. */
  errors: string[];
};
const voiceKey = (v: LingopSpeechVoice) =>
  `${v.service}:${v.voice_id}:${v.voice_lang}`;
const normalizeRate = (rate: number) =>
  Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 1;
function matchingDevices(
  lang: string,
  voices: DeviceSpeechVoice[],
): DeviceSpeechVoice[] {
  const result: DeviceSpeechVoice[] = [];
  for (const locale of getVoiceSearchLangSuffixes(lang.toLowerCase())) {
    for (const voice of voices) {
      const actual = voice.voice_lang.toLowerCase().replaceAll("_", "-");
      const expected = locale.toLowerCase();
      if (
        (actual === expected || actual.startsWith(`${expected}-`)) &&
        !result.some((v) => voiceKey(v) === voiceKey(voice))
      )
        result.push(voice);
    }
  }
  return result;
}
function timeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Voice discovery timed out.")),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Speech cancelled"));
    if (signal.aborted) {
      void promise.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

/** One controller per app: device and API speech share selection, speed and cancellation. */
export function createSpeechController(options: SpeechControllerOptions) {
  let state: SpeechState = {
    status: "idle",
    owner: null,
    error: null,
    voice: null,
    preferences: {
      voices: { ...options.preferences?.voices },
      rate: normalizeRate(options.preferences?.rate ?? 1),
    },
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<SpeechState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  let active: AbortController | null = null;
  let stopping: Promise<void> = Promise.resolve();
  const stopPlayback = () => {
    // Serialize native stop calls so an older cancellation cannot stop newer audio.
    stopping = stopping
      .catch(() => {})
      .then(async () => {
        await options.device.stop();
        await options.audio?.stop();
      });
    return stopping;
  };
  const stop = async (owner?: object) => {
    if (owner && state.owner !== owner) return;
    active?.abort();
    active = null;
    update({ status: "idle", owner: null, error: null, voice: null });
    await stopPlayback();
  };
  const listVoices = async (lang: string): Promise<SpeechVoiceList> => {
    const profile = options.apiVoiceAccessProfile ?? "NONE";
    const [device, api] = await Promise.allSettled([
      timeout(options.device.getVoices()),
      profile === "NONE" || !options.audio
        ? Promise.resolve([])
        : timeout(getAPIVoices(options)),
    ]);
    return {
      voices: [
        ...matchingDevices(
          lang,
          device.status === "fulfilled" ? device.value : [],
        ),
        ...selectVoiceOptions(
          lang.toLowerCase(),
          profile,
          api.status === "fulfilled" ? api.value : [],
        ).available.voices.filter((v) => v.service !== "BROWSER"),
      ],
      errors: [device, api].flatMap((result) =>
        result.status === "rejected" ? [String(result.reason)] : [],
      ),
    };
  };
  const speak = async (request: SpeechRequest, owner: object = {}) => {
    active?.abort();
    const operation = new AbortController();
    active = operation;
    const { signal } = operation;
    update({ status: "loading", owner, error: null, voice: null });
    try {
      await abortable(stopPlayback(), signal);
      if (!request.text.trim()) throw new Error("There is no text to speak.");
      const preferred = state.preferences.voices[request.lang.toLowerCase()];
      // Local speech must start without waiting for a cloud request (including offline).
      const devices =
        !preferred || preferred.service === "DEVICE"
          ? await abortable(
              timeout(options.device.getVoices())
                .then((v) => matchingDevices(request.lang, v))
                .catch(() => []),
              signal,
            )
          : [];
      const { voices, errors } = devices.length
        ? { voices: devices as LingopSpeechVoice[], errors: [] }
        : await abortable(listVoices(request.lang), signal);
      if (signal.aborted) return;
      // Never silently substitute a different accent/provider for an explicit preference.
      const voice = preferred
        ? voices.find((v) => voiceKey(v) === voiceKey(preferred))
        : voices[0];
      if (!voice)
        throw new Error(
          preferred
            ? "The selected voice is unavailable. Choose another voice and retry."
            : `No voice is available for this language.${errors.length ? " Voice discovery failed; retry when connected." : ""}`,
        );
      const rate = state.preferences.rate;
      update({ voice });
      if (voice.service === "DEVICE") {
        update({ status: "speaking" });
        await abortable(
          options.device.speak(
            speakableTextFromDisplayText(request),
            voice,
            rate,
            signal,
          ),
          signal,
        );
      } else {
        if (voice.service === "BROWSER" || !options.audio)
          throw new Error("This voice cannot play on this platform.");
        if (
          !request.contentContext ||
          (request.contentContext === "PUBLIC_CONTENT" && !request.ref)
        ) {
          throw new Error(
            "API speech needs a content context and, for public content, a reference.",
          );
        }
        const url = await abortable(
          getSpeechFileURL({ ...request, voice, ...options }),
          signal,
        );
        if (!url) throw new Error("Could not load speech audio. Please retry.");
        if (signal.aborted) return;
        update({ status: "speaking" });
        await abortable(options.audio.play(url, rate, signal), signal);
      }
      if (active === operation) update({ status: "idle", owner: null });
    } catch (error) {
      if (!signal.aborted && active === operation) {
        update({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } finally {
      if (active === operation) active = null;
    }
  };
  const save = (preferences: SpeechPreferences) => {
    update({ preferences });
    options.onPreferencesChange?.(preferences);
  };
  return {
    listVoices,
    speak,
    stop,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setVoice: (lang: string, voice: LingopSpeechVoice | null) => {
      const voices = { ...state.preferences.voices };
      if (voice) voices[lang.toLowerCase()] = voice;
      else delete voices[lang.toLowerCase()];
      save({ ...state.preferences, voices });
    },
    setRate: (rate: number) =>
      save({ ...state.preferences, rate: normalizeRate(rate) }),
    dispose: async () => {
      await stop();
      listeners.clear();
    },
  };
}
export type SpeechController = ReturnType<typeof createSpeechController>;
