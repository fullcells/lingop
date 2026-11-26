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
  it("selects SuíSiann with its credits and also offers MOE recording playback for Hokkien", async () => {
    const voice = { service: "SUISIANN", voice_id: "suisiann-nan-tw-vits-v1", voice_lang: "nan-TW", displayName: "SuíSiann (Taiwanese Hokkien)" } as const;
    const recorded = { service: "RECORDING", voice_id: "taiwan-moe-hokkien", voice_lang: "nan-TW" } as const;
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => "", json: async () => [voice] }));
    const catalog = await getAPIVoices({ fetchImpl });
    const choices = selectVoiceOptions("nan", "ONE_PER_LANG", [...catalog, recorded]);
    expect(choices.available.defaultAPIVoice).toEqual(voice);
    expect(choices.available.voices).toContainEqual(recorded);
    expect(selectVoiceOptions("hak", "ALL", catalog).available.voices).toHaveLength(0);
  });
  it("offers the locally configured HKILANG voice only for Hakka", async () => {
    const voice = { service: "HKILANG", voice_id: "hkilang-hak-hk-male-v1", voice_lang: "hak-HK" } as const;
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => "", json: async () => [voice] }));
    const catalog = await getAPIVoices({ fetchImpl });
    const recorded = { service: "RECORDING", voice_id: "taiwan-moe-sixian", voice_lang: "hak-TW" } as const;
    const choices = selectVoiceOptions("hak", "ONE_PER_LANG", [...catalog, recorded]);
    expect(choices.available.defaultAPIVoice).toEqual(voice);
    expect(choices.available.voices).toEqual([voice, recorded]);
    expect(selectVoiceOptions("hak", "NONE", [...catalog, recorded]).available.voices).toEqual([]);
    expect(selectVoiceOptions("yue", "ALL", catalog).available.voices).toEqual([]);
  });
  it("still retrieves historical OpenAI audio metadata", async () => {
    const row = { id: 1, lang: "si", text: "saved speech", filename: "historical.mp3", owner_id: "owner", character_label: null, service: "OPENAI", voice_id: "cedar", ref: null, created_at: "2026-01-01T00:00:00Z" };
    const query: any = { eq() { return this; }, ilike() { return this; }, then(resolve: any) { return Promise.resolve({ data: [row], error: null }).then(resolve); } };
    const supabase = { from: () => ({ select: () => query }) };
    expect(await fetchSpeech({ lang: "si", text: row.text, voice_id: "cedar", match_on: ["text", "voice_id"], owner_id: "owner", supabase })).toEqual(row);
  });
});
