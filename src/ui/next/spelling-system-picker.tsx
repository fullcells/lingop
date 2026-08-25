"use client";

import { useMemo, type ReactNode } from "react";

import type { AnnotatedText } from "../../core/annotation/types.js";
import {
  getLangName,
  SpellingSystem,
  SpellingSystemsByLang,
} from "../../core/language/index.js";
import { removeBracketedContent } from "../../core/misc.js";
import { useOAT } from "../../oat/react/index.js";
import { AnnotatedTextView } from "./annotated-text.js";
import { useUserLingoPrefsData } from "./user-lingo-prefs.js";

export type SpellingSystemPickerProps = {
  lang: string;
  /** The consumer's current GUI language, used for the language heading and preview gloss. */
  guiLang: string;
  onDone: () => void;
  slimUI?: boolean;
  limitToBeginnerOptions?: boolean;
  showPreviewAudio?: boolean;
};

export type SpellingSystemPickerAsSegmentProps = {
  lang: string;
};

/**
 * Current product policy for the full picker. Keeping this explicit makes the
 * temporary beginner lists easy to find when the policy is revisited.
 */
export function getSpellingSystemPickerOptions(
  lang: string,
  limitToBeginnerOptions = false,
): SpellingSystem[] {
  const allOptions = SpellingSystemsByLang[lang] ?? [];
  if (!limitToBeginnerOptions) return [...allOptions];

  if (lang === "ja") {
    return [SpellingSystem.JA_ROMAJI, SpellingSystem.JA_HIRAGANA];
  }
  if (lang === "yue") {
    return [SpellingSystem.YUE_YALE, SpellingSystem.YUE_JYUTPING];
  }
  if (lang === "en") {
    return [
      SpellingSystem.EN_WIKI,
      SpellingSystem.EN_CL_DIACRITICS,
      SpellingSystem.EN_CL_DIACRITICS_BRE,
      SpellingSystem.EN_IPA,
    ];
  }
  return [...allOptions];
}

/** Current compact-picker policy: at most three representative options. */
export function getSpellingSystemSegmentOptions(
  lang: string,
): SpellingSystem[] {
  let options = SpellingSystemsByLang[lang] ?? [];
  if (lang === "yue") {
    options = [
      SpellingSystem.YUE_JYUTPING,
      SpellingSystem.YUE_YALE,
      SpellingSystem.YUE_IPA,
    ];
  }
  if (lang === "en") {
    options = [
      SpellingSystem.EN_CL_DIACRITICS,
      SpellingSystem.EN_WIKI,
      SpellingSystem.EN_IPA,
    ];
  }
  // Do not inject a preferred system that falls outside this compact policy.
  // The old segmented control behaved more smoothly with a stable maximum of
  // three options; it simply has no active option in that uncommon case.
  return options.slice(0, 3);
}

// Tabler Icons: circle-check-filled SVG. Embedded from Tabler's MIT-licensed
// source so the picker does not force consumers to install an icon runtime for
// a single decorative glyph.
function SelectedIcon(): ReactNode {
  return (
    <svg
      className="spelling-system-picker-selected-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M17 3.34a10 10 0 1 1-14.995 8.984L2 12l.005-.324A10 10 0 0 1 17 3.34Zm-1.293 5.953a1 1 0 0 0-1.32-.083l-.094.083L11 12.585l-1.293-1.292-.094-.083a1 1 0 0 0-1.403 1.403l.083.094 2 2 .094.083a1 1 0 0 0 1.226 0l.094-.083 4-4 .083-.094a1 1 0 0 0-.083-1.32Z"
      />
    </svg>
  );
}

