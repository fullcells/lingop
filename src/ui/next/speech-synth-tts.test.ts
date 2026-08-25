import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_USER_PREFERRED_VOICE_SPEED,
  fetchSpeech,
  getUserPreferredVoiceSpeed,
  MAX_USER_PREFERRED_VOICE_SPEED,
  MIN_USER_PREFERRED_VOICE_SPEED,
  preloadSpeech,
  prettifyVoiceId,
  setUserPreferredVoiceSpeed,
  speakableTextFromDisplayText,
  type AudioMetaRow,
  type SpeechSynthSupabaseClient,
  type SpeechSynthTTSOptions,
} from "./speech-synth-tts.js";
import { BE_API_PRODUCTION_URL, BE_API_STAGING_URL } from "../../core/backend-api.js";

type SpeechSupabaseSelectResult = {
  data: unknown[] | null;
  error: unknown | null;
};

type SpeechSupabaseQuery = PromiseLike<SpeechSupabaseSelectResult> & {
  eq(column: string, value: unknown): SpeechSupabaseQuery;
  ilike(column: string, value: string): SpeechSupabaseQuery;
};

const baseRow: AudioMetaRow = {
  id: 1,
  lang: "en",
  text: "hello",
  filename: "hello.mp3",
  owner_id: "owner-1",
  character_label: null,
  service: "MICROSOFT",
  voice_id: "en-US-AndrewMultilingualNeural",
  ref: { db: { table: "translations", column: "target_text", id: 1 } },
  created_at: "2026-01-01T00:00:00.000Z",
};

function makeQuery(rows: AudioMetaRow[]): SpeechSupabaseQuery {
  const filters: Array<[string, unknown, "eq" | "ilike"]> = [];

  const query: SpeechSupabaseQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value, "eq"]);
      return query;
    }),
    ilike: vi.fn((column: string, value: string) => {
      filters.push([column, value, "ilike"]);
      return query;
    }),
    then: (resolve, reject) => {
      const filteredRows = rows.filter((row) =>
        filters.every(([column, value, operator]) => {
          const rowValue = row[column as keyof AudioMetaRow];
          if (operator === "ilike") {
            return String(rowValue).toLowerCase() === String(value).toLowerCase();
          }
          return rowValue === value;
        }),
      );
      const result: SpeechSupabaseSelectResult = {
        data: filteredRows,
        error: null,
      };
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return query;
}

function makeSupabaseClient(rows: AudioMetaRow[]): SpeechSynthSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeQuery(rows)),
    })),
  };
}

