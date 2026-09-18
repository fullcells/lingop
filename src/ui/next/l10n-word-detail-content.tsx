"use client";

import React, { useEffect, useMemo, useState } from "react";

import type {
  ATokenSubMorphemes,
  PhoneticToken,
} from "../../core/annotation/types.js";
import type {
  HancharComponent,
  HancharDecomposition,
} from "../../core/hanchar-decomposition.js";
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
  DEFAULT_YUE_WORD_DETAIL_TAB,
  formatHancharReadings,
  formatL10nWordAsAnnotatedText,
  getHancharReadings,
  getJapaneseWordReadingForCharacter,
  getUniqueHanCharacters,
  isExactJapaneseOnReadingMatch,
  readYueWordDetailTab,
  splitReadingByNativeSpellings,
  supportsHancharComponents,
  type FormattedL10nWordDetail,
  type YueWordDetailTab,
  writeYueWordDetailTab,
} from "./l10n-word-detail-utils.js";
import { useOptionalUserWordStreaksData } from "./user-word-streaks.js";

export type L10nWordDetailResolutionStatus =
  | "IDLE"
  | "LOADING"
  | "RESOLVED"
  | "FAILED";

export type HancharDecompositionResolutionStatus =
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
  /** Shows and enables the shared word-streak and "Learnt" controls. */
  showWordStreakControls?: boolean;
};

type UseL10nWordDetailInput = Pick<
  L10nWordDetailContentProps,
  "l10nWordDetailData" | "guiLang" | "focusLang" | "showWordStreakControls"
>;

// This hook has no idea it is ever displayed inside a popover: it turns
// localized-word input into renderable detail data.
export function useL10nWordDetail({
  l10nWordDetailData,
  guiLang,
  focusLang,
  showWordStreakControls = true,
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
  const hanCharacters = useMemo(
    () => getUniqueHanCharacters(l10nWordToken?.text ?? ""),
    [l10nWordToken?.text],
  );
  const hancharDecompositionKey = `${l10nWordAnnotatedText?.lang ?? ""}:${hanCharacters.join("")}`;
  const [hancharDecompositions, setHancharDecompositions] = useState<
    HancharDecomposition[]
  >([]);
  const [resolvedHancharDecompositionKey, setResolvedHancharDecompositionKey] =
    useState("");
  const [hancharDecompositionStatus, setHancharDecompositionStatus] =
    useState<HancharDecompositionResolutionStatus>("IDLE");
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
    showWordStreakControls &&
    l10nWordAnnotatedText && l10nWordToken && wordStreaksData
      ? (wordStreaksData.userWordStreaks[l10nWordAnnotatedText.lang]?.[
          l10nWordToken.text.toUpperCase()
        ] ?? null)
      : null;
  const wordStreaksForLang = l10nWordAnnotatedText
    ? wordStreaksData?.userWordStreaks[l10nWordAnnotatedText.lang]
    : undefined;
  const [sbWordGloss, setSBWordGloss] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolvedHancharDecompositionKey(hancharDecompositionKey);
    setHancharDecompositions([]);

    if (
      !supportsHancharComponents(l10nWordAnnotatedText?.lang) ||
      hanCharacters.length === 0
    ) {
      setHancharDecompositionStatus("IDLE");
      return;
    }

    setHancharDecompositionStatus("LOADING");
    void Promise.all(
      hanCharacters.map((character) =>
        lingopClient.getHancharDecomposition(character)
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setHancharDecompositions(
          results.filter(
            (result): result is HancharDecomposition =>
              result !== null,
          ),
        );
        setHancharDecompositionStatus("RESOLVED");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("Could not load Han-character components.", error);
        setHancharDecompositions([]);
        setHancharDecompositionStatus("FAILED");
      });

    return () => {
      cancelled = true;
    };
  }, [
    hanCharacters,
    hancharDecompositionKey,
    lingopClient,
    l10nWordAnnotatedText?.lang,
  ]);

  useEffect(() => {
    if (
      !showWordStreakControls ||
      !l10nWordAnnotatedText?.lang ||
      !wordStreaksData ||
      wordStreaksForLang !== undefined
    ) {
      return;
    }
    // Word-detail bodies remount each time their popover opens. Only initialize
    // a missing language: re-ensuring an existing one can replay an older
    // server snapshot over optimistic "Learnt" changes made by the prior body.
    void wordStreaksData.ensureUserWordStreaksForLang(l10nWordAnnotatedText.lang);
  }, [
    l10nWordAnnotatedText?.lang,
    showWordStreakControls,
    wordStreaksData?.ensureUserWordStreaksForLang,
    wordStreaksForLang,
  ]);

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
    hanCharacters,
    hancharDecompositions:
      resolvedHancharDecompositionKey === hancharDecompositionKey
        ? hancharDecompositions
        : [],
    hancharDecompositionStatus:
      resolvedHancharDecompositionKey === hancharDecompositionKey
        ? hancharDecompositionStatus
        : "IDLE",
    setUserWordStreaksToValue: showWordStreakControls
      ? wordStreaksData?.setUserWordStreaksToValue
      : undefined,
  };
}

