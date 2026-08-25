import { describe, expect, it } from "vitest";

import type { SpeechSynthTTSVoice } from "./speech-synth-tts.js";
import {
  getSpeechVoiceKey,
  getSpeechVoiceLocaleLabel,
  groupSpeechVoicesByLocale,
} from "./speech-synth-lang-voice-picker-utils.js";

const browserVoice = (
  voiceId: string,
  voiceLang: string,
): SpeechSynthTTSVoice => ({
  service: "BROWSER",
  voice_id: voiceId,
  voice_lang: voiceLang,
});

describe("speech synth language voice picker utilities", () => {
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
