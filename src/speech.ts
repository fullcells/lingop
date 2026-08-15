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