/** Reusable details body; consumers retain their own popover/dialog shell. */
export function L10nWordDetailContent({
  l10nWordDetailData,
  guiLang,
  focusLang,
  onClose,
  className,
  showWordStreakControls = true,
}: L10nWordDetailContentProps) {
  const { OAT } = useOAT();
  const [isMarkingLearnt, setIsMarkingLearnt] = useState(false);
  const [yueCharacterTab, setYueCharacterTab] = useState<YueWordDetailTab>(
    DEFAULT_YUE_WORD_DETAIL_TAB,
  );
  const {
    l10nWordAnnotatedText,
    l10nWordToken,
    resolutionStatus,
    wordExplanations,
    wordStreak,
    sbWordGloss,
    wordSubMorphemes,
    hanCharacters,
    hancharDecompositions,
    hancharDecompositionStatus,
    setUserWordStreaksToValue,
  } = useL10nWordDetail({
    l10nWordDetailData,
    guiLang,
    ...(focusLang ? { focusLang } : {}),
    showWordStreakControls,
  });

  useEffect(() => {
    setYueCharacterTab(readYueWordDetailTab());
  }, []);

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
  const wordLang = l10nWordAnnotatedText.lang.trim().toLowerCase();
  const isYue = wordLang === "yue";
  const isTraditionalMandarin = wordLang === "cmn-hant";
  const canLoadHancharComponents =
    supportsHancharComponents(wordLang) && hanCharacters.length > 0;
  const hasHancharComponentPanel =
    canLoadHancharComponents &&
    (hancharDecompositionStatus === "IDLE" ||
      hancharDecompositionStatus === "LOADING" ||
      hancharDecompositions.length > 0);
  const usesTraditionalChineseScript =
    getLang(l10nWordAnnotatedText.lang)?.g_script === "Traditional Chinese";

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

      {/* CHARACTER COMPONENTS */}
      {!(isYue || isTraditionalMandarin) && hasHancharComponentPanel && (
        <section className="lingop-word-detail__character-components">
          <h3 className="lingop-word-detail__character-section-title">
            {OAT("Characters' Components")}
          </h3>
          <HancharComponentsBody
            decompositions={hancharDecompositions}
            loading={hancharDecompositionStatus === "LOADING"}
            wordLang={wordLang}
            wordPhoneticToken={l10nWordToken?.phoneticToken}
          />
        </section>
      )}

      {/* Cantonese and Traditional Mandarin combine components with simple script. */}
      {(isYue || isTraditionalMandarin) && hasHancharComponentPanel ? (
        <section className="lingop-word-detail__character-tabs">
          <div
            className="lingop-word-detail__segment"
            role="tablist"
            aria-label={OAT("Character details")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={yueCharacterTab === "COMPONENTS"}
              data-selected={
                yueCharacterTab === "COMPONENTS" ? true : undefined
              }
              onClick={() => {
                setYueCharacterTab("COMPONENTS");
                writeYueWordDetailTab("COMPONENTS");
              }}
            >
              {OAT("Components")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={yueCharacterTab === "SIMPLE_SCRIPT"}
              data-selected={
                yueCharacterTab === "SIMPLE_SCRIPT" ? true : undefined
              }
              onClick={() => {
                setYueCharacterTab("SIMPLE_SCRIPT");
                writeYueWordDetailTab("SIMPLE_SCRIPT");
              }}
            >
              {OAT("Simple Script")}
            </button>
          </div>
          <div className="lingop-word-detail__character-tab-panel" role="tabpanel">
            {yueCharacterTab === "COMPONENTS" ? (
              <HancharComponentsBody
                decompositions={hancharDecompositions}
                loading={hancharDecompositionStatus === "LOADING"}
                wordLang={wordLang}
                wordPhoneticToken={l10nWordToken?.phoneticToken}
              />
            ) : (
              <SimplifiedChineseText text={l10nWordToken?.text ?? ""} />
            )}
          </div>
        </section>
      ) : usesTraditionalChineseScript ? (
        /* ALT MAIN SCRIPT DISPLAY */
        <section className="lingop-word-detail__alternate-script">
          <span>{OAT("Simplified Chinese Script")}:</span>
          <SimplifiedChineseText text={l10nWordToken?.text ?? ""} />
        </section>
      ) : null}

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

function HancharComponentsBody({
  decompositions,
  loading,
  wordLang,
  wordPhoneticToken,
}: {
  decompositions: HancharDecomposition[];
  loading: boolean;
  wordLang: string;
  wordPhoneticToken: PhoneticToken | null | undefined;
}) {
  const { OAT } = useOAT();
  if (loading && decompositions.length === 0) {
    return (
      <span
        className="lingop-word-detail__spinner"
        aria-label="Loading character components"
      />
    );
  }
  const hasDecomposedCharacters = decompositions.some(
    (decomposition) => decomposition.components.length > 0,
  );

  return (
    <div className="lingop-word-detail__character-list">
      {decompositions.map((decomposition) => {
        const isCoreComponent = decomposition.components.length === 0;
        return (
          <div
            className="lingop-word-detail__character-row"
            data-core-component={isCoreComponent || undefined}
            key={decomposition.literal}
          >
            <span className="lingop-word-detail__character">
              {decomposition.literal}
            </span>
            {isCoreComponent ? (
              <span className="lingop-word-detail__core-component">
                {OAT("Core Component")}
              </span>
            ) : (
              <>
                <span className="lingop-word-detail__decomposition-arrow" aria-hidden>
                  →
                </span>
                <HancharComponentList
                  components={decomposition.components}
                  decomposition={decomposition.decomposition}
                  wordLang={wordLang}
                  nativeReadings={decomposition.readings}
                  wordReading={getJapaneseWordReadingForCharacter(
                    wordPhoneticToken,
                    decomposition.literal,
                  )}
                />
              </>
            )}
          </div>
        );
      })}
      {hasDecomposedCharacters && (
        <div className="lingop-word-detail__component-key">
          {(["semantic", "phonetic", "structural"] as const).map((role) => (
            <span key={role}>
              <i data-role={role} aria-hidden />
              {role === "semantic"
                ? OAT("Semantic")
                : role === "phonetic"
                ? OAT("Phonetic")
                : OAT("Structural")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HancharComponentList({
  components,
  decomposition,
  wordLang,
  nativeReadings,
  wordReading,
  path = "root",
}: {
  components: HancharComponent[];
  decomposition?: string | null;
  wordLang: string;
  nativeReadings: HancharDecomposition["readings"];
  wordReading: string | null;
  path?: string;
}) {
  const layout = getHancharComponentLayout(decomposition);
  return (
    <ul
      className="lingop-word-detail__component-list"
      data-layout={layout.direction}
      data-operator={layout.operator ?? undefined}
    >
      {components.map((component, index) => (
        <HancharComponentItem
          component={component}
          wordLang={wordLang}
          nativeReadings={nativeReadings}
          wordReading={wordReading}
          path={`${path}-${component.literal}-${component.ordinal}-${index}`}
          key={`${component.literal}-${component.ordinal}-${index}`}
        />
      ))}
    </ul>
  );
}

function getHancharComponentLayout(
  decomposition: string | null | undefined,
): {
  direction: "horizontal" | "vertical" | "overlay";
  operator: string | null;
} {
  const operator = Array.from(decomposition ?? "")[0] ?? null;
  if (operator === "⿱" || operator === "⿳") {
    return { direction: "vertical", operator };
  }
  if (operator === "⿰" || operator === "⿲") {
    return { direction: "horizontal", operator };
  }
  if (operator && "⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿".includes(operator)) {
    return { direction: "overlay", operator };
  }
  return { direction: "horizontal", operator: null };
}

function HancharComponentItem({
  component,
  wordLang,
  nativeReadings,
  wordReading,
  path,
}: {
  component: HancharComponent;
  wordLang: string;
  nativeReadings: HancharDecomposition["readings"];
  wordReading: string | null;
  path: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const readingValues = getHancharReadings(component.readings, wordLang);
  const reading = formatHancharReadings(component.readings, wordLang);
  const isJapanese = wordLang.trim().toLowerCase() === "ja";
  const hasComponents = component.components.length > 0;
  const content = (
    <>
      <span className="lingop-word-detail__component-literal">
        {component.literal}
      </span>
      <span className="lingop-word-detail__component-details">
        {reading && (
          <span className="lingop-word-detail__component-reading">
            {component.role === "phonetic"
              ? isJapanese
                ? readingValues.map((value, readingIndex) => (
                    <React.Fragment key={`${value}-${readingIndex}`}>
                      {readingIndex > 0 && "・"}
                      <span
                        className={
                          isExactJapaneseOnReadingMatch(
                            value,
                            component.readings,
                            wordReading,
                          )
                            ? "lingop-word-detail__component-reading-shared"
                            : undefined
                        }
                      >
                        {value}
                      </span>
                    </React.Fragment>
                  ))
                : splitReadingByNativeSpellings(
                    reading,
                    getHancharReadings(nativeReadings, wordLang),
                    2,
                  ).map((part, partIndex) => (
                    <span
                      className={
                        part.sharedWithNativeSpelling
                          ? "lingop-word-detail__component-reading-shared"
                          : undefined
                      }
                      key={`${part.text}-${partIndex}`}
                    >
                      {part.text}
                    </span>
                  ))
              : reading}
          </span>
        )}
        {component.enGloss && (
          <span className="lingop-word-detail__component-gloss">
            {component.enGloss}
          </span>
        )}
      </span>
      {hasComponents && (
        <span
          className="lingop-word-detail__component-expander"
          aria-hidden
        >
          <svg viewBox="0 0 16 16" focusable="false">
            <path d={expanded ? "M3 5.5 8 10.5l5-5" : "m5.5 3 5 5-5 5"} />
          </svg>
        </span>
      )}
    </>
  );

  return (
    <li>
      {hasComponents ? (
        <button
          type="button"
          className="lingop-word-detail__component lingop-word-detail__component-button"
          data-role={component.role}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {content}
        </button>
      ) : (
        <span
          className="lingop-word-detail__component"
          data-role={component.role}
        >
          {content}
        </span>
      )}
      {hasComponents && expanded && (
        <HancharComponentList
          components={component.components}
          decomposition={component.decomposition}
          wordLang={wordLang}
          nativeReadings={nativeReadings}
          wordReading={wordReading}
          path={path}
        />
      )}
    </li>
  );
}

// Small helper component: handles the async conversion and its failure state.
function SimplifiedChineseText({ text }: { text: string }) {
  const { OAT } = useOAT();
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

  const displayedText = conversionFailed ? text : (simplified ?? "…");
  const isSame = simplified !== null && simplified === text;
  return (
    <span
      className="lingop-word-detail__alternate-script-text"
      data-same={isSame ? true : undefined}
    >
      {displayedText}
      {isSame && (
        <span className="lingop-word-detail__alternate-script-same">
          {" "}{OAT("(same)")}
        </span>
      )}
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
