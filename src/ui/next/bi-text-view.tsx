"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

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
  kind: "error";
  text: string;
};

type CopyToastMessage = {
  id: number;
  kind: "error" | "success";
  title: string;
  description?: string;
};

export type BiTextViewProps = {
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

function Icon({
  name,
}: {
  name: "copy" | "feedback" | "image" | "more" | "play";
}) {
  const paths = {
    copy: (
      <>
        <path d="M8 8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H8Z" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2" />
      </>
    ),
    feedback: (
      <>
        <path d="M12 20l-3.5-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2.5L12 20Z" />
        <path d="M12 8v3" />
        <path d="M12 14h.01" />
      </>
    ),
    image: (
      <>
        <path d="M15 8h.01" />
        <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="m4 15 4-4a3 3 0 0 1 3 0l5 5" />
        <path d="m14 14 1-1a3 3 0 0 1 3 0l2 2" />
      </>
    ),
    more: (
      <>
        <path d="M5 12h.01" />
        <path d="M12 12h.01" />
        <path d="M19 12h.01" />
      </>
    ),
    play: <path d="M7 4v16l13-8L7 4Z" />,
  };

  return (
    <svg
      className="lingop-l10n-a8n-element__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * An interactive bilingual text view that annotates the focus-language text
 * and supplies speech, copy, image-download, and optional feedback controls.
 * Initially designed for the CL Translate site on 20251231.
 *
 * This is intentionally the reusable bilingual-text view for current Lingop
 * consumers. It owns transient annotation acquisition as well as presentation;
 * persisted-cache policy remains consumer-owned. If a future consumer needs a
 * presentation-only layer, extract that smaller boundary when it is needed.
 */
export function BiTextView({
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
}: BiTextViewProps) {
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
  const [copyToast, setCopyToast] = useState<CopyToastMessage | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextCopyToastIdRef = useRef(0);
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

  useEffect(
    () => () => {
      if (copyToastTimerRef.current !== null) {
        clearTimeout(copyToastTimerRef.current);
      }
    },
    [],
  );

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
      showCopyToast({
        kind: "success",
        title: OAT("Copied"),
        description,
      });
    } catch (error) {
      console.error("Could not copy text:", error);
      showCopyToast({ kind: "error", title: OAT("Error") });
    }
  }

  function showCopyToast(message: Omit<CopyToastMessage, "id">) {
    if (copyToastTimerRef.current !== null) {
      clearTimeout(copyToastTimerRef.current);
    }
    nextCopyToastIdRef.current += 1;
    setCopyToast({ ...message, id: nextCopyToastIdRef.current });
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToast(null);
      copyToastTimerRef.current = null;
    }, message.kind === "error" ? 4_000 : 2_500);
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
          {!focusA8n && focusLangText}
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
              <Icon name="more" />
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

      {copyToast &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            key={copyToast.id}
            className={`lingop-l10n-a8n-element__toast lingop-l10n-a8n-element__toast--${copyToast.kind}`}
            role={copyToast.kind === "error" ? "alert" : "status"}
            aria-atomic="true"
          >
            <strong>{copyToast.title}</strong>
            {copyToast.description && (
              <span className="lingop-l10n-a8n-element__toast-description">
                {copyToast.description}
              </span>
            )}
          </div>,
          document.body,
        )}

      {/* COMMON */}
      {l10nWordDetailPopover.PopoverComponent}
    </div>
  );
}

export default BiTextView;
