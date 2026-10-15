import { describe, expect, it, vi } from "vitest";
import { fetchSpeech, getAPIVoices, selectVoiceOptions, type SpeechSynthTTSVoice } from "./shared.js";

const browser: SpeechSynthTTSVoice = { service: "BROWSER", voice_id: "local-sinhala", voice_lang: "si-LK" };
const microsoft: SpeechSynthTTSVoice = { service: "MICROSOFT", voice_id: "si-LK-SameeraNeural", voice_lang: "si-LK" };
const retired: SpeechSynthTTSVoice = { service: "OPENAI", voice_id: "cedar", voice_lang: "si" };
const google: SpeechSynthTTSVoice = { service: "GOOGLE", voice_id: "yue-HK-Chirp3-HD-Charon", voice_lang: "yue-HK" };

describe("retired OpenAI generation and Sinhala fallback", () => {
  it("keeps Sinhala browser-first and offers Microsoft as the cloud default", () => {
    const options = selectVoiceOptions("si", "ONE_PER_LANG", [retired, browser, microsoft]);
    expect(options.available.voices).toEqual([browser, microsoft]);
    expect(options.available.defaultAPIVoice).toEqual(microsoft);
    expect(selectVoiceOptions("si", "ONE_PER_LANG", [microsoft]).available.voices).toEqual([microsoft]);
  });
  it("keeps NONE browser-only and removes retired voices from every profile", () => {
    for (const profile of ["NONE", "ONE_PER_LANG", "ALL"] as const) {
      const options = selectVoiceOptions("si", profile, [retired, browser, microsoft]);
      expect([...options.available.voices, ...options.unavailableAPIVoices].some(voice => voice.service === "OPENAI")).toBe(false);
      if (profile === "NONE") expect(options.available.voices).toEqual([browser]);
    }
  });
  it("uses provider inventories without injecting an OpenAI voice", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => "", json: async () => [retired, microsoft, google] }));
    expect(await getAPIVoices({ fetchImpl })).toEqual([microsoft, google]);
    expect(selectVoiceOptions("yue", "ALL", [google]).available.voices).toEqual([google]);
  });
  it("still retrieves historical OpenAI audio metadata", async () => {
    const row = { id: 1, lang: "si", text: "saved speech", filename: "historical.mp3", owner_id: "owner", character_label: null, service: "OPENAI", voice_id: "cedar", ref: null, created_at: "2026-01-01T00:00:00Z" };
    const query: any = { eq() { return this; }, ilike() { return this; }, then(resolve: any) { return Promise.resolve({ data: [row], error: null }).then(resolve); } };
    const supabase = { from: () => ({ select: () => query }) };
    expect(await fetchSpeech({ lang: "si", text: row.text, voice_id: "cedar", match_on: ["text", "voice_id"], owner_id: "owner", supabase })).toEqual(row);
  });
});
