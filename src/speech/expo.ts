import type { DeviceSpeechAdapter, SpeechAudioAdapter } from "./controller.js";

/** Structural interfaces keep Expo optional; pass the app's installed modules. */
export type ExpoSpeechModule = {
  getAvailableVoicesAsync(): Promise<
    { identifier: string; language: string; name: string; quality?: string }[]
  >;
  stop(): Promise<void>;
  speak(
    text: string,
    options: {
      language: string;
      voice: string;
      rate: number;
      useApplicationAudioSession: boolean;
      onStart: () => void;
      onDone: () => void;
      onStopped: () => void;
      onError: (error: Error) => void;
    },
  ): void;
};
/** Defaults to the system-managed iOS audio session; the app may supply its own. */
export function createExpoSpeechAdapter(
  speech: ExpoSpeechModule,
  { useApplicationAudioSession = false, startTimeoutMs = 15000 } = {},
): DeviceSpeechAdapter {
  return {
    getVoices: async () =>
      (await speech.getAvailableVoicesAsync()).map((v) => ({
        service: "DEVICE" as const,
        voice_id: v.identifier,
        voice_lang: v.language,
        name: v.name,
        ...(v.quality ? { quality: v.quality } : {}),
      })),
    stop: () => speech.stop(),
    speak: (text, voice, rate, signal) =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          if (error) reject(error);
          else resolve();
        };
        // Controller serializes speech.stop before starting the next utterance.
        const abort = () => finish();
        const timer = setTimeout(() => {
          void speech.stop().catch(() => {});
          finish(
            new Error(
              "The device voice did not start. Choose another voice and retry.",
            ),
          );
        }, startTimeoutMs);
        signal.addEventListener("abort", abort, { once: true });
        try {
          speech.speak(text, {
            language: voice.voice_lang,
            voice: voice.voice_id,
            rate,
            useApplicationAudioSession,
            onStart: () => clearTimeout(timer),
            onDone: () => finish(),
            onStopped: () => finish(),
            onError: (error) => finish(error),
          });
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      }),
  };
}

export type ExpoAudioPlayer = {
  play(): void;
  pause(): void;
  remove(): void;
  setPlaybackRate(rate: number): void;
  addListener(
    event: "playbackStatusUpdate",
    listener: (status: {
      isLoaded: boolean;
      didJustFinish: boolean;
      playing: boolean;
      error?: string | null;
    }) => void,
  ): { remove(): void };
};
export type ExpoAudioModule = {
  createAudioPlayer(source: { uri: string }): ExpoAudioPlayer;
};
/** Host configures its audio session once; playback never overrides app-wide settings. */
export function createExpoAudioAdapter(
  audio: ExpoAudioModule,
  { startTimeoutMs = 30000 } = {},
): SpeechAudioAdapter {
  let cancel: (() => void) | null = null;
  return {
    stop: async () => {
      cancel?.();
    },
    play: (url, rate, signal) =>
      new Promise<void>((resolve, reject) => {
        cancel?.();
        if (signal.aborted) {
          resolve();
          return;
        }
        let player: ExpoAudioPlayer | undefined;
        let subscription: { remove(): void } | undefined;
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          subscription?.remove();
          try {
            player?.pause();
            player?.remove();
          } catch (cleanupError) {
            error ??=
              cleanupError instanceof Error
                ? cleanupError
                : new Error(String(cleanupError));
          }
          if (cancel === abort) cancel = null;
          if (error) reject(error);
          else resolve();
        };
        const abort = () => finish();
        cancel = abort;
        const timer = setTimeout(
          () =>
            finish(
              new Error(
                "Audio could not start. Check your connection and retry.",
              ),
            ),
          startTimeoutMs,
        );
        signal.addEventListener("abort", abort, { once: true });
        try {
          player = audio.createAudioPlayer({ uri: url });
          subscription = player.addListener(
            "playbackStatusUpdate",
            (status) => {
              if (status.error) {
                finish(new Error(status.error));
                return;
              }
              if (status.playing) clearTimeout(timer);
              if (status.didJustFinish) finish();
            },
          );
          player.setPlaybackRate(rate);
          player.play();
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      }),
  };
}
