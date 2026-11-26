import { afterEach, describe, expect, it, vi } from "vitest";
import { playRecordingSequence, recordingPlaybackRange } from "./recording-sequence.js";
import type { RecordedSpeechVoice } from "../../speech/shared.js";

const voice: RecordedSpeechVoice = {
  service: "RECORDING", voice_id: "sixian", voice_lang: "hak-TW",
  playlistUrl: "/dictionary", minimumWordIntervalSeconds: 0.5,
};

afterEach(() => vi.unstubAllGlobals());

describe("dictionary recording playback", () => {
  it("trims only edge silence, including when the speech is in the second channel", () => {
    const samples = new Float32Array(1600);
    samples.fill(0.02, 160, 200);
    samples.fill(0.4, 200, 400);
    samples.fill(0.3, 800, 1040);
    const silent = new Float32Array(samples.length);
    const buffer = { sampleRate: 8000, length: samples.length, numberOfChannels: 2,
      getChannelData: (channel: number) => channel === 1 ? samples : silent };
    expect(recordingPlaybackRange(buffer)).toEqual({ offset: 0.020, duration: 0.110 });
    expect(recordingPlaybackRange({ ...buffer, getChannelData: () => silent })).toEqual({ offset: 0, duration: 0.2 });
  });

  it("paces short words and preserves long words at the selected playback speed", async () => {
    const starts: number[] = [];
    const rates: number[] = [];
    const urls = ["/one", "/two", "/three"];
    const lengths = [2000, 7500, 2200];
    vi.stubGlobal("fetch", async (url: string) => url === "/dictionary"
      ? Response.json({ clips: urls.map(url => ({ word: url, url })), missing: [] })
      : new Response(new Uint8Array(lengths[urls.indexOf(url)])));
    const close = vi.fn(async () => {});
    vi.stubGlobal("AudioContext", class {
      currentTime = 1;
      close = close;
      async resume() {}
      async decodeAudioData(data: ArrayBuffer) {
        const samples = new Float32Array(data.byteLength).fill(0.5);
        return { getChannelData: () => samples, length: samples.length, sampleRate: 10000, numberOfChannels: 1 };
      }
      createBufferSource() {
        const node = { onended: () => {}, playbackRate: { value: 1 }, connect() {}, disconnect() {},
          start(time: number) { starts.push(time); rates.push(node.playbackRate.value); queueMicrotask(() => node.onended()); } };
        return node;
      }
    });
    expect(await playRecordingSequence(voice, ["test"], 2, new AbortController().signal)).toBe(true);
    expect(starts).toEqual([1, 1.25, 1.625]);
    expect(rates).toEqual([2, 2, 2]);
    expect(close).toHaveBeenCalledOnce();
  });
});
