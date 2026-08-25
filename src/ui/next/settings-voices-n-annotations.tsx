"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  doesLangMainScriptHaveReadingGuide,
  getLang,
  SpellingSystemsByLang,
} from "../../core/language/index.js";
import { replaceCurliesWithPrettyLang } from "../../core/misc.js";
import { useOAT } from "../../oat/react/index.js";
import { ilike } from "../../utils/string.js";
import type { TripleDisplayState } from "../types.js";
import { AnnotatedTextView } from "./annotated-text.js";
import { useL10nWordDetailPopover } from "./l10n-word-detail-popover.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import {
  getSettingsVoiceLangs,
  resolvePreferredSpellingSystem,
} from "./settings-voices-n-annotations-utils.js";
import { SpeechSynthLangVoicePicker } from "./speech-synth-lang-voice-picker.js";
import * as speechSynthTTS from "./speech-synth-tts.js";
import type { SpeechSynthTTSVoice } from "./speech-synth-tts.js";
import { SpellingSystemPicker } from "./spelling-system-picker.js";
import { useUserLingoPrefsData } from "./user-lingo-prefs.js";

type SettingsScreen =
  | { type: "MAIN" }
  | { type: "VOICE"; lang: string }
  | { type: "SPELLING" }
  | { type: "BACKGROUND_WORDS" };

type NavigationDirection = "FORWARD" | "BACK";

export type SettingsVoicesNAnnotationsUIProps = {
  guiLang: string;
  focusLang?: string | null;
  showGuiLangVoiceSetting?: boolean;
  showNonCoreWordOptions?: boolean;
  /** CSS color used by switches, segmented controls, and nested pickers. */
  accentColor?: string;
  className?: string;
};

type ActiveVoiceState = {
  voice: SpeechSynthTTSVoice | null;
  setVoice: Dispatch<SetStateAction<SpeechSynthTTSVoice | null>>;
  isLoading: boolean;
};

