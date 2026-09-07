"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getLang, getLangName } from "../../core/language/index.js";
import {
  removeBracketedContent,
  replaceAllCurlyTexts,
} from "../../core/misc.js";
import { useOAT } from "../../oat/react/index.js";
import {
  filterLanguagePickerFocusLangOptions,
  getLanguagePickerLocalizedScripts,
  sortLanguagePickerFocusLangOptions,
} from "./language-picker-gui-and-focus-utils.js";

export type LanguagePickerGuiAndFocusLabelsMode =
  | "DEFAULT"
  | "INITIAL_CL_TRANSLATE";

export type LanguagePickerGuiAndFocusProps = {
  guiLang: string;
  focusLang: string | null;
  guiLangOptions: readonly string[];
  focusLangOptions: readonly string[];
  onGuiLangChange: (guiLang: string) => void;
  onFocusLangChange: (focusLang: string) => void;
  labelsMode?: LanguagePickerGuiAndFocusLabelsMode; // Temporary approach to labelsMode, retained while its two consumers still need distinct wording/iconography.
  shouldFocusLangNotEqualGuiLang?: boolean; // Discourages, but does not guarantee, non-equals (e.g. a user could manually navigate to /ja/ja).
  shouldHaveConfirmationStep?: boolean;
  renderAsLinks?: boolean;
  /** Consumer-owned route construction, including any path suffix that should survive a language change. */
  getFocusLangHref?: (input: {
    guiLang: string;
    focusLang: string;
  }) => string;
  onDone?: () => void;
  showGuiLang?: boolean;
  showLangEmojis?: boolean;
  onSameFocusLangLinkTap?: () => void;
  showHeader?: boolean;
  className?: string;
};

// Languages are rearranged alphabetically by their localized GUI-language
// names in sortLanguagePickerFocusLangOptions.

const langEmojis: Record<string, string> = {
  en: "🍔",
  ja: "🍣",
  yue: "🥟",
  es: "🍷",
  uz: "🍵",
  gl: "🍤",
  kk: "🐴",
  fil: "🥭",
  fr: "🥐",
  "cmn-hant": "🧋",
  mt: "🐇",
  ms: "🍢",
  eu: "🐑",
  ta: "🌶️",
  id: "🐠",
  gu: "💍",
  mr: "🎭",
  mk: "⛰️",
  de: "🍺",
  ha: "🪕",
  lb: "💞",
  hak: "🛡️",
  nan: "💮",
  wuu: "🧧",
  "cmn-hans": "🏮",
  si: "🌿",
  el: "🏛️",
  ko: "🥋",
  th: "🐘",
}; // Brute + experimental.

// OmniAccess also carried an experimental mutual-intelligibility order and
// color list. Lingop keeps the current neutral cards until that future
// language-family color treatment has defined behavior.

function getPrettyLangName(
  focusLang: string | null,
  guiLang: string,
): string | undefined {
  if (!focusLang) return undefined;
  const langName =
    getLangName(focusLang, guiLang) ?? `(${focusLang.toUpperCase()})`;
  return removeBracketedContent(langName);
}

