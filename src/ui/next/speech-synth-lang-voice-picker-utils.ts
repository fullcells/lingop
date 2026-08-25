import type { SpeechSynthTTSVoice } from "./speech-synth-tts.js";

export function getSpeechVoiceKey(voice: SpeechSynthTTSVoice): string {
  return `${voice.service}\u0000${voice.voice_id}\u0000${voice.voice_lang}`;
}

function getVoiceLocaleGroup(voiceLang: string): string {
  try {
    const locale = new Intl.Locale(voiceLang);
    return locale.region ?? locale.baseName;
  } catch {
    const separatorIndex = voiceLang.indexOf("-");
    return separatorIndex >= 0
      ? voiceLang.slice(separatorIndex + 1)
      : voiceLang;
  }
}

export function groupSpeechVoicesByLocale(
  voices: SpeechSynthTTSVoice[],
): Map<string, SpeechSynthTTSVoice[]> {
  const groups = new Map<string, SpeechSynthTTSVoice[]>();
  for (const voice of voices) {
    const locale = getVoiceLocaleGroup(voice.voice_lang);
    const group = groups.get(locale) ?? [];
    group.push(voice);
    groups.set(locale, group);
  }
  return groups;
}

export function getSpeechVoiceLocaleLabel(
  locale: string,
  guiLang: string,
): string {
  if (!/^(?:[A-Z]{2}|\d{3})$/i.test(locale)) return locale;
  if (!("DisplayNames" in Intl)) return locale;

  for (const displayLocale of [guiLang, "en"]) {
    try {
      return (
        new Intl.DisplayNames([displayLocale], { type: "region" }).of(
          locale.toUpperCase(),
        ) ?? locale
      );
    } catch {
      // Internal language codes are not necessarily valid Intl locales.
    }
  }
  return locale;
}
