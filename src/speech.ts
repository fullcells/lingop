// Narrow speech surface for consumers that need shared speech data/services
// without importing Lingop's broader Next.js UI entry point.
export {
  fetchSpeech,
  getVoiceOptionsForLang,
  speakableTextFromDisplayText,
} from "./ui/next/speech-synth-tts.js";
export type {
  AudioMetaRow,
  SpeechSynthTTSVoice,
  SpeechSynthVoiceOptions,
} from "./ui/next/speech-synth-tts.js";

export { createSpeechController } from "./speech/controller.js";
export type {
  SpeechController,
  SpeechControllerOptions,
  SpeechRequest,
  SpeechState,
  SpeechPreferences,
  SpeechVoiceList,
  LingopSpeechVoice,
  DeviceSpeechVoice,
  DeviceSpeechAdapter,
  SpeechAudioAdapter,
} from "./speech/controller.js";
export type {
  ContentContext,
  APIVoiceAccessProfile,
  SpeechSynthTTSOptions,
} from "./speech/shared.js";

export { segmentSpeechText } from "./speech/text-segments.js";
export type { SpeechTextSegment } from "./speech/text-segments.js";
