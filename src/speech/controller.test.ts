import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  DeviceSpeechAdapter,
  DeviceSpeechVoice,
  SpeechAudioAdapter,
} from "./controller.js";
import {
  createExpoAudioAdapter,
  createExpoSpeechAdapter,
  type ExpoSpeechModule,
} from "./expo.js";
const japanese: DeviceSpeechVoice = {
  service: "DEVICE",
  voice_id: "apple.ja",
  voice_lang: "ja-JP",
  name: "Kyoko",
};
const cantonese: DeviceSpeechVoice = {
  service: "DEVICE",
  voice_id: "apple.yue",
  voice_lang: "yue-HK",
  name: "Sinji",
};
const api = {
  service: "MICROSOFT" as const,
  voice_id: "ja-JP-KeitaNeural",
  voice_lang: "ja-JP",
};
const request = {
  text: "猫",
  lang: "ja",
  contentContext: "PUBLIC_CONTENT" as const,
  ref: { file: "WORDS" },
};
let device: DeviceSpeechAdapter;
let audio: SpeechAudioAdapter;
let createSpeechController: typeof import("./controller.js").createSpeechController;
beforeEach(async () => {
  vi.resetModules();
  ({ createSpeechController } = await import("./controller.js"));
  device = {
    getVoices: vi.fn(async () => [japanese, cantonese]),
    stop: vi.fn(async () => {}),
    speak: vi.fn(async () => {}),
  };
  audio = { play: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
});
afterEach(() => vi.useRealTimers());
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const fetchImpl = () =>
  vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    text: async () => "",
    json: async () =>
      url.endsWith("get-api-voices")
        ? [api]
        : {
            id: 1,
            lang: "ja",
            text: "猫",
            filename: "cat.mp3",
            owner_id: "public",
            character_label: null,
            service: "MICROSOFT",
            voice_id: api.voice_id,
            ref: request.ref,
            created_at: "2026-10-01",
          },
  }));

