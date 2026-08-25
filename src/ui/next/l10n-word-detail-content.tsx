"use client";

import React, { useEffect, useMemo, useState } from "react";

import type { ATokenSubMorphemes } from "../../core/annotation/types.js";
import {
  getLang,
  getWordExplanationsForWord,
  traditionalToSimplifiedChinese,
} from "../../core/language/index.js";
import { WORD_STREAKS_MASTERY_THRESHOLD } from "../../core/word-lists.js";
import { ilike } from "../../utils/string.js";
import { useOAT } from "../../oat/react/index.js";
import { AnnotatedTextView } from "./annotated-text.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import type { L10nWordDetailData } from "./l10n-word-detail-types.js";
import {
  formatL10nWordAsAnnotatedText,
  type FormattedL10nWordDetail,
} from "./l10n-word-detail-utils.js";
import { useOptionalUserWordStreaksData } from "./user-word-streaks.js";

export type L10nWordDetailResolutionStatus =
  | "IDLE"
  | "LOADING"
  | "RESOLVED"
  | "FAILED";

export type L10nWordDetailContentProps = {
  l10nWordDetailData: L10nWordDetailData | null;
  guiLang: string;
  /** Used when a direct raw-word caller does not include l10nLang. */
  focusLang?: string;
  onClose?: () => void;
  className?: string;
};

type UseL10nWordDetailInput = Pick<
  L10nWordDetailContentProps,
  "l10nWordDetailData" | "guiLang" | "focusLang"
>;

