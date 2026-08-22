"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  type SupabaseWordListsClient,
  type WordListMeta,
} from "../../core/index.js";
import { usePrebaked } from "../../prebake/react/index.js";
import { useLingopClientDataOrCreate } from "./lingop-client-data-provider.js";
import { useUserWordStreaksData } from "./user-word-streaks.js";

export type WordListsSelectorMode =
  | "EXPLORE"
  | "SELECT_SINGLE"
  | "SELECT_MULTIPLE";

export type WordListTitlePriority = "GUI_LANG" | "FOCUS_LANG";

export type WordListsSelectorProps = {
  /** @deprecated Configure this once on LingopClientDataProvider instead. */
  supabaseClient?: SupabaseWordListsClient;
  guiLang: string;
  focusLang: string;
  rootListPk: string;
  mode: WordListsSelectorMode;
  visualMaxLevels?: number;
  initialSelectedWordListPks?: string[];
  onSelectedWordListPks?: (selectedWordListPks: string[]) => void;
  showWordStreaks?: boolean;
  subCollTitleFontSize?: string;
  subCollTitleIsTappable?: boolean;
  subCollTitlePriorityLang?: WordListTitlePriority;
  subCollDividers?: boolean;
  leafToolbarShown?: boolean;
  renderLeafAsLink?: boolean;
  /** Current page path, used only when `renderLeafAsLink` is enabled. */
  leafBasePath?: string;
  onWordListDetailsSelect?: (listPk: string) => void;
  className?: string;
};

export type WordListTreeNode = {
  meta: WordListMeta;
  children?: WordListTreeNode[];
};

export type WordListVisualLeafNodeProps = {
  /** @deprecated Configure this once on LingopClientDataProvider instead. */
  supabaseClient?: SupabaseWordListsClient;
  guiLang: string;
  focusLang: string;
  node: WordListTreeNode;
  isSelected: boolean;
  onListSelect: (title: string) => void;
  onListDetailsSelect?: (title: string) => void;
  showWordStreaks?: boolean;
  showToolbar?: boolean;
  priorityDisplayLang: WordListTitlePriority;
  renderLeafAsLink?: boolean;
  leafBasePath?: string;
};

type SeenAndTotalWordsStat = { seen: number; total: number };

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function segmentWordListTitle(wordListTitle: string): {
  titleLabel: string;
  titleCounter: number | null;
} {
  const segments = wordListTitle.split("#");
  const titleLabel = (segments[0] ?? "").replaceAll("_", " ").trim();
  const titleCounter = segments[1] ? Number(segments[1]) : null;
  return { titleLabel, titleCounter };
  // H: Future: This may get elaborated on further (e.g. with parenthesis
  // removal, splitting further by ":", etc.).
}

function buildWordListMetaTree(
  wordListsMeta: WordListMeta[],
  listTitle: string,
  focusLang: string,
  visited = new Set<string>(),
): WordListTreeNode | null {
  const meta = wordListsMeta.find((list) => list.title === listTitle);
  if (!meta) {
    console.warn(`List ${listTitle} not found in wordListsMeta.`);
    return null;
  }
  if (visited.has(listTitle)) {
    console.error(`> Infinite loop detected at: ${listTitle}`);
    return null;
  }

  // Pass a copy so the same list can legitimately occur in sibling branches.
  const branchVisited = new Set(visited).add(listTitle);
  const children = meta.sublists
    ?.map((subListTitle) =>
      buildWordListMetaTree(wordListsMeta, subListTitle, focusLang, branchVisited),
    )
    .filter((child): child is WordListTreeNode => {
      if (!child) return false;
      return child.meta.type !== "LANG_SPECIFIC" || child.meta.lang === focusLang;
    });

  return { meta, ...(children?.length ? { children } : {}) };
}

function getListPksInWordListsMetaTree(
  root: WordListTreeNode,
  visited = new Set<string>(),
): string[] {
  if (visited.has(root.meta.title)) return [];
  visited.add(root.meta.title);
  return [
    root.meta.title,
    ...(root.children?.flatMap((child) =>
      getListPksInWordListsMetaTree(child, visited),
    ) ?? []),
  ];
}

