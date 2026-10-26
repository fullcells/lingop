import { describe, expect, it } from "vitest";
import { BROWSER_VOICES_DEFAULTS, filterLowQualityMacVoices, rankBrowserVoices, type BrowserSpeechVoice } from "./browser-voices.js";
import { BROWSER_VOICES_DEFAULTS as legacyDefaults, filterLowQualityMacVoices as legacyFilter } from "../ui/next/speech-synth-tts.js";
const voice = (name: string, lang = "en-US", extra: Partial<BrowserSpeechVoice> = {}): BrowserSpeechVoice => ({
  name, voiceURI: name, lang, default: false, localService: true, ...extra,
});

describe("shared browser voice ranking", () => {
  it("keeps the browser UI's public defaults and macOS filter exports compatible", () => {
    expect(legacyDefaults).toBe(BROWSER_VOICES_DEFAULTS);
    expect(legacyFilter).toBe(filterLowQualityMacVoices);
  });
  it("puts curated Japanese and English voices ahead of ordinary/default voices", () => {
    const voices = [voice("Ordinary", "ja-JP", { default: true }), voice("Kyoko", "ja-JP"), voice("Otoya", "ja-JP")];
    expect(rankBrowserVoices(voices).map(v => v.name)).toEqual(["Otoya", "Ordinary", "Kyoko"]);
    const english = [voice("Other", "en-US", { default: true }), voice("Alex"), voice("Karen", "en-AU"), voice("Samantha")];
    expect(rankBrowserVoices(english).map(v => v.name)).toEqual(["Samantha", "Karen", "Alex", "Other"]);
  });
  it("retains the existing quality tiers for unlisted voices", () => {
    const voices = [voice("Ordinary"), voice("Other Enhanced"), voice("Microsoft Other"), voice("Other Premium"), voice("Google Other"), voice("System", "en-US", { default: true })];
    expect(rankBrowserVoices(voices).map(v => v.name)).toEqual(["System", "Google Other", "Other Premium", "Microsoft Other", "Other Enhanced", "Ordinary"]);
  });
  it("hides novelty voices on macOS only when a better voice for the same locale remains", () => {
    const voices = [voice("Bells", "en_US", { default: true }), voice("Ordinary Premium"), voice("Grandpa", "en-GB")];
    expect(rankBrowserVoices(voices, { isMacOS: true }).map(v => v.name)).toEqual(["Ordinary Premium", "Grandpa"]);
    expect(rankBrowserVoices(voices).map(v => v.name)).toEqual(["Bells", "Ordinary Premium", "Grandpa"]);
  });
  it("retains explicitly preferred novelty voices without treating the name as identity", () => {
    const voices = [voice("Bells", "en-US", { voiceURI: "installed-bells" }), voice("Natural")];
    expect(rankBrowserVoices(voices, { isMacOS: true, preferredVoices: [{ voiceURI: "installed-bells", lang: "en_US" }] })).toContain(voices[0]);
    expect(rankBrowserVoices(voices, { isMacOS: true, preferredVoices: [{ voiceURI: "Bells", lang: "en-US" }] })).not.toContain(voices[0]);
  });
  it("deduplicates exact entries, preserves stable ties and leaves the input untouched", () => {
    const a = voice("First"), b = voice("Second");
    const voices = Object.freeze([a, b, { ...a }]);
    expect(rankBrowserVoices(voices)).toEqual([a, b]);
    expect(voices).toHaveLength(3);
    expect(rankBrowserVoices(voices)[0]).toBe(a);
  });
  it("keeps a sole voice for its locale and does not enumerate or play voices", () => {
    const voices = [voice("Bells")];
    expect(rankBrowserVoices(voices, { isMacOS: true })).toEqual(voices);
    expect(rankBrowserVoices([])).toEqual([]);
  });
});