// Alt compact view for picking a spelling system: SpellingSystemSegment.
export function SpellingSystemPickerAsSegment({
  lang,
}: SpellingSystemPickerAsSegmentProps): ReactNode {
  const {
    userPreferredSpellingSystems,
    spellingSystemsInfo,
    setUserPreferredSpellingSystem,
  } = useUserLingoPrefsData();
  const options = getSpellingSystemSegmentOptions(lang);

  if (options.length === 0) return null;

  return (
    <div
      className="spelling-system-picker-segment"
      role="radiogroup"
      aria-label="Spelling system"
    >
      {options.map((spellingSystem) => {
        const info = spellingSystemsInfo[spellingSystem] ?? {
          label: spellingSystem,
        };
        const isSelected =
          userPreferredSpellingSystems[lang] === spellingSystem;
        return (
          <button
            key={spellingSystem}
            type="button"
            className="spelling-system-picker-segment-option"
            role="radio"
            aria-checked={isSelected}
            data-selected={isSelected || undefined}
            onClick={() =>
              setUserPreferredSpellingSystem({ lang, spellingSystem })
            }
          >
            {info.shortLabel ?? removeBracketedContent(info.label)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shared spelling-system preference picker.
 *
 * Dialog ownership deliberately remains with the consumer. Render this inside
 * any sheet/dialog/page and use onDone to close that consumer-owned surface.
 * OATDataProvider supplies localized labels and the static preview annotation;
 * UserLingoPrefsDataProvider supplies and persists the selected preference.
 */
export function SpellingSystemPicker({
  lang,
  guiLang,
  onDone,
  slimUI = false,
  limitToBeginnerOptions = false,
  showPreviewAudio = true,
}: SpellingSystemPickerProps): ReactNode {
  const { OAT, getStaticFocusLangAText } = useOAT();
  const {
    userPreferredSpellingSystems,
    spellingSystemsInfo,
    setUserPreferredSpellingSystem,
    prefShowSpelling,
    setPrefShowSpelling,
  } = useUserLingoPrefsData();
  const spellingSystems = useMemo(
    () => getSpellingSystemPickerOptions(lang, limitToBeginnerOptions),
    [lang, limitToBeginnerOptions],
  );
  const exampleAText: AnnotatedText | null = useMemo(
    () => getStaticFocusLangAText("Where is the toilet?"),
    [getStaticFocusLangAText],
  ); // "There is a small cat at my door. It wants to drink some water."
  const currentSpellingSystem =
    userPreferredSpellingSystems[lang] ?? SpellingSystemsByLang[lang]?.[0];
  const languageName = getLangName(lang, guiLang) ?? lang.toUpperCase();

  return (
    <div className="spelling-system-picker">
      <div className="spelling-system-picker-content">
        {!slimUI && (
          <header className="spelling-system-picker-header">
            <h1>{OAT("Spelling")}</h1>
            <h2>{languageName}</h2>
          </header>
        )}

        <div className="spelling-system-picker-body">
          <div
            className="spelling-system-picker-options"
            role="radiogroup"
            aria-label={OAT("Spelling")}
          >
            <button
              type="button"
              className="spelling-system-picker-option"
              role="radio"
              aria-checked={prefShowSpelling === "NEVER"}
              data-selected={
                prefShowSpelling === "NEVER" ? true : undefined
              }
              onClick={() =>
                setPrefShowSpelling(
                  prefShowSpelling === "ALWAYS" ? "NEVER" : "ALWAYS",
                )
              }
            >
              <span className="spelling-system-picker-option-copy">
                <span>{OAT("None")}</span>
              </span>
              <span className="spelling-system-picker-option-status">
                <SelectedIcon />
              </span>
            </button>

            {spellingSystems.map((spellingSystem) => {
              const info = spellingSystemsInfo[spellingSystem] ?? {
                label: spellingSystem,
              };
              const isSelected =
                currentSpellingSystem === spellingSystem &&
                prefShowSpelling !== "NEVER";
              return (
                <button
                  key={spellingSystem}
                  type="button"
                  className="spelling-system-picker-option"
                  role="radio"
                  aria-checked={isSelected}
                  data-selected={isSelected || undefined}
                  onClick={() => {
                    setUserPreferredSpellingSystem({ lang, spellingSystem });
                    if (prefShowSpelling === "NEVER") {
                      setPrefShowSpelling("ALWAYS");
                    }
                  }}
                >
                  <span className="spelling-system-picker-option-copy">
                    <span className="spelling-system-picker-option-label">
                      {info.label.split("\n").map((line, index) => (
                        <span key={index}>{line.trim()}</span>
                      ))}
                    </span>
                    {info.tagline && (
                      <span className="spelling-system-picker-option-tagline">
                        {info.tagline}
                      </span>
                    )}
                  </span>
                  <span className="spelling-system-picker-option-status">
                    <SelectedIcon />
                  </span>
                </button>
              );
            })}
          </div>

          <section className="spelling-system-picker-preview">
            <div className="spelling-system-picker-preview-label">Preview</div>
            <div className="spelling-system-picker-preview-content">
              {exampleAText && (
                <AnnotatedTextView
                  annotatedText={exampleAText}
                  showActionPlayAudio={showPreviewAudio}
                  showSpelling={"ALWAYS"}
                  glossTextTipLang={guiLang}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      {!slimUI && (
        <footer className="spelling-system-picker-footer">
          <button
            type="button"
            className="spelling-system-picker-done"
            onClick={onDone}
          >
            {OAT("Done")}
          </button>
        </footer>
      )}
    </div>
  );
}

export default SpellingSystemPicker;
