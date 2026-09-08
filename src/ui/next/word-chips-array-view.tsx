"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { getLang, getLangScript } from "../../core/language/index.js";
import { WORD_STREAKS_MASTERY_THRESHOLD } from "../../core/word-lists.js";
import { useOAT } from "../../oat/react/index.js";
import { AnchoredPopover } from "./anchored-popover.js";
import { useL10nWordDetailPopover } from "./l10n-word-detail-popover.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import { useOptionalUserWordStreaksData } from "./user-word-streaks.js";
import {
  buildCanonicalWordCaseMap,
  resolveWordDisplayCase,
} from "./word-chips-array-view-utils.js";

export type L10nWordTapHandler = (
  l10nWord: string,
  event: MouseEvent<HTMLElement>,
) => void;

export type WordChipsArrayViewProps = {
  words: readonly string[];
  /** Language of the displayed words (normally the current focus language). */
  lang: string;
  /** Interface language used by the built-in word-details popover. */
  guiLang: string;
  /** Shows controls when a UserWordStreaksDataProvider is available. */
  showWordStreaks?: boolean;
  /** Override this when a parent owns one popover across several arrays. */
  onL10nWordTap?: L10nWordTapHandler;
  className?: string;
};

type StreakSelection = {
  word: string;
  anchor: HTMLElement;
};

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** A wrapping array of tappable words with optional learning-state controls. */
export function WordChipsArrayView({
  words,
  lang,
  guiLang,
  showWordStreaks = false,
  onL10nWordTap,
  className,
}: WordChipsArrayViewProps): ReactNode {
  const { OAT } = useOAT();
  const { lingopClient } = useLingopClientData();
  const wordStreaksData = useOptionalUserWordStreaksData();
  const wordDetailPopover = useL10nWordDetailPopover({
    guiLang,
    focusLang: lang,
  });
  const [canonicalCaseResult, setCanonicalCaseResult] = useState<{
    lang: string;
    wordCases: Record<string, string>;
  } | null>(null);
  const [streakSelection, setStreakSelection] =
    useState<StreakSelection | null>(null);
  const [streakPopoverOpen, setStreakPopoverOpen] = useState(false);
  const streakSelectionRef = useRef<StreakSelection | null>(null);
  const streakPopoverOpenRef = useRef(false);

  const langScript = useMemo(() => {
    const scriptCode = getLang(lang)?.g_script ?? "";
    return getLangScript(scriptCode);
  }, [lang]);
  const isLangCaseSensitive = langScript?.case_sensitive ?? false;
  const canonicalWordCases =
    canonicalCaseResult?.lang === lang
      ? canonicalCaseResult.wordCases
      : null;

  useEffect(() => {
    let active = true;

    // A. Skip the SBWords lookup if the language's script is case-insensitive.
    if (!isLangCaseSensitive) {
      return () => {
        active = false;
      };
    }

    // B. For case-sensitive languages, recover canonical display forms from
    // SBWords. FUTURE: If this becomes costly beyond the existing language-
    // direction cache, add a targeted canonical-case client lookup rather than
    // making every visual consumer reproduce this policy.
    void lingopClient
      .getSBWordsForLangDir(lang, "en")
      .then((sbWords) => {
        if (!active) return;
        setCanonicalCaseResult({
          lang,
          wordCases: buildCanonicalWordCaseMap(sbWords),
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.warn("Could not load canonical word casing.", error);
        setCanonicalCaseResult({ lang, wordCases: {} });
      });

    return () => {
      active = false;
    };
  }, [isLangCaseSensitive, lang, lingopClient]);

  useEffect(() => {
    if (
      !showWordStreaks ||
      !wordStreaksData ||
      wordStreaksData.userWordStreaks[lang] !== undefined
    ) {
      return;
    }
    void wordStreaksData
      .ensureUserWordStreaksForLang(lang)
      .catch((error: unknown) => {
        console.warn("Could not load word streaks for the chips.", error);
      });
  }, [lang, showWordStreaks, wordStreaksData]);

  const displayWords = useMemo(
    () =>
      words.map((word) =>
        resolveWordDisplayCase({
          word,
          isLangCaseSensitive,
          canonicalWordCases,
        }),
      ),
    [canonicalWordCases, isLangCaseSensitive, words],
  );

  const handleWordTap = useCallback<L10nWordTapHandler>(
    (word, event) => {
      if (onL10nWordTap) {
        onL10nWordTap(word, event);
        return;
      }
      wordDetailPopover.openL10nWordDetail(
        { l10nWord: word, l10nLang: lang },
        event,
      );
    },
    [lang, onL10nWordTap, wordDetailPopover.openL10nWordDetail],
  );

  const updateStreakPopoverOpen = useCallback((nextOpen: boolean) => {
    streakPopoverOpenRef.current = nextOpen;
    setStreakPopoverOpen(nextOpen);
  }, []);

  const handleStreakTap = useCallback(
    (word: string, event: MouseEvent<HTMLElement>) => {
      const tappedAnchor = event.currentTarget;
      if (
        streakPopoverOpenRef.current &&
        streakSelectionRef.current?.anchor === tappedAnchor
      ) {
        updateStreakPopoverOpen(false);
        return;
      }
      const nextSelection = { word, anchor: tappedAnchor };
      streakSelectionRef.current = nextSelection;
      setStreakSelection(nextSelection);
      updateStreakPopoverOpen(true);
    },
    [updateStreakPopoverOpen],
  );

  const streakCount = streakSelection
    ? (wordStreaksData?.userWordStreaks[lang]?.[
        streakSelection.word.toUpperCase()
      ] ?? 0)
    : 0;

  async function setSelectedWordMastered() {
    if (!streakSelection || !wordStreaksData) return;
    if (streakCount >= WORD_STREAKS_MASTERY_THRESHOLD) return;
    await wordStreaksData.setUserWordStreaksToValue(
      lang,
      [streakSelection.word],
      WORD_STREAKS_MASTERY_THRESHOLD,
    );
  }

  async function resetSelectedWordStreak() {
    if (!streakSelection || !wordStreaksData) return;
    await wordStreaksData.deleteUserWordStreaks(lang, [streakSelection.word]);
  }

  return (
    <>
      <div
        className={joinClassNames("lingop-word-chips-array", className)}
        lang={lang}
        {...(langScript?.is_ltr === false ? { dir: "rtl" } : {})}
      >
        {displayWords.length === 0 && (
          <div className="lingop-word-chips-array__empty">
            0 {OAT("Words")}
          </div>
        )}

        {/* FUTURE: Very large arrays (for example, LingoDex milestones) may
        still benefit from paging or virtualization. Chips now render
        immediately and share one streak popover, avoiding the old per-chip
        controller cost and the plain-text-to-chip replacement. */}
        {displayWords.map((word, index) => (
          <WordChip
            key={`${words[index]?.toUpperCase() ?? word.toUpperCase()}-${index}`}
            word={word}
            wordStreakCount={
              wordStreaksData?.userWordStreaks[lang]?.[word.toUpperCase()] ?? 0
            }
            showWordStreaks={showWordStreaks && Boolean(wordStreaksData)}
            onWordTap={handleWordTap}
            onStreakTap={handleStreakTap}
          />
        ))}
      </div>

      {!onL10nWordTap && wordDetailPopover.PopoverComponent}

      {wordStreaksData && streakSelection && (
        <AnchoredPopover
          anchor={streakSelection.anchor}
          open={streakPopoverOpen}
          onOpenChange={updateStreakPopoverOpen}
          ariaLabel={OAT("Word Streaks")}
          className="lingop-word-chips-array__streak-popover"
          placement="bottom"
          showArrow
          arrowClassName="lingop-word-chips-array__streak-popover-arrow"
          arrowFill="#fff"
          arrowStroke="rgba(15, 23, 42, 0.16)"
          arrowStrokeWidth={1}
          transitionDuration={{ open: 120, close: 90 }}
        >
          <div className="lingop-word-chips-array__streak-popover-panel">
            <div className="lingop-word-chips-array__streak-actions">
              <button
                type="button"
                className="lingop-word-chips-array__streak-action lingop-word-chips-array__streak-action--mastered"
                aria-label={`${OAT("Learnt")}: ${streakSelection.word}`}
                onClick={() => void setSelectedWordMastered()}
              >
                <MasteryIcon filled />
                <span>{WORD_STREAKS_MASTERY_THRESHOLD}</span>
              </button>
              <button
                type="button"
                className="lingop-word-chips-array__streak-action lingop-word-chips-array__streak-action--reset"
                aria-label={`${OAT("Reset")}: ${streakSelection.word}`}
                onClick={() => void resetSelectedWordStreak()}
              >
                <MasteryIcon />
                <span>0</span>
              </button>

              <details className="lingop-word-chips-array__streak-info">
                <summary aria-label={OAT("About Word Streaks")}>
                  <InfoIcon />
                </summary>
                <div className="lingop-word-chips-array__streak-info-content">
                  <p>
                    <MasteryIcon /> = {OAT("Word Streaks")}
                  </p>
                  <p>
                    {OAT("Word Streaks represent how well you know a word.")}
                  </p>
                  <p>
                    {OAT(
                      "The more you see a word, or answer questions with a word, the more that word’s word streak will increase.",
                    )}
                  </p>
                  <p>
                    {OAT(
                      "If you request a lot of hints for a word, or answer questions with the word incorrectly, its word streak decreases.",
                    )}
                  </p>
                  <p>
                    {OAT(
                      "Use the buttons to set Word Streaks to a specific value.",
                    )}
                  </p>
                </div>
              </details>
            </div>
          </div>
        </AnchoredPopover>
      )}
    </>
  );
}

const WordChip = memo(function WordChip({
  word,
  wordStreakCount,
  showWordStreaks,
  onWordTap,
  onStreakTap,
}: {
  word: string;
  wordStreakCount: number;
  showWordStreaks: boolean;
  onWordTap: L10nWordTapHandler;
  onStreakTap: (word: string, event: MouseEvent<HTMLElement>) => void;
}) {
  // Wrapped in memo so an array-level state change does not rerender every
  // chip whose own display word and streak count are unchanged.
  let learningState: "NONE" | "LEARNING" | "MASTERED" = "NONE";
  if (wordStreakCount > 0) learningState = "LEARNING";
  if (wordStreakCount >= WORD_STREAKS_MASTERY_THRESHOLD) {
    learningState = "MASTERED";
  }
  const wordStreakPrint = String(Math.min(99, wordStreakCount)).padStart(2, "0");

  return (
    <span className="lingop-word-chip">
      <button
        type="button"
        className="lingop-word-chip__word"
        onClick={(event) => onWordTap(word, event)}
      >
        {word}
      </button>

      {/* The mastery indicator began as a temporary way to prove that vocab
      streak updates were connected. It remains a compact direct control, but
      its controller is now shared by the array rather than mounted per chip. */}
      {showWordStreaks && (
        <button
          type="button"
          className={joinClassNames(
            "lingop-word-chip__streak",
            `lingop-word-chip__streak--${learningState.toLowerCase()}`,
          )}
          aria-label={`${word}: ${wordStreakCount}`}
          onClick={(event) => onStreakTap(word, event)}
        >
          <MasteryIcon filled={learningState === "MASTERED"} />
          <span>{wordStreakPrint}</span>
        </button>
      )}
    </span>
  );
});

function MasteryIcon({ filled = false }: { filled?: boolean }): ReactNode {
  return (
    <svg
      className="lingop-word-chip__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {filled && (
        <path
          className="lingop-word-chip__mastery-fill"
          d="M2 9 12 4l10 5-10 5L2 9Z"
        />
      )}
      <path d="M2 9 12 4l10 5-10 5L2 9Z" />
      <path d="M6 11v5c2.8 2.4 9.2 2.4 12 0v-5" />
      <path d="M22 9v6" />
    </svg>
  );
}

function InfoIcon(): ReactNode {
  return (
    <svg
      className="lingop-word-chip__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}
