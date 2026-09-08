"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  buildWordListMetaTree,
  segmentWordListTitle,
  WORD_STREAKS_MASTERY_THRESHOLD,
  type SBCacheWordListL10nWordsRow,
  type WordListMeta,
  type WordListTreeNode,
} from "../../core/index.js";
import { useOAT } from "../../oat/react/index.js";
import { usePrebaked } from "../../prebake/react/index.js";
import { AnchoredPopover } from "./anchored-popover.js";
import { useL10nWordDetailPopover } from "./l10n-word-detail-popover.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import { useOptionalUserWordStreaksData } from "./user-word-streaks.js";
import {
  WordChipsArrayView,
  type L10nWordTapHandler,
} from "./word-chips-array-view.js";
import { getUniqueLocalizedWordsForList } from "./word-list-view-utils.js";
import type { WordListTitlePriority } from "./word-lists-selector.js";

export type WordListLeafRenderContext = {
  node: WordListTreeNode;
  listPk: string;
  words: readonly string[];
  guiLang: string;
  focusLang: string;
};

export type WordListViewProps = {
  rootListPk: string;
  guiLang: string;
  focusLang: string;
  showWordStreaks?: boolean;
  showLevel0?: boolean;
  priorityDisplayLang?: WordListTitlePriority;
  /**
   * Overrides the default WordChipsArrayView for a terminal list. This keeps
   * consumer-specific visual cards, image sources, and annotation data outside
   * Lingop while Lingop continues to own the tree and localized list data.
   */
  renderLeaf?: (context: WordListLeafRenderContext) => ReactNode;
  className?: string;
};

type StreakSelection = {
  listPk: string;
  anchor: HTMLElement;
};

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * A recursive render of a localized word list. It is similar to
 * WordListsSelector, with UI intended for displaying the list contents rather
 * than selecting lists.
 */