// This hook has no idea it is ever displayed inside a popover: it turns
// localized-word input into renderable detail data.
export function useL10nWordDetail({
  l10nWordDetailData,
  guiLang,
  focusLang,
}: UseL10nWordDetailInput) {
  const { lingopClient } = useLingopClientData();
  const wordStreaksData = useOptionalUserWordStreaksData();
  const l10nLang = l10nWordDetailData?.l10nLang ?? focusLang;
  const [resolvedWordDetail, setResolvedWordDetail] =
    useState<FormattedL10nWordDetail | null>(null);
  const [resolutionStatus, setResolutionStatus] =
    useState<L10nWordDetailResolutionStatus>("IDLE");

  const providedWordDetail = useMemo(() => {
    if (!l10nWordDetailData?.l10nAText) return null;
    return formatL10nWordAsAnnotatedText(
      l10nWordDetailData.l10nAText,
      l10nWordDetailData.l10nATextTokenIdx,
    );
  }, [l10nWordDetailData?.l10nAText, l10nWordDetailData?.l10nATextTokenIdx]);

  useEffect(() => {
    let cancelled = false;
    setResolvedWordDetail(null);

    if (providedWordDetail) {
      setResolutionStatus("RESOLVED");
      return;
    }
    if (!l10nWordDetailData?.l10nWord || !l10nLang) {
      // A raw-word request cannot be resolved without both values. Treat that
      // as a handled failure instead of leaving the raw word in an idle state.
      setResolutionStatus(l10nWordDetailData ? "FAILED" : "IDLE");
      return;
    }

    setResolutionStatus("LOADING");
    (async () => {
      // Word details are a shared public WORDS resource. This policy is part of
      // the component rather than something every consumer must reproduce.
      const localization = await lingopClient.fetchLocalization({
        l10n_lang: l10nLang,
        isPublic: true,
        sourceContent: {
          lang: l10nLang,
          text: l10nWordDetailData.l10nWord,
          ref: { file: "WORDS" },
          owner_id: null,
        },
      });
      if (!localization) throw new Error("Word localization was not resolved.");
      const annotation = await lingopClient.fetchAnnotation({ localization });
      if (!annotation) throw new Error("Word annotation was not resolved.");
      const formatted = formatL10nWordAsAnnotatedText(annotation);
      if (!formatted) throw new Error("Word annotation contained no token.");

      if (!cancelled) {
        setResolvedWordDetail(formatted);
        setResolutionStatus("RESOLVED");
      }
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.warn("Could not resolve localized word details.", error);
      setResolutionStatus("FAILED");
    });

    return () => {
      cancelled = true;
    };
  }, [
    lingopClient,
    l10nLang,
    l10nWordDetailData?.l10nWord,
    providedWordDetail,
  ]);

  const l10nWordAnnotatedText =
    providedWordDetail?.annotatedText ?? resolvedWordDetail?.annotatedText ?? null;
  const l10nWordToken = l10nWordAnnotatedText?.tokens[0];
  // Prefer the original per-grapheme/root-and-pattern detail where available,
  // and repair direct raw-word calls with the selected token as one morpheme.
  const wordSubMorphemes: ATokenSubMorphemes | undefined =
    l10nWordDetailData?.wordSubMorphemes?.length
      ? l10nWordDetailData.wordSubMorphemes
      : (providedWordDetail?.wordSubMorphemes ??
        resolvedWordDetail?.wordSubMorphemes);
  const wordExplanations =
    l10nWordAnnotatedText && l10nWordToken
      ? getWordExplanationsForWord(
          l10nWordAnnotatedText.lang,
          l10nWordToken.text,
        )
      : [];
  const wordStreak =
    l10nWordAnnotatedText && l10nWordToken && wordStreaksData
      ? (wordStreaksData.userWordStreaks[l10nWordAnnotatedText.lang]?.[
          l10nWordToken.text.toUpperCase()
        ] ?? null)
      : null;
  const [sbWordGloss, setSBWordGloss] = useState<string | null>(null);

  useEffect(() => {
    if (!l10nWordAnnotatedText?.lang || !wordStreaksData) return;
    void wordStreaksData.ensureUserWordStreaksForLang(l10nWordAnnotatedText.lang);
  }, [l10nWordAnnotatedText?.lang, wordStreaksData?.ensureUserWordStreaksForLang]);

  useEffect(() => {
    let cancelled = false;
    setSBWordGloss(null);

    // Stored glosses are English. ATV translates them through glossTextTipLang
    // for other GUI languages, so this secondary English lookup is only useful
    // in the explicit English detail list.
    if (
      !ilike(guiLang, "en") ||
      !l10nWordAnnotatedText?.lang ||
      !l10nWordToken?.text
    ) {
      return;
    }

    void lingopClient
      .getSBWordsForLangDir(l10nWordAnnotatedText.lang, "en")
      .then((sbWords) => {
        const sbWord =
          sbWords.find(({ word }) => word === l10nWordToken.text) ??
          sbWords.find(({ word }) => ilike(word, l10nWordToken.text));
        if (!cancelled) setSBWordGloss(sbWord?.gloss ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn("Could not load the secondary word gloss.", error);
          setSBWordGloss(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [guiLang, lingopClient, l10nWordAnnotatedText?.lang, l10nWordToken?.text]);

  return {
    l10nWordAnnotatedText,
    l10nWordToken,
    resolutionStatus,
    wordExplanations,
    wordStreak,
    sbWordGloss,
    wordSubMorphemes,
    setUserWordStreaksToValue: wordStreaksData?.setUserWordStreaksToValue,
  };
}

/** Reusable details body; consumers retain their own popover/dialog shell. */
export function L10nWordDetailContent({
  l10nWordDetailData,
  guiLang,
  focusLang,
  onClose,
  className,
}: L10nWordDetailContentProps) {
  const { OAT } = useOAT();
  const [isMarkingLearnt, setIsMarkingLearnt] = useState(false);
  const {
    l10nWordAnnotatedText,
    l10nWordToken,
    resolutionStatus,
    wordExplanations,
    wordStreak,
    sbWordGloss,
    wordSubMorphemes,
    setUserWordStreaksToValue,
  } = useL10nWordDetail({
    l10nWordDetailData,
    guiLang,
    ...(focusLang ? { focusLang } : {}),
  });

  if (!l10nWordDetailData) return null;

  if (!l10nWordAnnotatedText) {
    return (
      <div className={["lingop-word-detail", className].filter(Boolean).join(" ")}>
        <div className="lingop-word-detail__word">
          {l10nWordDetailData.l10nWord}
        </div>
        {resolutionStatus === "LOADING" && (
          <span className="lingop-word-detail__spinner" aria-label="Loading" />
        )}
        {resolutionStatus === "FAILED" && (
          <div className="lingop-word-detail__error" role="alert">
            {OAT("Could not load word details.")}
          </div>
        )}
      </div>
    );
  }

  const isEnglishGui = ilike(guiLang, "en");
  const canSetWordStreak = Boolean(setUserWordStreaksToValue);

  return (
    <div className={["lingop-word-detail", className].filter(Boolean).join(" ")}>
      {/* WORD DETAILS */}
      <div className="lingop-word-detail__annotated-text">
        <AnnotatedTextView
          annotatedText={l10nWordAnnotatedText}
          astyle={{ mainTextSize: 32 }}
          showGlossEmoji="NEVER"
          showGlossText={isEnglishGui ? "NEVER" : "ALWAYS"}
          showSpelling="ALWAYS"
          showMainText
          showActionPlayAudio
          contentContext_forAPISpeech="PUBLIC_CONTENT"
          contentRef_forAPISpeech={{ file: "WORDS" }}
          {...(!isEnglishGui ? { glossTextTipLang: guiLang } : {})}
        />
        {isEnglishGui && (
          <ul className="lingop-word-detail__glosses">
            <li>{l10nWordToken?.gloss ?? ""}</li>
            {sbWordGloss && !ilike(sbWordGloss, l10nWordToken?.gloss ?? "") && (
              <li>{sbWordGloss}</li>
            )}
            {wordExplanations.map((explanation, index) => (
              <li key={`${explanation}-${index}`}>{explanation}</li>
            ))}
          </ul>
        )}
      </div>

      {/* WORD'S SUB-MORPHEMES - e.g. root-and-pattern languages such as Maltese/Arabic. */}
      {wordSubMorphemes && wordSubMorphemes.length > 1 && (
        <div className="lingop-word-detail__morphemes">
          {wordSubMorphemes.map((morpheme, index) => (
            <div key={`${morpheme.morpheme}-${index}`}>
              <div className="lingop-word-detail__word">{morpheme.morpheme}</div>
              <ul className="lingop-word-detail__glosses">
                <li>{morpheme.gloss}</li>
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ALT MAIN SCRIPT DISPLAY */}
      {getLang(l10nWordAnnotatedText.lang)?.g_script === "Traditional Chinese" && (
        <section className="lingop-word-detail__alternate-script">
          <span>{OAT("Simplified Chinese Script")}:</span>
          <SimplifiedChineseText text={l10nWordToken?.text ?? ""} />
        </section>
      )}

      {/* Without a streak provider, details remain useful and the mutation UI is omitted. */}
      {canSetWordStreak && (
        <div className="lingop-word-detail__actions">
          <span className="lingop-word-detail__streak" aria-label="Word streak">
            <GraduationCapIcon />
            {wordStreak ?? 0}
          </span>
          <button
            className="lingop-word-detail__learnt-button"
            type="button"
            disabled={isMarkingLearnt}
            onClick={() => {
              if (!l10nWordToken || !wordSubMorphemes || !setUserWordStreaksToValue) {
                return;
              }
              setIsMarkingLearnt(true);
              void setUserWordStreaksToValue(
                l10nWordAnnotatedText.lang,
                wordSubMorphemes.map(({ morpheme }) => morpheme),
                WORD_STREAKS_MASTERY_THRESHOLD,
              )
                .then(() => onClose?.())
                .catch((error: unknown) => {
                  console.warn("Could not mark the word as learnt.", error);
                })
                .finally(() => setIsMarkingLearnt(false));
            }}
          >
            <CheckCircleIcon />
            {OAT("Learnt")}
          </button>
        </div>
      )}
    </div>
  );
}

// Small helper component: handles the async conversion and its failure state.
function SimplifiedChineseText({ text }: { text: string }) {
  const [simplified, setSimplified] = useState<string | null>(null);
  const [conversionFailed, setConversionFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Avoid showing the previous word while a new conversion is loading.
    setSimplified(null);
    setConversionFailed(false);
    void traditionalToSimplifiedChinese(text)
      .then((result) => {
        if (!cancelled) setSimplified(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn("Could not convert Traditional Chinese text.", error);
          setConversionFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <span className="lingop-word-detail__alternate-script-text">
      {conversionFailed ? text : (simplified ?? "…")}
    </span>
  );
}

function GraduationCapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 10 9-5 9 5-9 5-9-5Zm4 2.5V17c2.8 2 7.2 2 10 0v-4.5M21 10v6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3" />
    </svg>
  );
}
