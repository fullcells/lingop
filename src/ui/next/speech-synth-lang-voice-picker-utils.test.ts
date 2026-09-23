import { describe, expect, it } from "vitest";

import type { SpeechSynthTTSVoice } from "./speech-synth-tts.js";
import {
  getSpeechVoiceKey,
  getSpeechVoiceLocaleLabel,
  groupSpeechVoicesByLocale,
} from "./speech-synth-lang-voice-picker-utils.js";
import { detectBrowserBrand } from "./speech-synth-lang-voice-picker.js";

const browserVoice = (
  voiceId: string,
  voiceLang: string,
): SpeechSynthTTSVoice => ({
  service: "BROWSER",
  voice_id: voiceId,
  voice_lang: voiceLang,
});

describe("speech synth language voice picker utilities", () => {
  it("identifies the browser brand before a shared Chrome or Safari signature", () => {
    expect(detectBrowserBrand("Mozilla/5.0 Edg/120.0 Chrome/120.0 Safari/537.36")).toBe("edge");
    expect(detectBrowserBrand("Mozilla/5.0 OPR/106.0 Chrome/120.0 Safari/537.36")).toBe("opera");
    expect(detectBrowserBrand("Mozilla/5.0 Firefox/120.0 Safari/537.36")).toBe("firefox");
    expect(detectBrowserBrand("Mozilla/5.0 Chrome/120.0 Safari/537.36")).toBe("chrome");
    expect(detectBrowserBrand("Mozilla/5.0 Version/17.0 Safari/605.1.15")).toBe("safari");
  });
  it("uses service, id, and language to identify voices", () => {
    const browser = browserVoice("Shared", "en-US");
    const cloud: SpeechSynthTTSVoice = {
      service: "API",
      voice_id: "Shared",
      voice_lang: "en-US",
    };

    expect(getSpeechVoiceKey(browser)).not.toBe(getSpeechVoiceKey(cloud));
    expect(getSpeechVoiceKey(browserVoice("Shared", "en-AU"))).not.toBe(
      getSpeechVoiceKey(browser),
    );
  });

  it("groups regional and non-regional locale tags without assuming a region", () => {
    const usVoice = browserVoice("US", "en-US");
    const australianVoice = browserVoice("AU", "en-AU");
    const cantoneseVoice = browserVoice("Yue", "yue");

    const grouped = groupSpeechVoicesByLocale([
      usVoice,
      australianVoice,
      cantoneseVoice,
    ]);

    expect(grouped.get("US")).toEqual([usVoice]);
    expect(grouped.get("AU")).toEqual([australianVoice]);
    expect(grouped.get("yue")).toEqual([cantoneseVoice]);
  });

  it("falls back safely when the GUI language is not an Intl locale", () => {
    expect(() =>
      getSpeechVoiceLocaleLabel("US", "internal_gui_language"),
    ).not.toThrow();
    expect(getSpeechVoiceLocaleLabel("yue", "en")).toBe("yue");
  });
});