function useActiveVoiceForLang(lang: string | null): ActiveVoiceState {
  const { apiVoiceAccessProfile, supabaseClient, useStagingBackend } =
    useLingopClientData();
  const [voice, setVoice] = useState<SpeechSynthTTSVoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const speechOptions = useMemo(
    () => ({
      ...(supabaseClient ? { supabaseClient } : {}),
      useStagingBackend,
    }),
    [supabaseClient, useStagingBackend],
  );

  useEffect(() => {
    let cancelled = false;
    setVoice(null);
    if (!lang) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void speechSynthTTS
      .getActiveVoiceForLang(lang, apiVoiceAccessProfile, speechOptions)
      .then((activeVoice) => {
        if (!cancelled) setVoice(activeVoice);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Could not load the active voice for ${lang}: ${message}`);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiVoiceAccessProfile, lang, speechOptions]);

  return { voice, setVoice, isLoading };
}

/**
 * Shared voice and annotation settings content.
 *
 * Consumers own the outer dialog/sheet/page and supply their narrow language
 * inputs. Nested choices use animated page-like navigation rather than opening
 * additional root dialogs.
 */
export function SettingsVoicesNAnnotationsUI({
  guiLang,
  focusLang = null,
  showGuiLangVoiceSetting = false,
  showNonCoreWordOptions = true,
  accentColor = "#2563eb",
  className,
}: SettingsVoicesNAnnotationsUIProps) {
  const { OAT, OAT2, getStaticFocusLangAText } = useOAT();
  const {
    showMainTextReadingGuide,
    setShowMainTextReadingGuide,
    prefShowSpelling,
    setPrefShowSpelling,
    prefShowMainText,
    setPrefShowMainText,
    fadeNonCoreWords,
    setFadeNonCoreWords,
    showNonCoreSpelling,
    setShowNonCoreSpelling,
    showNonCoreGlossEmoji,
    setShowNonCoreGlossEmoji,
    showNonCoreGlossText,
    setShowNonCoreGlossText,
    prefShowGlossText,
    setPrefShowGlossText,
    prefShowGlossEmoji,
    setPrefShowGlossEmoji,
    userPreferredSpellingSystems,
    spellingSystemsInfo,
  } = useUserLingoPrefsData();
  const [screen, setScreen] = useState<SettingsScreen>({ type: "MAIN" });
  const [navigationDirection, setNavigationDirection] =
    useState<NavigationDirection>("FORWARD");
  const wordDetailPopover = useL10nWordDetailPopover({
    guiLang,
    ...(focusLang ? { focusLang } : {}),
  });

  const voiceLangs = getSettingsVoiceLangs({
    guiLang,
    focusLang,
    showGuiLangVoiceSetting,
  });
  // Avoid loading the same language twice when GUI and focus languages match.
  const guiVoice = useActiveVoiceForLang(
    showGuiLangVoiceSetting || focusLang === guiLang ? guiLang : null,
  );
  const focusVoice = useActiveVoiceForLang(
    focusLang && focusLang !== guiLang ? focusLang : null,
  );
  const getVoiceState = (lang: string): ActiveVoiceState =>
    lang === guiLang ? guiVoice : focusVoice;

  const focusSpellingSystems = focusLang
    ? (SpellingSystemsByLang[focusLang] ?? [])
    : [];
  const currentSpellingSystem = resolvePreferredSpellingSystem({
    availableSystems: focusSpellingSystems,
    ...(focusLang && userPreferredSpellingSystems[focusLang]
      ? { preferredSystem: userPreferredSpellingSystems[focusLang] }
      : {}),
  });
  const currentSpellingSystemInfo = currentSpellingSystem
    ? spellingSystemsInfo[currentSpellingSystem]
    : undefined;
  const hasReadingGuide = focusLang
    ? doesLangMainScriptHaveReadingGuide(focusLang)
    : false;
  const exampleAText = useMemo(
    () =>
      getStaticFocusLangAText(
        "There is a small cat at my door. It wants to drink some water.",
      ),
    [getStaticFocusLangAText],
  );

  const navigateForward = useCallback(
    (nextScreen: SettingsScreen) => {
      wordDetailPopover.closeL10nWordDetail();
      setNavigationDirection("FORWARD");
      setScreen(nextScreen);
    },
    [wordDetailPopover.closeL10nWordDetail],
  );
  const navigateBack = useCallback(() => {
    wordDetailPopover.closeL10nWordDetail();
    setNavigationDirection("BACK");
    setScreen({ type: "MAIN" });
  }, [wordDetailPopover.closeL10nWordDetail]);

  useEffect(() => {
    const screenIsUnavailable =
      (screen.type === "SPELLING" && !focusLang) ||
      (screen.type === "BACKGROUND_WORDS" && !showNonCoreWordOptions) ||
      (screen.type === "VOICE" && !voiceLangs.includes(screen.lang));
    if (screenIsUnavailable) navigateBack();
  }, [focusLang, navigateBack, screen, showNonCoreWordOptions, voiceLangs]);

  const screenKey =
    screen.type === "VOICE" ? `VOICE-${screen.lang}` : screen.type;
  const rootStyle = {
    "--lingop-settings-accent": accentColor,
  } as CSSProperties;

  let page: React.ReactNode;
  if (screen.type === "VOICE") {
    const voiceState = getVoiceState(screen.lang);
    page = (
      <SpeechSynthLangVoicePicker
        lang={screen.lang}
        guiLang={guiLang}
        {...(screen.lang === focusLang
          ? {
              previewText: OAT2(
                "There is a small cat at my door. It wants to drink some water.",
              ),
            }
          : screen.lang === guiLang
            ? {
                previewText: OAT(
                  "There is a small cat at my door. It wants to drink some water.",
                ),
              }
            : {})}
        previewContentContext="PUBLIC_CONTENT"
        previewContentRef={{ file: "OAT" }}
        onVoiceChange={voiceState.setVoice}
        onDone={navigateBack}
      />
    );
  } else if (screen.type === "SPELLING" && focusLang) {
    page = (
      <SpellingSystemPicker
        lang={focusLang}
        guiLang={guiLang}
        onDone={navigateBack}
      />
    );
  } else if (screen.type === "BACKGROUND_WORDS") {
    page = (
      <SettingsSubpage title={OAT("Background Words")} onBack={navigateBack}>
        <div className="lingop-settings-card">
          <SwitchRow
            label={OAT("Fade Background Words")}
            checked={fadeNonCoreWords}
            onChange={setFadeNonCoreWords}
          />
          {fadeNonCoreWords && (
            <>
              <TripleVisibilityToggleRow
                label={OAT("Spelling")}
                value={showNonCoreSpelling}
                onChange={setShowNonCoreSpelling}
                guiLang={guiLang}
                focusLang={focusLang}
              />
              <TripleVisibilityToggleRow
                label={OAT("Emojis")}
                value={showNonCoreGlossEmoji}
                onChange={setShowNonCoreGlossEmoji}
                guiLang={guiLang}
                focusLang={focusLang}
              />
              <TripleVisibilityToggleRow
                label={OAT("Word Translations")}
                value={showNonCoreGlossText}
                onChange={setShowNonCoreGlossText}
                guiLang={guiLang}
                focusLang={focusLang}
              />
            </>
          )}
        </div>
      </SettingsSubpage>
    );
  } else {
    page = (
      <div className="lingop-settings-main">
        {/* AUDIO VOICE */}
        <SettingsSection icon="🔊" title={OAT("Audio")}>
          {voiceLangs.map((lang) => {
            const voiceState = getVoiceState(lang);
            return (
              <NavigationRow
                key={lang}
                label={getLang(lang)?.name_natural ?? lang.toUpperCase()}
                value={
                  voiceState.isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    speechSynthTTS.prettifyVoiceId(voiceState.voice?.voice_id ?? "")
                  )
                }
                onClick={() => navigateForward({ type: "VOICE", lang })}
              />
            );
          })}
          <SpeechSpeedControlUI focusLang={focusLang} />
        </SettingsSection>

        {/* SPELLING */}
        {(focusSpellingSystems.length > 0 || hasReadingGuide) && (
          <SettingsSection icon="🗣" title={OAT("Spelling")}>
            {focusSpellingSystems.length > 0 && (
              <>
                <TripleVisibilityToggleRow
                  label={OAT("Show Spelling")}
                  value={prefShowSpelling}
                  onChange={setPrefShowSpelling}
                  guiLang={guiLang}
                  focusLang={focusLang}
                />
                {prefShowSpelling !== "NEVER" && (
                  <NavigationRow
                    label={OAT("Spelling")}
                    value={
                      currentSpellingSystemInfo?.shortLabel ??
                      currentSpellingSystemInfo?.label ??
                      ""
                    }
                    onClick={() => navigateForward({ type: "SPELLING" })}
                  />
                )}
              </>
            )}
            {hasReadingGuide && (
              <SwitchRow
                label={OAT("Reading Guide")}
                checked={showMainTextReadingGuide}
                onChange={setShowMainTextReadingGuide}
              />
            )}
          </SettingsSection>
        )}

        {/* MAIN-TEXT */}
        <SettingsSection icon="📜" title={OAT("Original Text")}>
          <SwitchRow
            label={OAT("Show Original Text")}
            // "Show Original Text" historically translated more reliably than
            // sentence-case variants and remains consistent with Show Spelling.
            checked={prefShowMainText}
            onChange={setPrefShowMainText}
          />
          {prefShowMainText && showNonCoreWordOptions && (
            <NavigationRow
              label={OAT("Background Words")}
              value={fadeNonCoreWords ? OAT("Faded") : OAT("Not Faded")}
              valueFaded={fadeNonCoreWords}
              onClick={() => navigateForward({ type: "BACKGROUND_WORDS" })}
            />
          )}
        </SettingsSection>

        {/* GLOSS */}
        <SettingsSection icon="文" title={OAT("Word Translations")}>
          <TripleVisibilityToggleRow
            label={OAT("Emoji")}
            value={prefShowGlossEmoji}
            onChange={setPrefShowGlossEmoji}
            guiLang={guiLang}
            focusLang={focusLang}
          />
          <TripleVisibilityToggleRow
            label={getLang(guiLang)?.name_natural ?? guiLang}
            value={prefShowGlossText}
            onChange={setPrefShowGlossText}
            guiLang={guiLang}
            focusLang={focusLang}
            footnote={replaceCurliesWithPrettyLang(
              OAT(
                "You can also tap on a word at any time to view its {LANGUAGE} translation.",
              ),
              guiLang,
              guiLang,
            )}
          />
        </SettingsSection>

        {/* A8N PREVIEW */}
        {focusLang && (
          <SettingsSection icon="👓" title={OAT("Preview")} isPreview>
            <AnnotatedTextView
              annotatedText={exampleAText}
              showGlossEmoji={prefShowGlossEmoji}
              showGlossText={prefShowGlossText}
              glossTextTipLang={guiLang}
              l10nWordDetailHandler={wordDetailPopover.l10nWordDetailHandler}
            />
          </SettingsSection>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        "lingop-settings-voices-annotations",
        className,
      ].filter(Boolean).join(" ")}
      style={rootStyle}
    >
      <div
        key={screenKey}
        className="lingop-settings-page"
        data-direction={navigationDirection}
        data-screen={screen.type}
      >
        {page}
      </div>
      {wordDetailPopover.PopoverComponent}
    </div>
  );
}

export type TripleVisibilityToggleRowProps = {
  label: string;
  value: TripleDisplayState;
  onChange: (value: TripleDisplayState) => void;
  guiLang: string;
  focusLang?: string | null;
  footnote?: string;
  className?: string;
};

/** Shared three-state preference row used by main and non-core settings. */
export function TripleVisibilityToggleRow({
  label,
  value,
  onChange,
  guiLang,
  focusLang,
  footnote,
  className,
}: TripleVisibilityToggleRowProps) {
  const { OAT } = useOAT();
  const labels: Record<TripleDisplayState, string> = {
    NEVER: OAT("Hidden"),
    ON_HINT: OAT("On Hint"),
    ALWAYS: OAT("Visible"),
  };
  const isJapanese = ilike(guiLang, "ja") || ilike(focusLang ?? "", "ja");

  return (
    <div
      className={[
        "lingop-settings-row",
        "lingop-settings-triple-row",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div className="lingop-settings-row__main">
        <span className="lingop-settings-row__label">{label}</span>
        <span className="lingop-settings-row__state">{labels[value]}</span>
        <div
          className="lingop-settings-segment"
          role="radiogroup"
          aria-label={label}
          data-value={value}
        >
          {(["NEVER", "ON_HINT", "ALWAYS"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              aria-label={labels[option]}
              data-selected={value === option || undefined}
              onClick={() => onChange(option)}
            >
              {option === "NEVER" ? (
                <XIcon />
              ) : option === "ON_HINT" ? (
                <LightbulbIcon filled={value === option} />
              ) : isJapanese ? (
                <CircleIcon />
              ) : (
                <CheckIcon />
              )}
            </button>
          ))}
        </div>
      </div>
      {footnote && <p className="lingop-settings-row__footnote">{footnote}</p>}
    </div>
  );
}

function SpeechSpeedControlUI({ focusLang }: { focusLang: string | null }) {
  const { OAT, OAT2 } = useOAT();
  const { apiVoiceAccessProfile, supabaseClient, useStagingBackend } =
    useLingopClientData();
  const [isPreviewingSpeech, setIsPreviewingSpeech] = useState(false);
  const [sliderValue, setSliderValue] = useState(
    speechSynthTTS.DEFAULT_USER_PREFERRED_VOICE_SPEED,
  );

  useEffect(() => {
    setSliderValue(speechSynthTTS.getUserPreferredVoiceSpeed());
  }, []);

  const persistSliderValue = () => {
    setSliderValue(speechSynthTTS.setUserPreferredVoiceSpeed(sliderValue));
  };

  const previewSpeech = async () => {
    if (!focusLang) return;
    setIsPreviewingSpeech(true);
    try {
      await speechSynthTTS.speak({
        text: OAT2(
          "There is a small cat at my door. It wants to drink some water.",
        ),
        lang: focusLang,
        apiVoiceAccessProfile,
        contentContext: "PUBLIC_CONTENT",
        ref: { file: "OAT" },
        ...(supabaseClient ? { supabaseClient } : {}),
        useStagingBackend,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Could not preview speech speed: ${message}`);
    } finally {
      setIsPreviewingSpeech(false);
    }
  };

  return (
    <div className="lingop-settings-row lingop-settings-speed-row">
      <span className="lingop-settings-row__label">{OAT("Speed")}</span>
      <div className="lingop-settings-speed">
        {/* OmniAccess carried a deferred note about not recommending slower
            speeds for cloud voices. Keep that product-copy decision deferred;
            the shared control intentionally exposes the existing full range. */}
        <input
          type="range"
          aria-label={OAT("Speed")}
          min={speechSynthTTS.MIN_USER_PREFERRED_VOICE_SPEED}
          max={speechSynthTTS.MAX_USER_PREFERRED_VOICE_SPEED}
          step={0.1}
          value={sliderValue}
          onChange={(event) => setSliderValue(Number(event.currentTarget.value))}
          onPointerUp={persistSliderValue}
          onKeyUp={persistSliderValue}
          onBlur={persistSliderValue}
        />
        <div className="lingop-settings-speed__marks" aria-hidden="true">
          <span>🐢</span><span>⚖</span><span>🐇</span>
        </div>
      </div>
      <button
        type="button"
        className="lingop-settings-icon-button"
        aria-label={OAT("Preview")}
        disabled={!focusLang || isPreviewingSpeech}
        onClick={() => void previewSpeech()}
      >
        {isPreviewingSpeech ? <LoadingSpinner /> : <PlayIcon />}
      </button>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  children,
  isPreview = false,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  isPreview?: boolean;
}) {
  return (
    <section className="lingop-settings-section">
      <h2><span aria-hidden="true">{icon}</span><span>{title}</span></h2>
      <div
        className="lingop-settings-card"
        data-preview={isPreview || undefined}
      >
        {children}
      </div>
    </section>
  );
}

function SettingsSubpage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { OAT } = useOAT();
  return (
    <div className="lingop-settings-subpage">
      <header>
        <button
          type="button"
          className="lingop-settings-back-button"
          aria-label={OAT("Back")}
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h2>{title}</h2>
      </header>
      {children}
    </div>
  );
}

function NavigationRow({
  label,
  value,
  valueFaded = false,
  onClick,
}: {
  label: string;
  value?: React.ReactNode;
  valueFaded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="lingop-settings-row lingop-settings-navigation-row"
      onClick={onClick}
    >
      <span className="lingop-settings-row__label">{label}</span>
      {value !== undefined && (
        <span
          className="lingop-settings-row__value"
          data-faded={valueFaded || undefined}
        >
          {value}
        </span>
      )}
      <ChevronRightIcon />
    </button>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="lingop-settings-row">
      <span className="lingop-settings-row__label">{label}</span>
      <button
        type="button"
        className="lingop-settings-switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return <span className="lingop-settings-spinner" aria-hidden="true" />;
}

function ChevronRightIcon() {
  return <svg className="lingop-settings-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></svg>;
}

function XIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function CircleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" /></svg>;
}

function LightbulbIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-filled={filled || undefined}>
      <path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" />
    </svg>
  );
}

export default SettingsVoicesNAnnotationsUI;
