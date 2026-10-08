import { afterEach, describe, expect, it, vi } from "vitest";

const rawVoice = (id: string, lang: string) => ({
  voiceURI: id, name: id, lang, default: false, localService: true,
}) as SpeechSynthesisVoice;
const voices = [
  rawVoice("English", "en-US"), rawVoice("Mandarin", "zh-CN"),
  rawVoice("Cantonese", "zh-HK"), rawVoice("Japanese", "ja-JP"),
];

class Utterance {
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

function browser(play?: (utterance: Utterance) => void) {
  const spoken: Utterance[] = [];
  const synth = {
    getVoices: () => voices,
    cancel: vi.fn(), resume: vi.fn(),
    speak: (utterance: Utterance) => {
      spoken.push(utterance);
      utterance.onstart?.();
      if (play) play(utterance);
      else utterance.onend?.();
    },
  };
  vi.stubGlobal("window", { speechSynthesis: synth });
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return { spoken, synth };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("shared mixed-language TTS playback", () => {
  it.each(["ja", "yue"])("reads embedded Han with the requested %s voice and English around it", async embeddedLang => {
    vi.resetModules();
    const loading: boolean[] = [];
    const { spoken } = browser(u => {
      expect(loading.at(-1)).toBe(false);
      u.onend?.();
    });
    const { speak } = await import("./speech-synth-tts.js");
    const fetchImpl = vi.fn();
    await speak({ text: "Say 人, meaning person.", lang: "en", embeddedLang, apiVoiceAccessProfile: "NONE", fetchImpl, onLoadingChange: value => loading.push(value) });
    expect(spoken.map(u => [u.text, u.voice?.voiceURI, u.lang])).toEqual([
      ["Say ", "English", "en-US"],
      ["人", embeddedLang === "ja" ? "Japanese" : "Cantonese", embeddedLang === "ja" ? "ja-JP" : "zh-HK"],
      [", meaning person.", "English", "en-US"],
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loading).toEqual([true, false, true, false, true, false, false]);
  });

  it("uses the embedded voice override without changing the English voice or saved preference", async () => {
    vi.resetModules();
    const { spoken } = browser();
    const { speak } = await import("./speech-synth-tts.js");
    await speak({ text: "Use 食べる.", lang: "en", embeddedLang: "ja", embeddedVoiceOverride: { service: "BROWSER", voice_id: "Japanese", voice_lang: "ja-JP" }, apiVoiceAccessProfile: "NONE" });
    expect(spoken.map(u => u.voice?.voiceURI)).toEqual(["English", "Japanese"]);
  });

  it("stops later fragments when the browser interrupts an utterance", async () => {
    vi.resetModules();
    const { spoken } = browser(u => u.onerror?.({ error: "interrupted" }));
    const { speak } = await import("./speech-synth-tts.js");
    await speak({ text: "Use 嘅 for possession.", lang: "en", embeddedLang: "yue", apiVoiceAccessProfile: "NONE" });
    expect(spoken).toHaveLength(1);
  });

  it("aborts the whole explanation while a foreign fragment is speaking", async () => {
    vi.resetModules();
    const abort = new AbortController();
    const { spoken, synth } = browser(u => {
      if (u.voice?.lang === "zh-HK") abort.abort();
      else u.onend?.();
    });
    const { speak } = await import("./speech-synth-tts.js");
    await speak({ text: "Use 嘅 for possession.", lang: "en", embeddedLang: "yue", signal: abort.signal, apiVoiceAccessProfile: "NONE" });
    expect(spoken.map(u => u.text)).toEqual(["Use ", "嘅"]);
    expect(synth.cancel).toHaveBeenCalledOnce();
  });

  it("does not start speech when already aborted", async () => {
    vi.resetModules();
    const { spoken } = browser();
    const abort = new AbortController();
    abort.abort();
    const { speak } = await import("./speech-synth-tts.js");
    const loading = vi.fn();
    await speak({ text: "Use 嘅.", lang: "en", embeddedLang: "yue", signal: abort.signal, apiVoiceAccessProfile: "NONE", onLoadingChange: loading });
    expect(spoken).toEqual([]);
    expect(loading).toHaveBeenLastCalledWith(false);
  });

  it("clears loading after a browser synthesis error", async () => {
    vi.resetModules();
    browser(u => u.onerror?.({ error: "synthesis-failed" }));
    const loading = vi.fn();
    const { speak } = await import("./speech-synth-tts.js");
    await expect(speak({ text: "Use 嘅.", lang: "en", embeddedLang: "yue", apiVoiceAccessProfile: "NONE", onLoadingChange: loading })).rejects.toThrow("synthesis-failed");
    expect(loading).toHaveBeenLastCalledWith(false);
  });

  it("keeps ordinary calls as one utterance", async () => {
    vi.resetModules();
    const { spoken } = browser();
    const { speak } = await import("./speech-synth-tts.js");
    await speak({ text: "Use 嘅.", lang: "en", apiVoiceAccessProfile: "NONE" });
    expect(spoken.map(u => u.text)).toEqual(["Use 嘅."]);
  });

  it("does not play a cloud fragment that finishes loading after cancellation", async () => {
    vi.resetModules();
    const { spoken } = browser();
    const abort = new AbortController();
    const loading = vi.fn();
    const play = vi.fn();
    vi.stubGlobal("Audio", class {
      oncanplaythrough: (() => void) | null = null;
      load() { abort.abort(); this.oncanplaythrough?.(); }
      play = play;
    });
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true, status: 200, text: async () => "",
      json: async () => url.endsWith("get-api-voices") ? [
        { service: "MICROSOFT", voice_id: "zh-HK-WanLungNeural", voice_lang: "zh-HK" },
      ] : {
        id: 1, lang: "yue", text: "嘅", filename: "aborted-yue.mp3", owner_id: "test",
        character_label: null, service: "MICROSOFT", voice_id: "zh-HK-WanLungNeural",
        ref: { isTempAnon: true }, created_at: "2026-10-08T00:00:00Z",
      },
    }));
    const { speak } = await import("./speech-synth-tts.js");
    await speak({
      text: "Use 嘅 for possession.", lang: "en", embeddedLang: "yue", signal: abort.signal,
      embeddedVoiceOverride: { service: "MICROSOFT", voice_id: "zh-HK-WanLungNeural", voice_lang: "zh-HK" },
      apiVoiceAccessProfile: "ONE_PER_LANG", contentContext: "LIMITED_TEMP_ANON", fetchImpl,
      onLoadingChange: loading,
    });
    expect(spoken.map(u => u.text)).toEqual(["Use "]);
    expect(play).not.toHaveBeenCalled();
    expect(loading).toHaveBeenLastCalledWith(false);
  });

  it("generates cloud speech separately with the correct language and voice", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    const loading: boolean[] = [];
    class Audio {
      oncanplaythrough: (() => void) | null = null;
      listeners = new Map<string, () => void>();
      load() { expect(loading.at(-1)).toBe(true); this.oncanplaythrough?.(); }
      addEventListener(name: string, fn: () => void) { this.listeners.set(name, fn); }
      removeEventListener(name: string) { this.listeners.delete(name); }
      play() {
        expect(loading.at(-1)).toBe(true);
        this.listeners.get("playing")?.();
        expect(loading.at(-1)).toBe(false);
        this.listeners.get("waiting")?.();
        expect(loading.at(-1)).toBe(true);
        this.listeners.get("playing")?.();
        expect(loading.at(-1)).toBe(false);
        this.listeners.get("ended")?.();
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Audio", Audio);
    const fetchImpl = vi.fn(async (url: string, init?: { body?: string }) => {
      const request = JSON.parse(init?.body ?? "{}");
      return { ok: true, status: 200, text: async () => "", json: async () => url.endsWith("get-api-voices") ? [
        { service: "MICROSOFT", voice_id: "en-US-AndrewMultilingualNeural", voice_lang: "en-US" },
        { service: "MICROSOFT", voice_id: "zh-HK-WanLungNeural", voice_lang: "zh-HK" },
        { service: "MICROSOFT", voice_id: "zh-CN-YunxiNeural", voice_lang: "zh-CN" },
      ] : {
        id: 1, lang: request.lang, text: request.text_for_db, filename: `${request.lang}-${request.text_for_db}.mp3`,
        owner_id: "test", character_label: null, service: "MICROSOFT", voice_id: request.synth_voice?.voice_id,
        ref: { isTempAnon: true }, created_at: "2026-10-08T00:00:00Z",
      } };
    });
    const { speak } = await import("./speech-synth-tts.js");
    await speak({ text: "Use 嘅 for possession.", lang: "en", embeddedLang: "yue", apiVoiceAccessProfile: "ONE_PER_LANG", contentContext: "LIMITED_TEMP_ANON", fetchImpl, onLoadingChange: value => loading.push(value) });
    const speech = fetchImpl.mock.calls.filter(([url]) => url.endsWith("speech-create-limited-anon")).map(([, init]) => JSON.parse(init?.body ?? "{}"));
    expect(speech.map(r => [r.lang, r.text_for_tts, r.synth_voice.voice_id])).toEqual([
      ["en", "Use ", "en-US-AndrewMultilingualNeural"],
      ["yue", "嘅", "zh-HK-WanLungNeural"],
      ["en", " for possession.", "en-US-AndrewMultilingualNeural"],
    ]);
    expect(loading.at(-1)).toBe(false);
  });
});
