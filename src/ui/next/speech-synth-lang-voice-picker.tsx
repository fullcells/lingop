"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getLang } from "../../core/language/index.js";
import type { ContentReference } from "../../core/misc.js";
import { useOAT } from "../../oat/react/index.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import {
  getActiveVoiceForLang,
  getVoiceOptionsForLang,
  prettifyVoiceId,
  speak,
  updateUserPreferredVoice,
  type ContentContext,
  type SpeechSynthTTSOptions,
  type SpeechSynthTTSVoice,
} from "./speech-synth-tts.js";
import {
  getSpeechVoiceKey,
  getSpeechVoiceLocaleLabel,
  groupSpeechVoicesByLocale,
} from "./speech-synth-lang-voice-picker-utils.js";

export type SpeechSynthLangVoicePickerProps = {
  lang: string;
  /** Used only to localize region names; internal/invalid Intl codes fail open. */
  guiLang?: string;
  onDone: () => void;
  /** Consumer-owned localized sentence used by the optional preview buttons. */
  previewText?: string;
  /** Required for cloud previews; browser previews need neither context nor ref. */
  previewContentContext?: ContentContext;
  /** PUBLIC_CONTENT previews require a stable consumer-owned reference. */
  previewContentRef?: ContentReference;
  onVoiceChange?: (voice: SpeechSynthTTSVoice) => void;
};

function BrowserIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8h18M7 6h.01M10 6h.01" />
    </svg>
  );
}

function CloudIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18a4.6 4.6 0 0 1-.7-9.15A6 6 0 0 1 17.7 10 4 4 0 1 1 18 18H7Z" />
    </svg>
  );
}

function PlayIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" />
    </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function LoadingSpinner(): ReactNode {
  return <span className="speech-voice-picker-spinner" aria-hidden="true" />;
}

function voicesMatch(
  first: SpeechSynthTTSVoice | null,
  second: SpeechSynthTTSVoice,
): boolean {
  return !!first && getSpeechVoiceKey(first) === getSpeechVoiceKey(second);
}

/**
 * Shared language voice picker.
 *
 * Dialog ownership and preview content policy remain with the consumer. Lingop
 * owns voice discovery, entitlement, preference persistence, and playback.
 */
