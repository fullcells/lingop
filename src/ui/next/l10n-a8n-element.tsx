"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { AnnotatedText } from "../../core/annotation/types.js";
import { getLang } from "../../core/language/index.js";
import {
  ilike,
  removeBracketedContent,
  type ContentReference,
  type Localization,
} from "../../core/misc.js";
import { useOAT } from "../../oat/react/index.js";
import {
  AnnotatedTextView,
  type AnnotatedTextViewHandle,
} from "./annotated-text.js";
import { useL10nWordDetailPopover } from "./l10n-word-detail-popover.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import * as speechSynthTTS from "./speech-synth-tts.js";
import type { ContentContext } from "./speech-synth-tts.js";
import { useUserLingoPrefsData } from "./user-lingo-prefs.js";

const defaultStyleVals = {
  // 3b82f6 (blue.500), 2563eb (blue.600), 173da6 (blue.700),
  // 1a3478 (blue.800). Originally matched Chakra's colour scale.
  styleSpellingColor: "#173da6",
  styleMainTextColor: "#000",
  // Orange no longer worked alongside the yellow word-tap highlight, so this
  // changed to red on 20260629.
  styleGlossColor: "#dc2626",
};

type StatusMessage = {
  kind: "error" | "success";
  text: string;
};

export type L10nA8nElementProps = {
  localization: Localization;
  guiLang: string;
  focusLang: string;
  showGuiLangText: boolean;
  showControls?: boolean;
  onFeedbackTap?: () => void;
  onAnnotated?: (atext: AnnotatedText) => void; // Doesn't trigger for a preparedFocusA8n.
  contentContext: ContentContext;
  contentRefForLocalization?: ContentReference;
  contentRefForSourceContent?: ContentReference;
  /** null means the parent is still loading the prepared annotation. */
  preparedFocusA8n?: AnnotatedText | null;
  className?: string;
  style?: CSSProperties;
};

function Icon({ name }: { name: "copy" | "feedback" | "image" | "play" }) {
  if (name === "play") {
    return <span aria-hidden="true">▶</span>;
  }
  if (name === "copy") {
    return <span aria-hidden="true">⧉</span>;
  }
  if (name === "image") {
    return <span aria-hidden="true">▧</span>;
  }
  return (
    <svg
      className="lingop-l10n-a8n-element__feedback-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M14 0a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.5a1 1 0 0 0-.8.4l-1.9 2.53a1 1 0 0 1-1.6 0L5.3 12.4a1 1 0 0 0-.8-.4H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12ZM8 9.12a.87.87 0 1 0 .01 1.75A.87.87 0 0 0 8 9.12ZM8.04 2c-.62 0-.93.34-.93 1.03 0 .24.02.63.06 1.18l.18 2.8c.06.73.21 1.09.62 1.09.4 0 .55-.36.62-1.07l.25-2.9c.03-.26.04-.52.04-.78C8.88 2.45 8.65 2 8.04 2Z" />
    </svg>
  );
}

/**
 * An interactive bilingual element that annotates the focus-language text
 * and supplies speech, copy, image-download, and optional feedback controls.
 * Initially designed for the CL Translate site on 20251231.
 *
 * TODO(UI): Consider extracting a smaller reusable bilingual annotated-text
 * view (possibly BiTextView; name TBD). Keep that view separate from transient
 * annotation acquisition; persisted-cache policy belongs to the consumer.
 */