describe("speech synth TTS", () => {
  it("owns validated user-preferred voice-speed persistence", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    expect(getUserPreferredVoiceSpeed()).toBe(DEFAULT_USER_PREFERRED_VOICE_SPEED);
    expect(setUserPreferredVoiceSpeed(1.4)).toBe(1.4);
    expect(getUserPreferredVoiceSpeed()).toBe(1.4);
    expect(setUserPreferredVoiceSpeed(99)).toBe(MAX_USER_PREFERRED_VOICE_SPEED);
    expect(setUserPreferredVoiceSpeed(-1)).toBe(MIN_USER_PREFERRED_VOICE_SPEED);
    expect(setUserPreferredVoiceSpeed(Number.NaN)).toBe(
      DEFAULT_USER_PREFERRED_VOICE_SPEED,
    );

    vi.unstubAllGlobals();
  });

  it("makes display text speakable for underscore blanks", () => {
    expect(speakableTextFromDisplayText({ lang: "en", text: "I ___ know" })).toBe(
      "I hmm know",
    );
    expect(speakableTextFromDisplayText({ lang: "yue", text: "我__" })).toBe("我嗯");
  });

  it("prettifies provider voice ids", () => {
    expect(prettifyVoiceId("en-US-AndrewMultilingualNeural:DragonNeural")).toBe(
      "Andrew Multilingual Neural",
    );
  });

  it("creates limited anonymous speech through the canonical backend", async () => {
    class FakeAudio {
      preload = "";
      src = "";
      currentTime = 0;
      playbackRate = 1;
      oncanplaythrough: (() => void) | null = null;
      onerror: (() => void) | null = null;

      load() {
        queueMicrotask(() => this.oncanplaythrough?.());
      }

      addEventListener() {}
      removeEventListener() {}
      play() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Audio", FakeAudio);

    const fetchImpl: NonNullable<SpeechSynthTTSOptions["fetchImpl"]> = vi.fn(async (input, init) => {
      if (input.endsWith("/api/get-api-voices")) {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => [{
            service: "MICROSOFT",
            voice_id: "en-US-AndrewMultilingualNeural",
            voice_lang: "en-US",
          }],
        };
      }
      const requestBody = JSON.parse(init?.body ?? "{}") as { text_for_db?: string };
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          ...baseRow,
          text: requestBody.text_for_db ?? baseRow.text,
          filename: `${requestBody.text_for_db ?? "limited"}.mp3`,
          ref: { isTempAnon: true },
        }),
      };
    });

    await preloadSpeech({
      text: "limited production speech",
      lang: "en",
      apiVoiceAccessProfile: "ONE_PER_LANG",
      contentContext: "LIMITED_TEMP_ANON",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/speech-create-limited-anon`,
      expect.objectContaining({ method: "POST" }),
    );

    await preloadSpeech({
      text: "limited staging speech",
      lang: "en",
      apiVoiceAccessProfile: "ONE_PER_LANG",
      contentContext: "LIMITED_TEMP_ANON",
      useStagingBackend: true,
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_STAGING_URL}/api/speech-create-limited-anon`,
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });

  it("fetches and prioritizes the closest speech row", async () => {
    const supabase = makeSupabaseClient([
      {
        ...baseRow,
        id: 1,
        text: "hello",
        voice_id: "en-US-OtherNeural",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        ...baseRow,
        id: 2,
        text: "hello",
        voice_id: "en-US-AndrewMultilingualNeural",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    await expect(
      fetchSpeech({
        lang: "en",
        ref: baseRow.ref,
        text: "hello",
        voice_id: "en-US-AndrewMultilingualNeural",
        match_on: ["text"],
        supabase,
        owner_id: "owner-1",
      }),
    ).resolves.toMatchObject({
      id: 2,
      voice_id: "en-US-AndrewMultilingualNeural",
    });
  });

  it("deduplicates concurrent metadata and audio preload requests", async () => {
    let publicSpeechRequestCount = 0;
    let audioConstructionCount = 0;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    class FakeAudio {
      preload = "";
      src = "";
      oncanplaythrough: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        audioConstructionCount++;
      }

      load() {
        queueMicrotask(() => this.oncanplaythrough?.());
      }
    }
    vi.stubGlobal("Audio", FakeAudio);

    const fetchImpl: NonNullable<SpeechSynthTTSOptions["fetchImpl"]> = vi.fn(async (input, init) => {
      if (input.endsWith("/api/get-api-voices")) {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => [{
            service: "MICROSOFT",
            voice_id: "en-US-AndrewMultilingualNeural",
            voice_lang: "en-US",
          }],
        };
      }

      publicSpeechRequestCount++;
      const requestBody = JSON.parse(init?.body ?? "{}") as { file_text?: string };
      const payload = requestBody.file_text === "invalid response"
        ? { unexpected: true }
        : baseRow;
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => payload,
      };
    });

    const request = {
      text: "hello",
      lang: "en",
      apiVoiceAccessProfile: "ONE_PER_LANG" as const,
      contentContext: "PUBLIC_CONTENT" as const,
      ref: baseRow.ref as { db: { table: string; column: string; id: number } },
      fetchImpl,
    };
    await Promise.all([
      preloadSpeech(request),
      preloadSpeech(request),
    ]);

    expect(publicSpeechRequestCount).toBe(1);
    expect(audioConstructionCount).toBe(1);

    await preloadSpeech({
      ...request,
      text: "invalid response",
      ref: { db: { table: "translations", column: "target_text", id: 2 } },
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Audio metadata endpoint returned an invalid AudioMetaRow.",
      expect.objectContaining({
        endpoint: `${BE_API_PRODUCTION_URL}/api/speech-get-public`,
        status: 200,
        payload: { unexpected: true },
      }),
    );

    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("discovers browser voices without requesting API voices for the NONE profile", async () => {
    vi.resetModules();
    const browserVoice = {
      default: true,
      lang: "en-US",
      localService: true,
      name: "Test English",
      voiceURI: "test-english",
    } as SpeechSynthesisVoice;
    const speechSynthesis = {
      getVoices: vi.fn(() => [browserVoice]),
      onvoiceschanged: null,
    };
    vi.stubGlobal("window", { speechSynthesis });

    const fetchImpl: NonNullable<SpeechSynthTTSOptions["fetchImpl"]> = vi.fn(
      () => new Promise(() => undefined),
    );
    const { getVoiceOptionsForLang } = await import("./speech-synth-tts.js");

    const voiceOptions = await getVoiceOptionsForLang("en", "NONE", { fetchImpl });
    expect(voiceOptions).toMatchObject({
      available: {
        defaultAPIVoice: null,
      },
      unavailableAPIVoices: [],
    });
    expect(voiceOptions.available.voices).toEqual(
      expect.arrayContaining([
        {
          service: "BROWSER",
          voice_id: "test-english",
          voice_lang: "en-US",
        },
      ]),
    );
    expect(fetchImpl).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("returns each voice once when language and locale searches overlap", async () => {
    vi.resetModules();
    const japaneseVoice = {
      default: true,
      lang: "ja-JP",
      localService: true,
      name: "Google 日本語",
      voiceURI: "Google 日本語",
    } as SpeechSynthesisVoice;
    const speechSynthesis = {
      getVoices: vi.fn(() => [japaneseVoice]),
      onvoiceschanged: null,
    };
    vi.stubGlobal("window", { speechSynthesis });

    const { getVoiceOptionsForLang } = await import("./speech-synth-tts.js");
    const voiceOptions = await getVoiceOptionsForLang("ja", "NONE");

    expect(voiceOptions.available.voices).toEqual([
      {
        service: "BROWSER",
        voice_id: "Google 日本語",
        voice_lang: "ja-JP",
      },
    ]);

    vi.unstubAllGlobals();
  });

  it("resumes browser playback after clearing the queue and propagates playback errors", async () => {
    vi.resetModules();
    const calls: string[] = [];
    let playbackError: SpeechSynthesisErrorEvent | null = null;
    const browserVoice = {
      default: true,
      lang: "en-US",
      localService: true,
      name: "Test English",
      voiceURI: "test-english",
    } as SpeechSynthesisVoice;

    class FakeSpeechSynthesisUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(public text: string) {}
    }

    const speechSynthesis = {
      cancel: vi.fn(() => calls.push("cancel")),
      getVoices: vi.fn(() => [browserVoice]),
      onvoiceschanged: null,
      resume: vi.fn(() => calls.push("resume")),
      speak: vi.fn((utterance: FakeSpeechSynthesisUtterance) => {
        calls.push("speak");
        if (playbackError) utterance.onerror?.(playbackError);
        else {
          utterance.onstart?.();
          utterance.onend?.();
        }
      }),
    };
    vi.stubGlobal("window", { speechSynthesis });
    vi.stubGlobal("speechSynthesis", speechSynthesis);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);

    const { speak } = await import("./speech-synth-tts.js");
    await expect(speak({
      text: "hello",
      lang: "en",
      apiVoiceAccessProfile: "NONE",
    })).resolves.toBeUndefined();
    expect(calls).toEqual(["cancel", "resume", "speak"]);

    playbackError = { error: "interrupted" } as SpeechSynthesisErrorEvent;
    await expect(speak({
      text: "interrupted speech",
      lang: "en",
      apiVoiceAccessProfile: "NONE",
    })).resolves.toBeUndefined();

    playbackError = { error: "canceled" } as SpeechSynthesisErrorEvent;
    await expect(speak({
      text: "canceled speech",
      lang: "en",
      apiVoiceAccessProfile: "NONE",
    })).resolves.toBeUndefined();

    playbackError = { error: "synthesis-failed" } as SpeechSynthesisErrorEvent;
    await expect(speak({
      text: "hello again",
      lang: "en",
      apiVoiceAccessProfile: "NONE",
    })).rejects.toThrow("Browser speech synthesis failed: synthesis-failed");

    vi.unstubAllGlobals();
  });

  it("speaks with an available voice override without changing the active preference", async () => {
    vi.resetModules();
    const defaultVoice = {
      default: true,
      lang: "en-US",
      localService: true,
      name: "Default English",
      voiceURI: "default-english",
    } as SpeechSynthesisVoice;
    const previewVoice = {
      default: false,
      lang: "en-AU",
      localService: true,
      name: "Preview English",
      voiceURI: "preview-english",
    } as SpeechSynthesisVoice;

    class FakeSpeechSynthesisUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(public text: string) {}
    }

    let spokenVoice: SpeechSynthesisVoice | null = null;
    const speechSynthesis = {
      cancel: vi.fn(),
      getVoices: vi.fn(() => [defaultVoice, previewVoice]),
      onvoiceschanged: null,
      resume: vi.fn(),
      speak: vi.fn((utterance: FakeSpeechSynthesisUtterance) => {
        spokenVoice = utterance.voice;
        utterance.onstart?.();
        utterance.onend?.();
      }),
    };
    vi.stubGlobal("window", { speechSynthesis });
    vi.stubGlobal("speechSynthesis", speechSynthesis);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);

    const { getActiveVoiceForLang, speak } = await import(
      "./speech-synth-tts.js"
    );
    await speak({
      text: "preview",
      lang: "en",
      apiVoiceAccessProfile: "NONE",
      voiceOverride: {
        service: "BROWSER",
        voice_id: "preview-english",
        voice_lang: "en-AU",
      },
    });

    expect(spokenVoice).toBe(previewVoice);
    await expect(
      getActiveVoiceForLang("en", "NONE"),
    ).resolves.toMatchObject({ voice_id: "default-english" });

    vi.unstubAllGlobals();
  });

  it("invalidates cached browser voices when the page regains focus", async () => {
    vi.resetModules();
    const oldVoice = {
      default: true,
      lang: "en-US",
      localService: true,
      name: "Old English",
      voiceURI: "old-english",
    } as SpeechSynthesisVoice;
    const refreshedVoice = {
      ...oldVoice,
      name: "Refreshed English",
      voiceURI: "refreshed-english",
    } as SpeechSynthesisVoice;
    const speechSynthesis = {
      getVoices: vi.fn()
        .mockReturnValueOnce([oldVoice])
        .mockReturnValue([refreshedVoice]),
      onvoiceschanged: null,
    };
    const fakeWindow = Object.assign(new EventTarget(), { speechSynthesis });
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", new EventTarget());

    const { getVoiceOptionsForLang } = await import("./speech-synth-tts.js");
    const initialVoiceOptions = await getVoiceOptionsForLang("en", "NONE");
    expect(initialVoiceOptions.available.voices).toEqual(
      expect.arrayContaining([expect.objectContaining({ voice_id: "old-english" })]),
    );

    fakeWindow.dispatchEvent(new Event("focus"));

    const refreshedVoiceOptions = await getVoiceOptionsForLang("en", "NONE");
    expect(refreshedVoiceOptions.available.voices).toEqual(
      expect.arrayContaining([expect.objectContaining({ voice_id: "refreshed-english" })]),
    );
    expect(speechSynthesis.getVoices).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("reacquires the browser voice and retries once when playback does not start", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const oldVoice = {
      default: true,
      lang: "en-US",
      localService: true,
      name: "Old English",
      voiceURI: "test-english",
    } as SpeechSynthesisVoice;
    const refreshedVoice = {
      ...oldVoice,
      name: "Refreshed English",
    } as SpeechSynthesisVoice;

    class FakeSpeechSynthesisUtterance {
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(public text: string) {}
    }

    const spokenUtterances: FakeSpeechSynthesisUtterance[] = [];
    const speechSynthesis = {
      cancel: vi.fn(),
      getVoices: vi.fn()
        .mockReturnValueOnce([oldVoice])
        .mockReturnValue([refreshedVoice]),
      onvoiceschanged: null,
      resume: vi.fn(),
      speak: vi.fn((utterance: FakeSpeechSynthesisUtterance) => {
        spokenUtterances.push(utterance);
        if (spokenUtterances.length === 2) {
          utterance.onstart?.();
          utterance.onend?.();
        }
      }),
    };
    vi.stubGlobal("window", { speechSynthesis });
    vi.stubGlobal("speechSynthesis", speechSynthesis);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);

    const { speak } = await import("./speech-synth-tts.js");
    const playback = speak({
      text: "hello",
      lang: "en",
      apiVoiceAccessProfile: "NONE",
    });
    await vi.advanceTimersByTimeAsync(3000);

    await expect(playback).resolves.toBeUndefined();
    expect(spokenUtterances).toHaveLength(2);
    expect(spokenUtterances[0]?.voice).toBe(oldVoice);
    expect(spokenUtterances[1]?.voice).toBe(refreshedVoice);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(speechSynthesis.getVoices).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