export function SpeechSynthLangVoicePicker({
  lang,
  guiLang = "en",
  onDone,
  previewText,
  previewContentContext,
  previewContentRef,
  onVoiceChange,
}: SpeechSynthLangVoicePickerProps): ReactNode {
  const { OAT } = useOAT();
  const {
    apiVoiceAccessProfile,
    supabaseClient,
    useStagingBackend,
  } = useLingopClientData();
  const speechOptions = useMemo<SpeechSynthTTSOptions>(
    () => ({
      ...(supabaseClient ? { supabaseClient } : {}),
      useStagingBackend,
    }),
    [supabaseClient, useStagingBackend],
  );
  const [voices, setVoices] = useState<SpeechSynthTTSVoice[]>([]);
  const [activeVoice, setActiveVoice] =
    useState<SpeechSynthTTSVoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingVoiceKey, setPreviewingVoiceKey] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setVoices([]);
    setActiveVoice(null);

    void Promise.all([
      getVoiceOptionsForLang(
        lang,
        apiVoiceAccessProfile,
        speechOptions,
      ),
      getActiveVoiceForLang(lang, apiVoiceAccessProfile, speechOptions),
    ])
      .then(([voiceOptions, selectedVoice]) => {
        if (cancelled) return;
        // Only voices permitted by the Consumer-owned access profile belong in
        // the picker. Unavailable cloud voices remain a future product-policy UI.
        setVoices(voiceOptions.available.voices);
        setActiveVoice(selectedVoice);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Could not load speech voices:", error);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiVoiceAccessProfile, lang, speechOptions]);

  const voicesByLocale = useMemo(
    () => groupSpeechVoicesByLocale(voices),
    [voices],
  );
  const languageName = getLang(lang)?.name_natural ?? lang.toUpperCase();

  const canPreviewVoice = (voice: SpeechSynthTTSVoice): boolean => {
    if (!previewText) return false;
    if (voice.service === "BROWSER") return true;
    if (!previewContentContext) return false;
    if (previewContentContext === "PUBLIC_CONTENT") {
      return previewContentRef !== undefined;
    }
    if (previewContentContext === "MEMBER_CONTENT") {
      return supabaseClient !== undefined;
    }
    return true;
  };

  const selectVoice = (voice: SpeechSynthTTSVoice): void => {
    updateUserPreferredVoice(lang, voice);
    setActiveVoice(voice);
    onVoiceChange?.(voice);
  };

  const previewVoice = async (voice: SpeechSynthTTSVoice): Promise<void> => {
    if (!previewText || !canPreviewVoice(voice)) return;
    const voiceKey = getSpeechVoiceKey(voice);
    setPreviewingVoiceKey(voiceKey);
    try {
      await speak({
        text: previewText,
        lang,
        apiVoiceAccessProfile,
        voiceOverride: voice,
        ...(previewContentContext
          ? { contentContext: previewContentContext }
          : {}),
        ...(previewContentRef ? { ref: previewContentRef } : {}),
        ...speechOptions,
      });
    } catch (error: unknown) {
      console.error("Could not preview speech voice:", error);
    } finally {
      setPreviewingVoiceKey((current) =>
        current === voiceKey ? null : current,
      );
    }
  };

  return (
    <div className="speech-voice-picker">
      <div className="speech-voice-picker-content">
        <header className="speech-voice-picker-header">
          <h1>{OAT("Language Speaker")}</h1>
          <h2>{languageName}</h2>
        </header>

        <div
          className="speech-voice-picker-options"
          role="radiogroup"
          aria-label={OAT("Language Speaker")}
        >
          {isLoading && (
            <div
              className="speech-voice-picker-loading"
              role="status"
              aria-label="Loading voices"
            >
              <LoadingSpinner />
            </div>
          )}

          {!isLoading &&
            Array.from(voicesByLocale.entries()).map(([locale, localeVoices]) => (
              <details className="speech-voice-picker-locale" key={locale} open>
                <summary className="speech-voice-picker-locale-summary">
                  {getSpeechVoiceLocaleLabel(locale, guiLang)}
                </summary>
                <div className="speech-voice-picker-locale-options">
                  {localeVoices.map((voice) => {
                    const voiceKey = getSpeechVoiceKey(voice);
                    const selected = voicesMatch(activeVoice, voice);
                    const previewing = previewingVoiceKey === voiceKey;
                    const previewable = canPreviewVoice(voice);
                    return (
                      <div className="speech-voice-picker-option" key={voiceKey}>
                        <button
                          type="button"
                          className="speech-voice-picker-select"
                          role="radio"
                          aria-checked={selected}
                          data-selected={selected || undefined}
                          onClick={() => selectVoice(voice)}
                        >
                          <span className="speech-voice-picker-service-icon">
                            {voice.service === "BROWSER" ? (
                              <BrowserIcon />
                            ) : (
                              <CloudIcon />
                            )}
                          </span>
                          <span className="speech-voice-picker-name">
                            {prettifyVoiceId(voice.voice_id)}
                          </span>
                          {selected && (
                            <span className="speech-voice-picker-check">
                              <CheckIcon />
                            </span>
                          )}
                        </button>
                        {previewable && (
                          <button
                            type="button"
                            className="speech-voice-picker-preview"
                            aria-label={`Preview ${prettifyVoiceId(voice.voice_id)}`}
                            aria-busy={previewing}
                            disabled={previewingVoiceKey !== null}
                            onClick={() => void previewVoice(voice)}
                          >
                            {previewing ? <LoadingSpinner /> : <PlayIcon />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
        </div>
      </div>

      <footer className="speech-voice-picker-footer">
        <div className="speech-voice-picker-footer-inner">
          <div className="speech-voice-picker-notes">
            <p>
              <span className="speech-voice-picker-note-icon"><BrowserIcon /></span>
              {" = "}{OAT("Browser Voices")}{". "}
              <span className="speech-voice-picker-note-icon"><CloudIcon /></span>
              {" = "}{OAT("Cloud Voices")}{"."}
            </p>
            <p>
              {OAT("Browser Voices load faster. Cloud Voices are usually higher quality.")}{" "}
              {OAT("Slow speech sounds better with Browser Voices.")}
            </p>
          </div>
          <button
            type="button"
            className="speech-voice-picker-done"
            onClick={onDone}
          >
            {OAT("Done")}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default SpeechSynthLangVoicePicker;