export function L10nA8nElement({
  localization,
  guiLang,
  focusLang,
  showGuiLangText,
  showControls = true,
  onFeedbackTap,
  onAnnotated,
  contentContext,
  contentRefForLocalization,
  contentRefForSourceContent,
  preparedFocusA8n,
  className,
  style,
}: L10nA8nElementProps) {
  const { OAT } = useOAT();
  const {
    apiVoiceAccessProfile,
    lingopClient,
    supabaseClient,
    useStagingBackend,
  } = useLingopClientData();
  const {
    prefShowSpelling,
    prefShowGlossEmoji,
    prefShowGlossText,
  } = useUserLingoPrefsData();
  const l10nWordDetailPopover = useL10nWordDetailPopover({
    guiLang,
    focusLang,
  });
  const atvRef = useRef<AnnotatedTextViewHandle | null>(null);
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const activeAnnotationRequestRef = useRef(0);
  const onAnnotatedRef = useRef(onAnnotated);
  onAnnotatedRef.current = onAnnotated;

  // Convenience vars
  const bilingualText = useMemo(() => {
    const scIsGuiLang = ilike(localization.sourceContent.lang, guiLang);
    const scIsFocusLang = ilike(localization.sourceContent.lang, focusLang);
    if (!scIsGuiLang && !scIsFocusLang) return null; // In-case catch.
    return {
      scIsGuiLang,
      guiLangText: scIsGuiLang ? localization.sourceContent.text : localization.text,
      focusLangText: scIsGuiLang ? localization.text : localization.sourceContent.text,
    };
  }, [focusLang, guiLang, localization]);

  const [focusA8n, setFocusA8n] = useState<AnnotatedText | null>(
    preparedFocusA8n ?? null,
  );
  const [loadingFocusA8n, setLoadingFocusA8n] = useState(false);
  const [isFocusLangSpeakable, setIsFocusLangSpeakable] = useState(false);
  const [isGuiLangSpeakable, setIsGuiLangSpeakable] = useState(false);
  const [isSpeakingFocusLang, setIsSpeakingFocusLang] = useState(false);
  const [isSpeakingGuiLang, setIsSpeakingGuiLang] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  // The existence of spellings is determined manually in the backend per
  // language; there is no authoritative list of languages offering SPELLING.
  const [spelling, setSpelling] = useState<string | null>(null);

  const speechOptions = useMemo(
    () => ({
      ...(supabaseClient ? { supabaseClient } : {}),
      useStagingBackend,
    }),
    [supabaseClient, useStagingBackend],
  );

  // Set focusA8n to preparedFocusA8n when the parent finishes loading it.
  // (Alternatively, preparedFocusA8n could have been handled by a parent
  // useEffect rather than a useMemo.)
  useEffect(() => {
    if (preparedFocusA8n !== undefined) {
      activeAnnotationRequestRef.current += 1;
      setFocusA8n(preparedFocusA8n);
      setLoadingFocusA8n(false);
    }
  }, [preparedFocusA8n]);

  useEffect(() => {
    let active = true;
    setIsFocusLangSpeakable(false);
    void speechSynthTTS
      .getActiveVoiceForLang(focusLang, apiVoiceAccessProfile, speechOptions)
      .then((voice) => {
        if (active) setIsFocusLangSpeakable(Boolean(voice));
      })
      .catch(() => {
        if (active) setIsFocusLangSpeakable(false);
      });
    return () => {
      active = false;
    };
  }, [apiVoiceAccessProfile, focusLang, speechOptions]);

  useEffect(() => {
    let active = true;
    setIsGuiLangSpeakable(false);
    void speechSynthTTS
      .getActiveVoiceForLang(guiLang, apiVoiceAccessProfile, speechOptions)
      .then((voice) => {
        if (active) setIsGuiLangSpeakable(Boolean(voice));
      })
      .catch(() => {
        if (active) setIsGuiLangSpeakable(false);
      });
    return () => {
      active = false;
    };
  }, [apiVoiceAccessProfile, guiLang, speechOptions]);

  // Init - Focus-language A8n
  useEffect(() => {
    if (preparedFocusA8n !== undefined || !bilingualText?.focusLangText) return;

    const requestId = activeAnnotationRequestRef.current + 1;
    activeAnnotationRequestRef.current = requestId;
    const focusLangText = bilingualText.focusLangText;

    async function loadFocusLangA8n() {
      setStatus(null);
      setFocusA8n(null);
      setLoadingFocusA8n(true);
      try {
        // Generate a transient annotation through Lingop. The shared client
        // owns backend selection, session-token forwarding, request
        // deduplication, and its in-memory cache. Cross-session persistence is
        // consumer policy, supplied through preparedFocusA8n/onAnnotated.
        const atext = await lingopClient.createTransientAnnotation({
          lang: focusLang,
          text: focusLangText,
        });
        if (activeAnnotationRequestRef.current !== requestId) return;
        if (!atext) {
          setStatus({ kind: "error", text: OAT("Annotation Error") });
          return;
        }

        // Set
        setFocusA8n(atext);
        onAnnotatedRef.current?.(atext);
      } catch (error) {
        console.error("Could not annotate text:", error);
        if (activeAnnotationRequestRef.current === requestId) {
          setStatus({ kind: "error", text: OAT("Annotation Error") });
        }
      } finally {
        if (activeAnnotationRequestRef.current === requestId) {
          setLoadingFocusA8n(false);
        }
      }
    }

    void loadFocusLangA8n();
  }, [bilingualText?.focusLangText, focusLang, lingopClient, OAT, preparedFocusA8n]);

  // Spelling
  useEffect(() => {
    const interval = window.setInterval(() => {
      setSpelling(atvRef.current?.getSpelling() ?? null);
    }, 100);
    return () => window.clearInterval(interval);
  }, [focusA8n, focusLang]);

  if (!bilingualText) return null;

  const { focusLangText, guiLangText, scIsGuiLang } = bilingualText;
  const focusLangInfo = getLang(focusLang);
  const guiLangInfo = getLang(guiLang);
  const focusLangName = removeBracketedContent(
    focusLangInfo?.name_natural ?? focusLang,
  );
  const guiLangName = removeBracketedContent(
    guiLangInfo?.name_natural ?? guiLang,
  );

  async function copyText(text: string | null, description: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ kind: "success", text: `${OAT("Copied")}: ${description}` });
    } catch (error) {
      console.error("Could not copy text:", error);
      setStatus({ kind: "error", text: OAT("Error") });
    }
  }

  async function speakText(
    text: string,
    lang: string,
    ref: ContentReference | undefined,
    setSpeaking: (speaking: boolean) => void,
  ) {
    setSpeaking(true);
    try {
      await speechSynthTTS.speak({
        text,
        lang,
        apiVoiceAccessProfile,
        contentContext,
        ...(ref ? { ref } : {}),
        ...speechOptions,
      });
    } catch (error) {
      console.error("Could not speak text:", error);
      setStatus({ kind: "error", text: OAT("Error") });
    } finally {
      setSpeaking(false);
    }
  }

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  // A8n applies to focusLang, regardless of whether that is the localization
  // or localization.sourceContent.
  return (
    <div
      className={["lingop-l10n-a8n-element", className].filter(Boolean).join(" ")}
      style={style}
    >
      {/* MAIN */}
      <div
        className="lingop-l10n-a8n-element__main"
        data-source-content-is-gui-lang={scIsGuiLang ? "true" : "false"}
      >
        {showGuiLangText && (
          <div className="lingop-l10n-a8n-element__gui-text">{guiLangText}</div>
        )}
        <div className="lingop-l10n-a8n-element__focus-text">
          {!focusA8n && !loadingFocusA8n && preparedFocusA8n !== null && focusLangText}
          {(loadingFocusA8n || preparedFocusA8n === null) && (
            <span
              className="lingop-l10n-a8n-element__spinner"
              role="status"
              aria-label={OAT("Loading Annotations")}
            />
          )}
          {focusA8n && (
            <AnnotatedTextView
              annotatedText={focusA8n}
              ref={atvRef}
              astyle={{
                spellingColor: defaultStyleVals.styleSpellingColor,
                mainTextColor: defaultStyleVals.styleMainTextColor,
                glossTextColor: defaultStyleVals.styleGlossColor,
                glossEmojiColor: defaultStyleVals.styleGlossColor,
              }}
              showSpelling={prefShowSpelling}
              showGlossEmoji={prefShowGlossEmoji}
              showGlossText={prefShowGlossText}
              glossTextTipLang={guiLang}
              apiVoiceAccessProfile={apiVoiceAccessProfile}
              l10nWordDetailHandler={
                l10nWordDetailPopover.l10nWordDetailHandler
              }
            />
          )}
        </div>
      </div>

      {/* CONTROLS */}
      {showControls && (
        <div className="lingop-l10n-a8n-element__controls">
          {/* - TTS FOCUSLANG */}
          {isFocusLangSpeakable && focusLangText && (
            <button
              type="button"
              className="lingop-l10n-a8n-element__control"
              disabled={isSpeakingFocusLang}
              onClick={() => {
                void speakText(
                  focusLangText,
                  focusLang,
                  scIsGuiLang
                    ? contentRefForLocalization
                    : contentRefForSourceContent,
                  setIsSpeakingFocusLang,
                );
              }}
            >
              {isSpeakingFocusLang ? (
                <span className="lingop-l10n-a8n-element__spinner" aria-hidden="true" />
              ) : (
                <Icon name="play" />
              )}
              <span>{focusLangName}</span>
            </button>
          )}

          {/* - Copy FOCUSLANG */}
          <button
            type="button"
            className="lingop-l10n-a8n-element__control"
            onClick={() => void copyText(focusLangText, focusLangText)}
          >
            <Icon name="copy" />
            <span>{OAT("Copy")}</span>
            <span>{focusLangName}</span>
          </button>

          {/* - Gap */}
          <span className="lingop-l10n-a8n-element__control-gap" />

          {/* - Feedback */}
          {onFeedbackTap && (
            <button
              type="button"
              className="lingop-l10n-a8n-element__icon-control"
              aria-label={OAT("Feedback")}
              onClick={onFeedbackTap}
            >
              <Icon name="feedback" />
            </button>
          )}

          {/* - Menu */}
          <details className="lingop-l10n-a8n-element__menu" ref={menuRef}>
            <summary
              className="lingop-l10n-a8n-element__icon-control"
              aria-label={OAT("More")}
            >
              <span aria-hidden="true">•••</span>
            </summary>
            <div className="lingop-l10n-a8n-element__menu-content">
              {/* - DOWNLOAD JPG (FOCUS) */}
              <button
                type="button"
                className="lingop-l10n-a8n-element__menu-item"
                onClick={() => {
                  closeMenu();
                  void atvRef.current?.requestDownloadImage(1).catch((error) => {
                    console.error("Could not download annotation image:", error);
                    setStatus({ kind: "error", text: OAT("Error") });
                  });
                }}
              >
                <Icon name="image" />
                <span>{OAT("Download")} JPG</span>
                <span>{focusLangInfo?.display_code ?? focusLang}</span>
              </button>

              {spelling && (
                <>
                  {/* - COPY SPELLING */}
                  <button
                    type="button"
                    className="lingop-l10n-a8n-element__menu-item"
                    onClick={() => {
                      closeMenu();
                      void copyText(spelling, spelling);
                    }}
                  >
                    <Icon name="copy" />
                    <span>{OAT("Copy Spelling")}</span>
                  </button>
                </>
              )}

              <div className="lingop-l10n-a8n-element__menu-separator" />
              <div className="lingop-l10n-a8n-element__menu-label">
                {guiLangInfo?.name_natural ?? guiLang}
              </div>

              {/* - TTS GUILANG */}
              {isGuiLangSpeakable && guiLangText && (
                <button
                  type="button"
                  className="lingop-l10n-a8n-element__menu-item"
                  disabled={isSpeakingGuiLang}
                  onClick={() => {
                    closeMenu();
                    void speakText(
                      guiLangText,
                      guiLang,
                      scIsGuiLang
                        ? contentRefForSourceContent
                        : contentRefForLocalization,
                      setIsSpeakingGuiLang,
                    );
                  }}
                >
                  {isSpeakingGuiLang ? (
                    <span className="lingop-l10n-a8n-element__spinner" aria-hidden="true" />
                  ) : (
                    <Icon name="play" />
                  )}
                  <span>{guiLangName}</span>
                </button>
              )}

              {/* - Copy GUILANG */}
              <button
                type="button"
                className="lingop-l10n-a8n-element__menu-item"
                onClick={() => {
                  closeMenu();
                  void copyText(guiLangText, guiLangText);
                }}
              >
                <Icon name="copy" />
                <span>{OAT("Copy")}</span>
                <span>{guiLangName}</span>
              </button>
            </div>
          </details>
        </div>
      )}

      {status && (
        <div
          className={`lingop-l10n-a8n-element__status lingop-l10n-a8n-element__status--${status.kind}`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.text}
        </div>
      )}

      {/* COMMON */}
      {l10nWordDetailPopover.PopoverComponent}
    </div>
  );
}

export default L10nA8nElement;