it("starts device speech without cloud access, normalizes text, and uses the selected voice's locale", async () => {
  const fetch = fetchImpl();
  const controller = createSpeechController({
    device,
    audio,
    apiVoiceAccessProfile: "ALL",
    fetchImpl: fetch,
  });
  await controller.speak({ text: "___", lang: "ja" });
  expect(fetch).not.toHaveBeenCalled();
  expect(device.speak).toHaveBeenCalledWith(
    "うーん",
    japanese,
    1,
    expect.any(AbortSignal),
  );
  expect(controller.getSnapshot().status).toBe("idle");
});
it("maps Cantonese to actual available device voices, never Mandarin or Japanese", async () => {
  const controller = createSpeechController({ device });
  expect((await controller.listVoices("yue")).voices).toEqual([cantonese]);
  await controller.speak({ text: "貓", lang: "yue" });
  expect(device.speak).toHaveBeenCalledWith(
    "貓",
    cantonese,
    1,
    expect.any(AbortSignal),
  );
  await expect(controller.speak({ text: "قط", lang: "arz" })).rejects.toThrow(
    "No voice",
  );
});
it("keeps working device voices when the API is offline and allows retry", async () => {
  const fetch = fetchImpl();
  fetch.mockRejectedValueOnce(new Error("Offline"));
  const controller = createSpeechController({
    device,
    audio,
    apiVoiceAccessProfile: "ALL",
    fetchImpl: fetch,
  });
  const result = await controller.listVoices("ja");
  expect(result.voices).toEqual([japanese]);
  expect(result.errors).toHaveLength(1);
  expect((await controller.listVoices("ja")).voices).toEqual([japanese, api]);
});
it("resolves selected API voices through existing public speech refs and reuses cached audio", async () => {
  const fetch = fetchImpl();
  const controller = createSpeechController({
    device,
    audio,
    apiVoiceAccessProfile: "ONE_PER_LANG",
    fetchImpl: fetch,
  });
  controller.setVoice("ja", api);
  controller.setRate(0.75);
  await controller.speak(request);
  await controller.speak(request);
  expect(
    fetch.mock.calls.filter(([url]) => url.endsWith("speech-get-public")),
  ).toHaveLength(1);
  expect(audio.play).toHaveBeenCalledWith(
    expect.stringContaining("cat.mp3"),
    0.75,
    expect.any(AbortSignal),
  );
  expect(device.speak).not.toHaveBeenCalled();
});
it("requires public references for API playback, but not device speech", async () => {
  const controller = createSpeechController({
    device,
    audio,
    apiVoiceAccessProfile: "ALL",
    fetchImpl: fetchImpl(),
  });
  controller.setVoice("ja", api);
  await expect(controller.speak({ text: "猫", lang: "ja" })).rejects.toThrow(
    "content context",
  );
  expect(audio.play).not.toHaveBeenCalled();
});
it("reports an unavailable preference instead of silently replacing it", async () => {
  const controller = createSpeechController({ device });
  controller.setVoice("ja", { ...japanese, voice_id: "removed.voice" });
  await expect(controller.speak(request)).rejects.toThrow(
    "selected voice is unavailable",
  );
  expect(device.speak).not.toHaveBeenCalled();
  controller.setVoice("ja", null);
  await controller.speak(request);
  expect(device.speak).toHaveBeenCalledOnce();
});
it("cancels an in-flight lookup and ignores its late response", async () => {
  let finish!: (voices: DeviceSpeechVoice[]) => void;
  vi.mocked(device.getVoices).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const controller = createSpeechController({ device });
  const first = controller.speak(request);
  await tick();
  await controller.stop();
  await first;
  finish([japanese]);
  await tick();
  expect(device.speak).not.toHaveBeenCalled();
  expect(controller.getSnapshot().status).toBe("idle");
});
it("repeated taps cancel earlier playback; a dismissed older view cannot stop the newer owner", async () => {
  vi.mocked(device.speak).mockImplementation(async () => new Promise(() => {}));
  const controller = createSpeechController({ device });
  const oldOwner = {},
    newOwner = {};
  const first = controller.speak(request, oldOwner);
  await tick();
  const oldSignal = vi.mocked(device.speak).mock.calls[0]![3];
  const second = controller.speak(request, newOwner);
  await tick();
  await first;
  expect(oldSignal.aborted).toBe(true);
  await controller.stop(oldOwner);
  expect(controller.getSnapshot().owner).toBe(newOwner);
  await controller.stop(newOwner);
  await second;
});
it("persists portable per-language voice preferences via the host callback", () => {
  const save = vi.fn();
  const controller = createSpeechController({
    device,
    onPreferencesChange: save,
  });
  controller.setVoice("JA", japanese);
  controller.setRate(99);
  expect(save).toHaveBeenLastCalledWith({ voices: { ja: japanese }, rate: 2 });
});
it("bounds voice discovery and exposes recoverable failures", async () => {
  vi.useFakeTimers();
  vi.mocked(device.getVoices).mockReturnValue(new Promise(() => {}));
  const controller = createSpeechController({ device });
  const result = controller.listVoices("ja");
  await vi.advanceTimersByTimeAsync(15000);
  expect(await result).toEqual({
    voices: [],
    errors: [expect.stringContaining("timed out")],
  });
});
it("Expo device adapter passes real voice identifiers and times out a stalled start", async () => {
  vi.useFakeTimers();
  const speech: ExpoSpeechModule = {
    getAvailableVoicesAsync: vi.fn(async () => [
      { identifier: "apple.ja", language: "ja-JP", name: "Kyoko" },
    ]),
    stop: vi.fn(async () => {}),
    speak: vi.fn(),
  };
  const adapter = createExpoSpeechAdapter(speech, { startTimeoutMs: 100 });
  expect(await adapter.getVoices()).toEqual([japanese]);
  const result = adapter.speak(
    "猫",
    japanese,
    0.75,
    new AbortController().signal,
  );
  const failure = expect(result).rejects.toThrow("did not start");
  await vi.advanceTimersByTimeAsync(100);
  await failure;
  expect(speech.stop).toHaveBeenCalledOnce();
  expect(speech.speak).toHaveBeenCalledWith(
    "猫",
    expect.objectContaining({
      voice: "apple.ja",
      language: "ja-JP",
      rate: 0.75,
    }),
  );
});
it("Expo audio releases native resources on finish, failure and cancellation", async () => {
  let status!: (status: any) => void;
  const subscription = { remove: vi.fn() };
  const player = {
    play: vi.fn(),
    pause: vi.fn(),
    remove: vi.fn(),
    setPlaybackRate: vi.fn(),
    addListener: vi.fn((_event, callback) => {
      status = callback;
      return subscription;
    }),
  };
  const adapter = createExpoAudioAdapter({ createAudioPlayer: () => player });
  const first = adapter.play(
    "https://audio.example/cat.mp3",
    1,
    new AbortController().signal,
  );
  status({ playing: true });
  status({ didJustFinish: true });
  await first;
  expect(player.remove).toHaveBeenCalledTimes(1);
  const second = adapter.play(
    "https://audio.example/cat.mp3",
    1,
    new AbortController().signal,
  );
  const failure = expect(second).rejects.toThrow("Network failed");
  status({ error: "Network failed" });
  await failure;
  const abort = new AbortController();
  const third = adapter.play("https://audio.example/cat.mp3", 1, abort.signal);
  abort.abort();
  await third;
  expect(player.remove).toHaveBeenCalledTimes(3);
  expect(subscription.remove).toHaveBeenCalledTimes(3);
});

it("keeps API voice and audio caches isolated between backend clients", async () => {
  const firstFetch = fetchImpl();
  const secondFetch = fetchImpl();
  const first = createSpeechController({ device, audio, apiVoiceAccessProfile: "ALL", fetchImpl: firstFetch });
  const second = createSpeechController({ device, audio, apiVoiceAccessProfile: "ALL", fetchImpl: secondFetch });
  first.setVoice("ja", api); second.setVoice("ja", api);
  await first.speak(request); await second.speak(request);
  expect(firstFetch).toHaveBeenCalledTimes(2);
  expect(secondFetch).toHaveBeenCalledTimes(2);
});