function PickerIcon({
  name,
}: {
  name: "language" | "globe" | "luggage" | "learn" | "down" | "search";
}): ReactNode {
  const paths: Record<typeof name, ReactNode> = {
    // Tabler Icons: language SVG. Embedded from Tabler's MIT-licensed source
    // so the picker does not force consumers to install an icon runtime.
    language: (
      <>
        <path d="M4 5h7" />
        <path d="M9 3v2c0 4.418-2.239 8-5 8" />
        <path d="M5 9c0 2.144 2.952 3.908 6.7 4" />
        <path d="m12 20 4-9 4 9" />
        <path d="M19.1 18h-6.2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </>
    ),
    luggage: (
      <>
        <rect x="5" y="7" width="14" height="13" rx="2" />
        <path d="M9 7V5h6v2M9 11v5m6-5v5" />
      </>
    ),
    learn: (
      <>
        <path d="m3 9 9-5 9 5-9 5-9-5Z" />
        <path d="M7 12v4c2.5 2 7.5 2 10 0v-4m4-3v6" />
      </>
    ),
    down: <path d="m7 10 5 5 5-5" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </>
    ),
  };

  return (
    <svg
      className="lingop-language-picker__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * Shared GUI/focus-language picker.
 *
 * Language values, allowed options, navigation, and surrounding dialog remain
 * consumer-owned. Lingop owns localized labels, language metadata, sorting,
 * search, selection presentation, and responsive layout.
 */
export function LanguagePicker_GuiAndFocus({
  guiLang,
  focusLang,
  guiLangOptions,
  focusLangOptions,
  onGuiLangChange,
  onFocusLangChange,
  labelsMode = "DEFAULT",
  shouldFocusLangNotEqualGuiLang = false,
  shouldHaveConfirmationStep = true,
  renderAsLinks = false,
  getFocusLangHref,
  onDone,
  showGuiLang = true,
  showLangEmojis = false,
  onSameFocusLangLinkTap,
  showHeader = true,
  className,
}: LanguagePickerGuiAndFocusProps): ReactNode {
  const { OAT } = useOAT();
  const guiLangSelectId = useId();

  return (
    <div
      className={["lingop-language-picker", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* CONTENT */}
      <div className="lingop-language-picker__content">
        <div className="lingop-language-picker__inner">
          {/* A max-width of 30rem was previously considered here. Width remains
              consumer-controlled because this picker can fill a page or dialog. */}
          {showHeader && (
            <div className="lingop-language-picker__header-icon" aria-hidden="true">
              <PickerIcon name="language" />
            </div>
          )}

          {/* Known Language (GUI LANG) */}
          {showGuiLang && (
            <>
              <div className="lingop-language-picker__known-language">
                <label
                  className="lingop-language-picker__section-label"
                  htmlFor={guiLangSelectId}
                >
                  <PickerIcon name="globe" />
                  <span>{OAT("Language I already know")}</span>
                  {/*
                  The earlier alternative label used:
                  replaceAllCurlyTexts(OAT("I already know {LANGUAGE}"), "…")
                  and removed a trailing ellipsis. Retained here for reconsideration
                  if the picker later returns to a sentence-style GUI-language label.
                  */}
                </label>
                <span className="lingop-language-picker__select-wrap">
                  <select
                    id={guiLangSelectId}
                    value={guiLang}
                    onChange={(event) => {
                      const nextGuiLang = event.target.value;
                      if (
                        shouldFocusLangNotEqualGuiLang &&
                        nextGuiLang === focusLang
                      ) {
                        onFocusLangChange(guiLang);
                      }
                      onGuiLangChange(nextGuiLang);
                    }}
                  >
                    {guiLangOptions.map((guiLangOption) => (
                      <option value={guiLangOption} key={guiLangOption}>
                        {getLang(guiLangOption)?.name_natural ??
                          `(${guiLangOption})`}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="lingop-language-picker__divider" aria-hidden="true">
                <span />
                <PickerIcon name="down" />
                <span />
              </div>
            </>
          )}

          {/* Language to Learn (FOCUS LANG) */}
          <div className="lingop-language-picker__focus-language">
            <div className="lingop-language-picker__section-label">
              {labelsMode === "INITIAL_CL_TRANSLATE" && (
                <PickerIcon name="luggage" />
              )}
              {labelsMode === "DEFAULT" && <PickerIcon name="learn" />}
              {!focusLang && <span>{OAT("Language I want to learn")}</span>}
              {focusLang && (
                <span>
                  {replaceAllCurlyTexts(
                    OAT("I want to learn {LANGUAGE}"),
                    getPrettyLangName(focusLang, guiLang) ?? "…",
                  )}
                </span>
              )}
            </div>
            <LanguagePickerFocus
              guiLang={guiLang}
              focusLang={focusLang}
              focusLangOptions={focusLangOptions}
              onFocusLangChange={onFocusLangChange}
              shouldFocusLangNotEqualGuiLang={shouldFocusLangNotEqualGuiLang}
              renderAsLinks={renderAsLinks}
              {...(getFocusLangHref ? { getFocusLangHref } : {})}
              showLangEmojis={showLangEmojis}
              {...(onSameFocusLangLinkTap
                ? { bypassSameLinkTapWithFunc: onSameFocusLangLinkTap }
                : {})}
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      {shouldHaveConfirmationStep && (
        <div className="lingop-language-picker__footer">
          <div>
            <button type="button" onClick={onDone}>
              {OAT("Done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type LanguagePickerFocusProps = {
  guiLang: string;
  focusLang: string | null;
  focusLangOptions: readonly string[];
  onFocusLangChange: (focusLang: string) => void;
  shouldFocusLangNotEqualGuiLang?: boolean;
  renderAsLinks: boolean;
  getFocusLangHref?: LanguagePickerGuiAndFocusProps["getFocusLangHref"];
  showLangEmojis?: boolean;
  bypassSameLinkTapWithFunc?: () => void;
};

function LanguagePickerFocus({
  guiLang,
  focusLang,
  focusLangOptions,
  onFocusLangChange,
  shouldFocusLangNotEqualGuiLang = false,
  renderAsLinks,
  getFocusLangHref,
  showLangEmojis = false,
  bypassSameLinkTapWithFunc,
}: LanguagePickerFocusProps): ReactNode {
  const { OAT } = useOAT();
  const [searchValue, setSearchValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  const localizedScriptOfFocusLangs = useMemo(
    () => getLanguagePickerLocalizedScripts(focusLangOptions, guiLang),
    [focusLangOptions, guiLang],
  );

  // Initialize the focus-language option list (sorted + hiding guiLang if needed).
  const sortedFocusLangOptions = useMemo(
    () =>
      sortLanguagePickerFocusLangOptions(
        focusLangOptions,
        guiLang,
        shouldFocusLangNotEqualGuiLang,
      ),
    [focusLangOptions, guiLang, shouldFocusLangNotEqualGuiLang],
  );

  // Search results.
  const filteredLangOptions = useMemo(
    () =>
      filterLanguagePickerFocusLangOptions({
        focusLangOptions: sortedFocusLangOptions,
        guiLang,
        localizedScripts: localizedScriptOfFocusLangs,
        searchValue,
      }),
    [
      sortedFocusLangOptions,
      searchValue,
      guiLang,
      localizedScriptOfFocusLangs,
    ],
  );

  // Listen for resizes to determine the number of columns. Element-size
  // observation is intentional: the picker often lives in a narrow dialog,
  // so viewport media queries alone cannot describe its available space.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    // Handle resize.
    const handleResize: ResizeObserverCallback = (entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // These retain the historical Chakra breakpoint values.
        if (width < 480) setColumns(1); // sm
        else if (width < 768) setColumns(2); // md
        else if (width < 992) setColumns(3); // lg
        else if (width < 1280) setColumns(3); // xl
        else setColumns(4);
      }
    };

    // Add observer.
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(element);
    // On mount: check initial width.
    handleResize(
      [
        {
          contentRect: element.getBoundingClientRect(),
        } as ResizeObserverEntry,
      ],
      resizeObserver,
    );
    // Release observer.
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="lingop-language-picker__focus-picker" ref={containerRef}>
      {/* SEARCH INPUT */}
      <label className="lingop-language-picker__search">
        <span aria-hidden="true"><PickerIcon name="search" /></span>
        <input
          name="search-language"
          aria-label={OAT("Search")}
          placeholder={OAT("Search")}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span aria-hidden="true" />
      </label>

      {/* FOCUS LANG OPTIONS */}
      <div
        className="lingop-language-picker__options"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {filteredLangOptions.map((focusLangOption) => {
          const isSelected = focusLangOption === focusLang;

          const content = (
            <>
              {/* SYMBOL */}
              <span className="lingop-language-picker__symbol">
                <span>
                  {showLangEmojis
                    ? (langEmojis[focusLangOption] ??
                      focusLangOption.toUpperCase())
                    : (getLang(focusLangOption)?.display_code ??
                      focusLangOption.toUpperCase())}
                </span>
              </span>
              {/* LANGUAGE LABELS */}
              <span className="lingop-language-picker__language-labels">
                <strong>
                  {removeBracketedContent(
                    getLangName(focusLangOption, guiLang) ?? "",
                  ) || focusLangOption}
                </strong>
                {localizedScriptOfFocusLangs[focusLangOption] && (
                  <small>{localizedScriptOfFocusLangs[focusLangOption]}</small>
                )}
                <small>
                  {removeBracketedContent(
                    getLang(focusLangOption)?.name_natural ?? "",
                  )}
                </small>
              </span>
              {/* The earlier view reserved an absolute-positioned selected
                  check-circle here. Selection is currently conveyed by the
                  card's color and aria-current/aria-pressed state. */}
            </>
          );
          const handleSelection = () => {
            if (isSelected) bypassSameLinkTapWithFunc?.();
            onFocusLangChange(focusLangOption);
          };
          const shouldBypassLink =
            !!bypassSameLinkTapWithFunc && isSelected;
          const href =
            renderAsLinks && !shouldBypassLink
              ? getFocusLangHref?.({ guiLang, focusLang: focusLangOption })
              : undefined;

          if (href) {
            // The consumer-owned href factory is responsible for retaining any
            // excess path suffix, e.g. ABOUT in /some_project/en/ja/ABOUT.
            return (
              <a
                key={focusLangOption}
                className="lingop-language-picker__option"
                data-selected={isSelected || undefined}
                aria-current={isSelected ? "page" : undefined}
                href={href}
                onClick={handleSelection}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={focusLangOption}
              type="button"
              className="lingop-language-picker__option"
              data-selected={isSelected || undefined}
              aria-pressed={isSelected}
              onClick={handleSelection}
            >
              {/* The earlier list-style experiment conditionally removed a
                  bottom border. Cards now keep a complete border in every layout. */}
              {content}
            </button>
          );
        })}
        {filteredLangOptions.length === 0 && (
          <p className="lingop-language-picker__no-results">
            {OAT("No results found.")} &quot;{searchValue}&quot;
          </p>
        )}
      </div>
    </div>
  );
}

export default LanguagePicker_GuiAndFocus;