export function WordListView({
  rootListPk,
  guiLang,
  focusLang,
  showWordStreaks = false,
  showLevel0 = true,
  priorityDisplayLang = "FOCUS_LANG",
  renderLeaf,
  className,
}: WordListViewProps): ReactNode {
  const { OAT } = useOAT();
  const { lingopClient } = useLingopClientData();
  const wordStreaksData = useOptionalUserWordStreaksData();
  const wordDetailPopover = useL10nWordDetailPopover({
    guiLang,
    focusLang,
  });
  const [cacheWordListL10nRows, setCacheWordListL10nRows] =
    useState<SBCacheWordListL10nWordsRow[] | null>(null); // Specific to focusLang.
  const [wordListsMeta, setWordListsMeta] = useState<WordListMeta[] | null>(
    null,
  );
  const [streakSelection, setStreakSelection] =
    useState<StreakSelection | null>(null);
  const [streakPopoverOpen, setStreakPopoverOpen] = useState(false);
  const streakSelectionRef = useRef<StreakSelection | null>(null);
  const streakPopoverOpenRef = useRef(false);

  // Initial loads:
  // - Localized word-list words for the focus language.
  useEffect(() => {
    let active = true;
    setCacheWordListL10nRows(null);
    void lingopClient
      .loadSBCacheWordListsForLang(focusLang)
      .then((rows) => {
        // The shared client owns and caches this array, so do not sort or
        // otherwise mutate it in a visual consumer.
        if (active) setCacheWordListL10nRows(rows);
      })
      .catch((error: unknown) => {
        console.warn("Could not load localized word-list words.", error);
        if (active) setCacheWordListL10nRows([]);
      });
    return () => {
      active = false;
    };
  }, [focusLang, lingopClient]);

  // - Word-list metadata shared by every language.
  useEffect(() => {
    let active = true;
    setWordListsMeta(null);
    void lingopClient
      .loadWordListMetaData()
      .then((metadata) => {
        if (active) setWordListsMeta(metadata);
      })
      .catch((error: unknown) => {
        console.warn("Could not load word-list metadata.", error);
        if (active) setWordListsMeta([]);
      });
    return () => {
      active = false;
    };
  }, [lingopClient]);

  // The tree is filtered for focus-language availability by the core helper.
  const wordListTree = useMemo(
    () =>
      wordListsMeta
        ? buildWordListMetaTree(wordListsMeta, rootListPk, focusLang)
        : null,
    [focusLang, rootListPk, wordListsMeta],
  );

  const handleWordTap = useCallback<L10nWordTapHandler>(
    (l10nWord, event) => {
      wordDetailPopover.openL10nWordDetail(
        { l10nWord, l10nLang: focusLang },
        event,
      );
    },
    [focusLang, wordDetailPopover.openL10nWordDetail],
  );

  const updateStreakPopoverOpen = useCallback((nextOpen: boolean) => {
    streakPopoverOpenRef.current = nextOpen;
    setStreakPopoverOpen(nextOpen);
  }, []);

  const handleListStreakTap = useCallback(
    (listPk: string, event: MouseEvent<HTMLElement>) => {
      const tappedAnchor = event.currentTarget;
      if (
        streakPopoverOpenRef.current &&
        streakSelectionRef.current?.anchor === tappedAnchor
      ) {
        updateStreakPopoverOpen(false);
        return;
      }
      const nextSelection = { listPk, anchor: tappedAnchor };
      streakSelectionRef.current = nextSelection;
      setStreakSelection(nextSelection);
      updateStreakPopoverOpen(true);
    },
    [updateStreakPopoverOpen],
  );

  async function setSelectedListMastered() {
    if (!streakSelection || !wordStreaksData) return;
    const words = await lingopClient.getDescendantL10nsOfWordLists(
      [streakSelection.listPk],
      focusLang,
    );
    await wordStreaksData.setUserWordStreaksToValue(
      focusLang,
      words,
      WORD_STREAKS_MASTERY_THRESHOLD,
    );
  }

  async function resetSelectedListStreaks() {
    if (!streakSelection || !wordStreaksData) return;
    const words = await lingopClient.getDescendantL10nsOfWordLists(
      [streakSelection.listPk],
      focusLang,
    );
    await wordStreaksData.deleteUserWordStreaks(focusLang, words);
  }

  const loading = wordListsMeta === null || cacheWordListL10nRows === null;
  const streakControlsShown = showWordStreaks && Boolean(wordStreaksData);

  return (
    <>
      <div
        className={joinClassNames("lingop-word-list-view", className)}
        lang={focusLang}
      >
        {loading && <LoadingSpinner />}
        {/* FUTURE: Add a sticky mobile menu for navigating the sublist tree. */}
        {!loading && wordListTree && cacheWordListL10nRows && (
          <TreeNodeView
            node={wordListTree}
            level={0}
            cacheWordListL10nRows={cacheWordListL10nRows}
            guiLang={guiLang}
            focusLang={focusLang}
            showWordStreaks={streakControlsShown}
            showLevel0={showLevel0}
            priorityDisplayLang={priorityDisplayLang}
            onL10nWordTap={handleWordTap}
            onListStreakTap={handleListStreakTap}
            {...(renderLeaf ? { renderLeaf } : {})}
          />
        )}
        {!loading && !wordListTree && (
          <div className="lingop-word-list-view__empty">0 {OAT("Words")}</div>
        )}
      </div>

      {wordDetailPopover.PopoverComponent}

      {wordStreaksData && streakSelection && (
        <AnchoredPopover
          anchor={streakSelection.anchor}
          open={streakPopoverOpen}
          onOpenChange={updateStreakPopoverOpen}
          ariaLabel={OAT("Word Streaks")}
          className="lingop-word-list-view__streak-popover"
          placement="bottom"
          showArrow
          arrowClassName="lingop-word-list-view__streak-popover-arrow"
          arrowFill="#fff"
          arrowStroke="rgba(15, 23, 42, 0.16)"
          arrowStrokeWidth={1}
          transitionDuration={{ open: 120, close: 90 }}
        >
          <div className="lingop-word-list-view__streak-popover-panel">
            <div className="lingop-word-list-view__streak-actions">
              <button
                type="button"
                className="lingop-word-list-view__streak-action lingop-word-list-view__streak-action--mastered"
                aria-label={`${OAT("Learnt")}: ${streakSelection.listPk}`}
                onClick={() => void setSelectedListMastered()}
              >
                <MasteryIcon filled />
                <span>{WORD_STREAKS_MASTERY_THRESHOLD}</span>
              </button>
              <button
                type="button"
                className="lingop-word-list-view__streak-action lingop-word-list-view__streak-action--reset"
                aria-label={`${OAT("Reset")}: ${streakSelection.listPk}`}
                onClick={() => void resetSelectedListStreaks()}
              >
                <MasteryIcon />
                <span>0</span>
              </button>

              <details className="lingop-word-list-view__streak-info">
                <summary aria-label={OAT("About Word Streaks")}>
                  <InfoIcon />
                </summary>
                <div className="lingop-word-list-view__streak-info-content">
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

function TreeNodeView({
  node,
  level,
  cacheWordListL10nRows,
  guiLang,
  focusLang,
  showWordStreaks,
  showLevel0,
  priorityDisplayLang,
  onL10nWordTap,
  onListStreakTap,
  renderLeaf,
}: {
  node: WordListTreeNode;
  level: number;
  cacheWordListL10nRows: readonly SBCacheWordListL10nWordsRow[];
  guiLang: string;
  focusLang: string;
  showWordStreaks: boolean;
  showLevel0: boolean;
  priorityDisplayLang: WordListTitlePriority;
  onL10nWordTap: L10nWordTapHandler;
  onListStreakTap: (
    listPk: string,
    event: MouseEvent<HTMLElement>,
  ) => void;
  renderLeaf?: (context: WordListLeafRenderContext) => ReactNode;
}): ReactNode {
  const { OAT } = useOAT();
  const { PrebakedT9n } = usePrebaked();
  const title = node.meta.title;
  const { titleLabel, titleCounter } = segmentWordListTitle(title);
  const isLeaf = !node.children?.length;
  const localizedWords = isLeaf
    ? getUniqueLocalizedWordsForList(cacheWordListL10nRows, title)
    : [];
  const primaryLang =
    priorityDisplayLang === "FOCUS_LANG" ? focusLang : guiLang;
  const secondaryLang =
    priorityDisplayLang === "FOCUS_LANG" ? guiLang : focusLang;

  return (
    <section
      className={joinClassNames(
        "lingop-word-list-view__node",
        level === 0 && "lingop-word-list-view__node--root",
        level !== 0 &&
          showLevel0 &&
          level === 1 &&
          "lingop-word-list-view__node--outlined",
      )}
    >
      <header
        className={joinClassNames(
          "lingop-word-list-view__title",
          level === 0 && !showLevel0 && "lingop-word-list-view__title--hidden",
        )}
      >
        <span className="lingop-word-list-view__bilingual-title">
          {/* Title, bilingually, in the requested priority order. */}
          <span>{PrebakedT9n(titleLabel, node.meta.lang, primaryLang)}</span>
          <span>/</span>
          <span>{PrebakedT9n(titleLabel, node.meta.lang, secondaryLang)}</span>
          {/* Counter encoded in titles such as Color#2. */}
          {titleCounter !== null && <small>#{titleCounter}</small>}
        </span>

        {/* Word-streak mastery control for this list and its descendants. The
        old implementation mounted one controller for every tree node; one
        array-level anchored popover now serves every title. */}
        {showWordStreaks && (
          <button
            type="button"
            className="lingop-word-list-view__title-streak"
            aria-label={`${OAT("Word Streaks")}: ${title}`}
            onClick={(event) => onListStreakTap(title, event)}
          >
            <MasteryIcon />
          </button>
        )}
      </header>

      {!isLeaf && (
        <div className="lingop-word-list-view__children">
          {node.children?.map((child) => (
            <TreeNodeView
              key={child.meta.title}
              node={child}
              level={level + 1}
              cacheWordListL10nRows={cacheWordListL10nRows}
              guiLang={guiLang}
              focusLang={focusLang}
              showWordStreaks={showWordStreaks}
              showLevel0={showLevel0}
              priorityDisplayLang={priorityDisplayLang}
              onL10nWordTap={onL10nWordTap}
              onListStreakTap={onListStreakTap}
              {...(renderLeaf ? { renderLeaf } : {})}
            />
          ))}
        </div>
      )}

      {isLeaf && (
        <div className="lingop-word-list-view__leaf">
          {renderLeaf ? (
            renderLeaf({
              node,
              listPk: title,
              words: localizedWords,
              guiLang,
              focusLang,
            })
          ) : (
            <WordChipsArrayView
              words={localizedWords}
              lang={focusLang}
              guiLang={guiLang}
              showWordStreaks={showWordStreaks}
              onL10nWordTap={onL10nWordTap}
            />
          )}
        </div>
      )}
    </section>
  );
}

function LoadingSpinner(): ReactNode {
  return (
    <span
      className="lingop-word-list-view__spinner"
      role="status"
      aria-label="Loading"
    />
  );
}

function MasteryIcon({ filled = false }: { filled?: boolean }): ReactNode {
  return (
    <svg
      className="lingop-word-list-view__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {filled && (
        <path
          className="lingop-word-list-view__mastery-fill"
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
      className="lingop-word-list-view__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}