function wordListHref(basePath: string, title: string): string {
  const path = basePath.replace(/\/$/, "");
  const slug = title.replaceAll("#", "~").replaceAll(" ", "-").toLowerCase();
  return `${path}/${slug}`;
}

/**
 * Camp Lingo's shared word-list tree selector.
 *
 * Lingop owns the data/tree behavior and framework-free visual treatment. The
 * shared client comes from LingopClientDataProvider; the consumer supplies the
 * current languages. Translation and word-streak data come from Lingop's
 * existing providers.
 */
export function WordListsSelector({
  supabaseClient,
  guiLang,
  focusLang,
  rootListPk,
  mode,
  visualMaxLevels = 3, // Use a high value (such as 99) to show the full tree.
  initialSelectedWordListPks = [],
  onSelectedWordListPks,
  showWordStreaks = false,
  subCollTitleFontSize = "0.875rem",
  subCollTitleIsTappable = true,
  subCollTitlePriorityLang = "FOCUS_LANG",
  subCollDividers = false,
  leafToolbarShown = true,
  renderLeafAsLink = false,
  leafBasePath = "",
  onWordListDetailsSelect,
  className,
}: WordListsSelectorProps) {
  // This was originally a three-level renderer, e.g.
  // _public."First Words"."Color":[Color#1…5] (levels 0, 1 and 2).
  const { PrebakedT9n } = usePrebaked();
  const lingopClient = useLingopClientDataOrCreate(
    supabaseClient ? { supabaseClient } : {},
  );
  const [wordListsMeta, setWordListsMeta] = useState<WordListMeta[] | null>(null);
  const [selectedWordListPks, setSelectedWordListPks] = useState<string[]>(
    initialSelectedWordListPks,
  );

  useEffect(() => {
    let active = true;
    setWordListsMeta(null);
    void lingopClient.loadWordListMetaData().then((metadata) => {
      if (active) setWordListsMeta(metadata);
    });
    return () => {
      active = false;
    };
  }, [lingopClient]);

  const wordListTree = useMemo(
    () =>
      wordListsMeta
        ? buildWordListMetaTree(wordListsMeta, rootListPk, focusLang)
        : null,
    [focusLang, rootListPk, wordListsMeta],
  );

  function onListSelect(listPk: string) {
    if (mode === "EXPLORE") {
      onSelectedWordListPks?.([listPk]);
      return;
    }

    const next = selectedWordListPks.includes(listPk)
      ? selectedWordListPks.filter((item) => item !== listPk)
      : mode === "SELECT_SINGLE"
        ? [listPk]
        : [...selectedWordListPks, listPk];
    setSelectedWordListPks(next);
    onSelectedWordListPks?.(next);
  }

  function renderTreeNode(node: WordListTreeNode, level = 0): React.ReactNode {
    const title = node.meta.title;
    const { titleLabel, titleCounter } = segmentWordListTitle(title);
    const isSelected = selectedWordListPks.includes(title);
    const isLeaf = !node.children?.length;
    const atMaxLevel = level >= visualMaxLevels - 1;

    // A visual leaf can be a real leaf or a collection at the requested depth.
    if (isLeaf || atMaxLevel) {
      return (
        <WordListVisualLeafNode
          key={title}
          {...(supabaseClient ? { supabaseClient } : {})}
          guiLang={guiLang}
          focusLang={focusLang}
          node={node}
          isSelected={isSelected}
          onListSelect={onListSelect}
          {...(onWordListDetailsSelect ? { onListDetailsSelect: onWordListDetailsSelect } : {})}
          showWordStreaks={showWordStreaks}
          showToolbar={leafToolbarShown}
          priorityDisplayLang={subCollTitlePriorityLang}
          renderLeafAsLink={renderLeafAsLink}
          leafBasePath={leafBasePath}
        />
      );
    }

    const nextLevel = level + 1;
    const nodeChildren = node.children ?? [];
    const childrenAreLeaves = nodeChildren.every(
      (child) => !child.children?.length || nextLevel >= visualMaxLevels - 1,
    );

    return (
      <section
        key={title}
        className={joinClassNames(
          "lingop-word-lists-selector__branch",
          level !== 1 && "lingop-word-lists-selector__branch--outlined",
          isSelected && "lingop-word-lists-selector__branch--selected",
        )}
      >
        {subCollTitleIsTappable ? (
          <button
            type="button"
            className="lingop-word-lists-selector__branch-title"
            style={{ fontSize: subCollTitleFontSize }}
            onClick={() => onListSelect(title)}
          >
            <BilingualTitle
              titleLabel={titleLabel}
              titleCounter={titleCounter}
              sourceLang={node.meta.lang}
              primaryLang={
                subCollTitlePriorityLang === "FOCUS_LANG" ? focusLang : guiLang
              }
              secondaryLang={
                subCollTitlePriorityLang === "FOCUS_LANG" ? guiLang : focusLang
              }
              translate={PrebakedT9n}
            />
          </button>
        ) : (
          <div
            className="lingop-word-lists-selector__branch-title"
            style={{ fontSize: subCollTitleFontSize }}
          >
            <BilingualTitle
              titleLabel={titleLabel}
              titleCounter={titleCounter}
              sourceLang={node.meta.lang}
              primaryLang={
                subCollTitlePriorityLang === "FOCUS_LANG" ? focusLang : guiLang
              }
              secondaryLang={
                subCollTitlePriorityLang === "FOCUS_LANG" ? guiLang : focusLang
              }
              translate={PrebakedT9n}
            />
          </div>
        )}

        <div
          className={
            childrenAreLeaves
              ? "lingop-word-lists-selector__leaf-grid"
              : "lingop-word-lists-selector__branches"
          }
        >
          {nodeChildren.map((child) => renderTreeNode(child, nextLevel))}
          {childrenAreLeaves && (
            <span className="lingop-word-lists-selector__scroll-spacer" />
          )}
        </div>
      </section>
    );
  }

  return (
    <div className={joinClassNames("lingop-word-lists-selector", className)}>
      {!wordListsMeta && <LoadingSpinner />}
      {wordListsMeta && wordListTree && (
        <div className="lingop-word-lists-selector__root">
          {/* Render from level 1 rather than the level 0 parent (e.g. _public). */}
          {(wordListTree.children ?? []).map((child, index, children) => (
            <React.Fragment key={child.meta.title}>
              {renderTreeNode(child, 1)}
              {subCollDividers && index < children.length - 1 && <hr />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/** A visually terminal word-list card, even when its data node has descendants. */
export function WordListVisualLeafNode({
  supabaseClient,
  guiLang,
  focusLang,
  node,
  isSelected,
  onListSelect,
  onListDetailsSelect,
  showWordStreaks = false,
  showToolbar = true,
  priorityDisplayLang,
  renderLeafAsLink = false,
  leafBasePath = "",
}: WordListVisualLeafNodeProps) {
  const { PrebakedT9n } = usePrebaked();
  const { userWordStreaks } = useUserWordStreaksData();
  const lingopClient = useLingopClientDataOrCreate(
    supabaseClient ? { supabaseClient } : {},
  );
  const title = node.meta.title;
  const { titleLabel, titleCounter } = segmentWordListTitle(title);
  const [loadingEmoji, setLoadingEmoji] = useState(false);
  const [titleEmoji, setTitleEmoji] = useState("");
  const [seenAndTotalWords, setSeenAndTotalWords] =
    useState<SeenAndTotalWordsStat | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingEmoji(true);
    void lingopClient
      .generateEmoji(PrebakedT9n(titleLabel, node.meta.lang, "en"))
      .then((emoji) => {
        if (!active) return;
        setTitleEmoji(`${emoji ?? ""}${titleCounter ?? ""}`);
      })
      .finally(() => {
        if (active) setLoadingEmoji(false);
      });
    return () => {
      active = false;
    };
  }, [PrebakedT9n, lingopClient, node.meta.lang, titleCounter, titleLabel]);

  useEffect(() => {
    let active = true;
    if (!showWordStreaks || !userWordStreaks[focusLang]) {
      setSeenAndTotalWords(null);
      return () => {
        active = false;
      };
    }

    void (async () => {
      // Gather this list and its descendants, then count unique localized words.
      const listPks = new Set(getListPksInWordListsMetaTree(node));
      const cacheRows = await lingopClient.loadSBCacheWordListsForLang(focusLang);
      const localizedWords = new Set(
        cacheRows
          .filter((row) => listPks.has(row.list_title))
          .flatMap((row) => row.l10n_words)
          .map((word) => word.toUpperCase()),
      );
      const seenWords = new Set(
        Object.keys(userWordStreaks[focusLang] ?? {}).map((word) =>
          word.toUpperCase(),
        ),
      );
      const seen = [...localizedWords].filter((word) => seenWords.has(word)).length;
      if (active) setSeenAndTotalWords({ seen, total: localizedWords.size });
    })();

    return () => {
      active = false;
    };
  }, [focusLang, lingopClient, node, showWordStreaks, userWordStreaks]);

  const primaryLang =
    priorityDisplayLang === "FOCUS_LANG" ? focusLang : guiLang;
  const secondaryLang =
    priorityDisplayLang === "FOCUS_LANG" ? guiLang : focusLang;
  const mainContents = (
    <>
      {loadingEmoji ? (
        <LoadingSpinner small />
      ) : (
        <span className="lingop-word-list-leaf__emoji emoji-color-font">
          {titleEmoji || "\u00a0"}
        </span>
      )}
      <span className="lingop-word-list-leaf__primary-title">
        {PrebakedT9n(titleLabel, node.meta.lang, primaryLang)}
        {titleCounter !== null && <small>{titleCounter}</small>}
      </span>
      <span className="lingop-word-list-leaf__secondary-title">
        {PrebakedT9n(titleLabel, node.meta.lang, secondaryLang)}
        {titleCounter !== null && <small>{titleCounter}</small>}
      </span>
    </>
  );

  return (
    <article
      className={joinClassNames(
        "lingop-word-list-leaf",
        isSelected && "lingop-word-list-leaf--selected",
      )}
    >
      {renderLeafAsLink ? (
        <a
          className="lingop-word-list-leaf__main"
          href={wordListHref(leafBasePath, title)}
        >
          {mainContents}
        </a>
      ) : (
        <button
          type="button"
          className="lingop-word-list-leaf__main"
          onClick={() => onListSelect(title)}
        >
          {mainContents}
        </button>
      )}

      {showToolbar && (
        <footer className="lingop-word-list-leaf__toolbar">
          <button
            type="button"
            aria-label={`Select ${title}`}
            onClick={() => onListSelect(title)}
          >
            <PlayIcon />
          </button>
          <button
            type="button"
            className="lingop-word-list-leaf__progress-button"
            aria-label={seenAndTotalWords?.seen ? `View progress for ${title}` : undefined}
            disabled={!seenAndTotalWords?.seen}
            onClick={() => onListDetailsSelect?.(title)}
          >
            {!!seenAndTotalWords?.seen && (
              <span className="lingop-word-list-leaf__progress-track">
                <span
                  className={joinClassNames(
                    "lingop-word-list-leaf__progress-value",
                    seenAndTotalWords.seen >= seenAndTotalWords.total &&
                      "lingop-word-list-leaf__progress-value--complete",
                  )}
                  style={{
                    width: `${(seenAndTotalWords.seen / seenAndTotalWords.total) * 100}%`,
                  }}
                />
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label={`View details for ${title}`}
            onClick={() => onListDetailsSelect?.(title)}
          >
            <ListIcon />
          </button>
        </footer>
      )}
    </article>
  );
}

function BilingualTitle({
  titleLabel,
  titleCounter,
  sourceLang,
  primaryLang,
  secondaryLang,
  translate,
}: {
  titleLabel: string;
  titleCounter: number | null;
  sourceLang: string;
  primaryLang: string;
  secondaryLang: string;
  translate: (sourceText: string, sourceLang: string, targetLang: string) => string;
}) {
  return (
    <>
      <strong>{translate(titleLabel, sourceLang, primaryLang)}</strong>
      <span>/</span>
      <span>{translate(titleLabel, sourceLang, secondaryLang)}</span>
      {titleCounter !== null && <small>#{titleCounter}</small>}
    </>
  );
}

function LoadingSpinner({ small = false }: { small?: boolean }) {
  return (
    <span
      className={joinClassNames(
        "lingop-word-lists-selector__spinner",
        small && "lingop-word-lists-selector__spinner--small",
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
