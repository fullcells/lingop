import type { RecordedSpeechVoice } from "../../speech/shared.js";

type RecordingClip = { word: string; url: string };
type Playlist = { clips: RecordingClip[]; missing: string[] };

/** Find the speech edges for playback. All pauses inside the word are retained. */
export function recordingPlaybackRange(buffer: Pick<AudioBuffer, "length" | "sampleRate" | "numberOfChannels" | "getChannelData">) {
  const frameSize = Math.max(1, Math.round(buffer.sampleRate * 0.0025));
  const power = new Float64Array(Math.ceil(buffer.length / frameSize));
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < power.length; frame++) {
      const start = frame * frameSize;
      const end = Math.min(start + frameSize, samples.length);
      let energy = 0;
      for (let i = start; i < end; i++) energy += samples[i]! ** 2;
      power[frame] = Math.max(power[frame]!, energy / (end - start));
      peak = Math.max(peak, power[frame]!);
    }
  }
  // The same relative threshold across differently mastered dictionary recordings.
  // A 30 dB drop in RMS amplitude is a 1000-fold drop in mean-square power.
  const threshold = peak / 1000;
  let first = 0;
  let last = power.length;
  while (first < last && power[first]! < threshold) first++;
  while (last > first && power[last - 1]! < threshold) last--;
  const offset = first * frameSize / buffer.sampleRate;
  const end = Math.min(buffer.length, last * frameSize) / buffer.sampleRate;
  return { offset, duration: end - offset };
}

/** Schedule unchanged dictionary clips on one audio clock, with bounded lookahead. */
export async function playRecordingSequence(
  voice: RecordedSpeechVoice, spans: string[], rate: number, signal: AbortSignal,
  onLoadingChange?: ((loading: boolean) => void) | undefined,
): Promise<boolean> {
  if (signal.aborted) return false;
  const context = new AudioContext();
  const stop = () => { if (context.state !== "closed") void context.close().catch(() => {}); };
  signal.addEventListener("abort", stop, { once: true });
  try {
    await context.resume();
    const response = await fetch(voice.playlistUrl, {
      method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spans }),
    });
    if (!response.ok) throw new Error("Could not look up these recordings.");
    const { clips, missing } = await response.json() as Playlist;
    if (missing.length) throw new Error(`No single recorded reading for ${missing.join("、")}.`);
    if (!clips.length) throw new Error("No recorded words to play.");

    const stopped = new Promise<void>(resolve => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
    let nextStart = 0;
    let previousEnd = Promise.resolve();
    for (let start = 0; start < clips.length; start += 12) {
      const group = clips.slice(start, start + 12);
      const buffers: AudioBuffer[] = [];
      for (let i = 0; i < group.length; i += 4) {
        buffers.push(...await Promise.all(group.slice(i, i + 4).map(async clip => {
          const file = await fetch(clip.url, { signal });
          if (!file.ok) throw new Error(`Could not load the recording for ${clip.word}.`);
          return context.decodeAudioData(await file.arrayBuffer());
        })));
      }
      if (signal.aborted) return false;
      let groupEnd = Promise.resolve();
      for (const buffer of buffers) {
        const { offset, duration } = recordingPlaybackRange(buffer);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.connect(context.destination);
        groupEnd = new Promise(resolve => {
          source.onended = () => { source.disconnect(); resolve(); };
        });
        const when = Math.max(context.currentTime, nextStart);
        source.start(when, offset, duration);
        nextStart = when + Math.max(duration, voice.minimumWordIntervalSeconds) / rate;
      }
      if (start === 0) onLoadingChange?.(false);
      await Promise.race([previousEnd, stopped]);
      if (signal.aborted) return false;
      previousEnd = groupEnd;
    }
    await Promise.race([previousEnd, stopped]);
    return !signal.aborted;
  } catch (error) {
    if (signal.aborted) return false;
    throw error;
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
  }
}
