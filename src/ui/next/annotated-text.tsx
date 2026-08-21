"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type ReactNode,
} from "react";

import type {
  AnnotatedText,
  AnnotatedToken,
  PhoneticPart,
} from "../../core/annotation/types.js";
import {
  convertEmojiTextToBlackWhiteCompatibleEmojiText,
  shouldBlackWhiteEmojiUseColorEmojiFont,
} from "../../core/emojify.js";
import {
  createLingoDataClient,
  type LingoDataClient,
  type SupabaseLingoDataClient,
} from "../../core/lingo-data-client.js";
import { ilike } from "../../core/misc.js";
import {
  captureAnnotatedTextImage,
  downloadAnnotatedTextImage,
  type AnnotatedTextImageData,
} from "./annotated-text-image.js";

export type { AnnotatedTextImageData } from "./annotated-text-image.js";

export type AnnotatedTextViewHandle = {
  requestDownloadImage: (index: number) => Promise<void>;
  requestImageData: (
    scale?: number,
  ) => Promise<AnnotatedTextImageData | undefined>;
};

export type GlossPlacement = "bottom" | "left" | "top" | "right";

export type TextTransformType =
  | "capitalize"
  | "uppercase"
  | "lowercase"
  | "none"
  | "full-width"
  | "full-size-kana"
  | "math-auto";

export type FontStyleType = "normal" | "italic" | "oblique" | string;

export type AnnotatedTextStyle = {
  // Note Future: CSSProperties (e.g. mainTextCSS: CSSProperties) could be
  // added and applied directly to the corresponding render component.
  spellingSize?: number;
  mainTextSize?: number;
  glossTextSize?: number;
  glossEmojiSize?: number;

  spellingColor?: string;
  mainTextColor?: string;
  glossTextColor?: string;
  glossEmojiColor?: string;

  wordSpacing?: number;
  spellingOnBottom?: boolean;
  glossPlacement?: GlossPlacement;
  glossTextAboveEmoji?: boolean;
  glossTextTextTransform?: TextTransformType | null;
  mainTextTextTransform?: TextTransformType | null;
  mainTextFontWeight?: string | null;
  spellingTextTransform?: TextTransformType | null;
  glossTextFontStyle?: FontStyleType | null;
  spellingFontStyle?: FontStyleType | null;
  tokenPhonicsColumnGap?: string | null;
  tokenPhonicSpellingLineHeight?: string | null;

  css?: CSSProperties;
};

export const DEFAULT_ANNOTATED_TEXT_STYLE: AnnotatedTextStyle = {
  spellingColor: "#000",
  mainTextColor: "#000",
  glossTextColor: "#000",
  glossEmojiColor: "#000",
  spellingSize: 12,
  mainTextSize: 16,
  glossTextSize: 12,
  glossEmojiSize: 12,
  wordSpacing: 3.0, // 1.0 = Normal WordSpacing (if applied to WordSpaced Langs)
  spellingTextTransform: null,
  mainTextTextTransform: null,
  mainTextFontWeight: null,
  glossTextTextTransform: null,
  glossTextFontStyle: null,
  spellingFontStyle: null,
  tokenPhonicsColumnGap: null,
  tokenPhonicSpellingLineHeight: null,
  spellingOnBottom: false,
  glossPlacement: "bottom",
  glossTextAboveEmoji: false,
};

type ResolvedAnnotatedTextStyle = Required<
  Omit<AnnotatedTextStyle, "css">
> & {
  css?: CSSProperties;
};

function resolveAnnotatedTextStyle(
  astyle: AnnotatedTextStyle,
): ResolvedAnnotatedTextStyle {
  return {
    ...DEFAULT_ANNOTATED_TEXT_STYLE,
    ...astyle,
  } as ResolvedAnnotatedTextStyle;
}

export type AnnotatedTextViewProps = {
  annotatedText: AnnotatedText;
  showSpelling?: "NEVER" | "ALWAYS"; // ON_HINT state is not ported yet.
  showMainText?: boolean;
  showGlossText?: "NEVER" | "ALWAYS"; // ON_HINT state is not ported yet.
  showGlossEmoji?: "NEVER" | "ALWAYS"; // ON_HINT state is not ported yet.
  isEmojiBlackWhite?: boolean;
  /** Language used for the displayed gloss text. */
  glossTextTipLang?: string;
  /** OmniAccess-compatible per-instance annotated-text styling. */
  astyle?: AnnotatedTextStyle;
  /** Whether English verb glosses retain their leading "TO " prefix. */
  showTokenGlossPrefix_TO__?: boolean;
  /** Fades words identified as non-core; Supabase-backed checks require supabaseClient. */
  localShouldFadeNonCoreWords?: boolean | null;
  nonCoreWordsFadeOpacity?: number;
  /** A browser-safe public Supabase client. Never pass a service-role client here. */
  supabaseClient?: SupabaseLingoDataClient;
};

const visuallyEmpty = "\u00a0";

const glossPlacementFlexDirections = {
  bottom: "column",
  top: "column-reverse",
  left: "row-reverse",
  right: "row",
} satisfies Record<GlossPlacement, CSSProperties["flexDirection"]>;

const emptyAnnotationSlotStyle: CSSProperties = {
  minHeight: "1em",
  lineHeight: 1,
};

function isWordToken(token: AnnotatedToken): boolean {
  return token.isWord === 1;
}

function phoneticPartToSpelling(
  [chars, spelling]: PhoneticPart,
  lang: string,
  showMainText: boolean,
): string {
  let phoneticPartSpelling = spelling ?? chars;

  if (ilike("ja", lang)) {
    // BE default is Hiragana. Hide duplicates when the main text already shows it.
    if (phoneticPartSpelling === chars && chars !== "ー" && showMainText) {
      phoneticPartSpelling = visuallyEmpty;
    }
  }

  return phoneticPartSpelling;
}

function tokenToPhoneticParts(token: AnnotatedToken): PhoneticPart[] {
  return token.phoneticToken?.length ? token.phoneticToken : [[token.text]];
}

// 20260821: AnnotatedTextView is being ported gradually from OmniAccess.
// The current port only includes the basic render-component structure and
// visibility and style inputs. Action Buttons, TTS, ON_HINT state (including
// l10nWordDetailHandler, isWordUnfamiliar, and userWordStreaks),
// useUserLingoPrefsData, and the other OmniAccess behavior are intentionally
// not ported yet.
// 20260821: Gloss emojis currently port basic color/black-and-white rendering
// and NEVER/ALWAYS visibility. ON_HINT, per-grapheme flipping, loading spinners,
// and non-core gloss preferences remain deferred.
// 20260822: The OmniAccess astyle shape, defaults, and current render behavior
// are ported without its Chakra dependency. astyle.css applies to Lingop's
// .annotated-text-view root because the future action-button wrapper is not
// present yet.
// 20260822: Download-image and image-data imperative handles are ported with a
// lazy html2canvas import. HTML-table export and unrelated imperative handles
// remain deferred.
type TokenSpellingAndMainViewProps = {
  _showSpelling: "NEVER" | "ALWAYS";
  _showMainText: boolean;
  annotatedText: AnnotatedText;
  astyle: ResolvedAnnotatedTextStyle;
  token: AnnotatedToken;
};

function TokenSpellingAndMainView({
  _showSpelling,
  _showMainText,
  annotatedText,
  astyle,
  token,
}: TokenSpellingAndMainViewProps): ReactNode {
  if (!_showMainText && _showSpelling === "NEVER") return null;

  if (!isWordToken(token)) {
    return (
      <span
        className="token-spelling-and-main"
        style={{
          display: "inline-flex",
          flexDirection: astyle.spellingOnBottom ? "column-reverse" : "column",
          alignItems: "center",
        }}
      >
        <TokenSpellingTextSpan
          astyle={astyle}
          lang={annotatedText.lang}
          showMainText={_showMainText}
        >
          {_showSpelling === "ALWAYS" && !_showMainText
            ? token.text
            : visuallyEmpty}
        </TokenSpellingTextSpan>
        {_showMainText && (
          <TokenMainTextSpan astyle={astyle} isWord={false}>
            {token.text}
          </TokenMainTextSpan>
        )}
      </span>
    );
  }

  return (
    <span
      className="token-phonics"
      style={{
        display: "inline-flex",
        alignItems: "center",
        ...(astyle.tokenPhonicsColumnGap
          ? { columnGap: astyle.tokenPhonicsColumnGap }
          : {}),
      }}
    >
      {tokenToPhoneticParts(token).map((part, partIndex) => {
        const [chars] = part;
        const partSpelling = _showSpelling === "ALWAYS"
          ? phoneticPartToSpelling(part, annotatedText.lang, _showMainText)
          : visuallyEmpty;

        return (
          <span
            key={`${partIndex}-${chars}`}
            className="phonic"
            style={{
              display: "inline-flex",
              flexDirection: astyle.spellingOnBottom
                ? "column-reverse"
                : "column",
              alignItems: "center",
              minWidth: "max-content",
            }}
          >
            <TokenSpellingTextSpan
              astyle={astyle}
              lang={annotatedText.lang}
              showMainText={_showMainText}
            >
              {partSpelling}
            </TokenSpellingTextSpan>
            {_showMainText && (
              <TokenMainTextSpan astyle={astyle} isWord>
                {chars}
              </TokenMainTextSpan>
            )}
          </span>
        );
      })}
    </span>
  );
}

function TokenSpellingTextSpan({
  astyle,
  children,
  lang,
  showMainText,
}: {
  astyle: ResolvedAnnotatedTextStyle;
  children: ReactNode;
  lang: string;
  showMainText: boolean;
}): ReactNode {
  const spellingSize = showMainText ? astyle.spellingSize : astyle.mainTextSize;
  const localSpellingSize = ilike(lang, "yue")
    ? spellingSize + 2 // "LS Jyutping" tweak to be more visually equal in size.
    : spellingSize;

  return (
    <span
      className="phonic-spelling"
      style={{
        minHeight: "1em",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        userSelect: "none",
        fontSize: `${localSpellingSize}px`,
        color: showMainText ? astyle.spellingColor : "#000",
        ...(astyle.spellingTextTransform
          ? { textTransform: astyle.spellingTextTransform }
          : {}),
        ...(astyle.spellingFontStyle
          ? { fontStyle: astyle.spellingFontStyle }
          : {}),
        ...(astyle.tokenPhonicSpellingLineHeight
          ? { lineHeight: astyle.tokenPhonicSpellingLineHeight }
          : {}),
      }}
    >
      {children}
    </span>
  );
}

function TokenMainTextSpan({
  astyle,
  children,
  isWord,
}: {
  astyle: ResolvedAnnotatedTextStyle;
  children: ReactNode;
  isWord: boolean;
}): ReactNode {
  return (
    <span
      className="main-text"
      style={{
        lineHeight: "1em",
        opacity: isWord ? 1 : 0.8,
        color: astyle.mainTextColor,
        fontSize: `${astyle.mainTextSize}px`,
        ...(astyle.mainTextTextTransform
          ? { textTransform: astyle.mainTextTextTransform }
          : {}),
        ...(astyle.mainTextFontWeight
          ? { fontWeight: astyle.mainTextFontWeight }
          : {}),
      }}
    >
      {children}
    </span>
  );
}

type TokenGlossViewProps = {
  astyle: ResolvedAnnotatedTextStyle;
  isEmojiBlackWhite: boolean;
  glossTextTipLang: string;
  lang: string;
  lingopClient: LingoDataClient;
  token: AnnotatedToken;
  showGlossText: "NEVER" | "ALWAYS";
  showGlossEmoji: "NEVER" | "ALWAYS";
  showTokenGlossPrefix_TO__: boolean;
};

function TokenGlossView({
  astyle,
  isEmojiBlackWhite,
  glossTextTipLang,
  lang,
  lingopClient,
  token,
  showGlossText,
  showGlossEmoji,
  showTokenGlossPrefix_TO__,
}: TokenGlossViewProps): ReactNode {
  const enGloss = useMemo(() => {
    // Format the gloss to strip out the "TO " prefix if specified.
    let gloss = isWordToken(token) ? token.gloss ?? null : null;
    if (
      gloss &&
      !showTokenGlossPrefix_TO__ &&
      gloss.toUpperCase().startsWith("TO ")
    ) {
      gloss = gloss.slice("TO ".length);
    }
    return gloss;
  }, [showTokenGlossPrefix_TO__, token]);
  const [tipLangGlossResult, setTipLangGlossResult] = useState<{
    enGloss: string;
    glossTextTipLang: string;
    tipLangGloss: string;
  } | null>(null);
  const matchingTipLangGloss =
    tipLangGlossResult?.enGloss === enGloss &&
    tipLangGlossResult.glossTextTipLang === glossTextTipLang
      ? tipLangGlossResult.tipLangGloss
      : null;
  const shouldFetchTipLangGloss =
    showGlossText !== "NEVER" &&
    !!enGloss &&
    !!glossTextTipLang &&
    !ilike(glossTextTipLang, "en");
  const loadingTipLangGloss =
    shouldFetchTipLangGloss && matchingTipLangGloss === null;
  const tipLangGloss = ilike(glossTextTipLang, "en")
    ? enGloss
    : matchingTipLangGloss ?? enGloss;
  const [emojiResult, setEmojiResult] = useState<{
    enGloss: string;
    emoji: string | null;
    lang: string;
    token: AnnotatedToken;
  } | null>(null);
  const generatedEmoji =
    emojiResult?.token === token &&
    emojiResult.enGloss === enGloss &&
    emojiResult.lang === lang
      ? emojiResult.emoji
      : null;
  const emoji =
    generatedEmoji && isEmojiBlackWhite
      ? convertEmojiTextToBlackWhiteCompatibleEmojiText(generatedEmoji)
      : generatedEmoji;

  // GlossTextTipLang
  useEffect(() => {
    let cancelled = false;
    setTipLangGlossResult(null);

    if (!shouldFetchTipLangGloss || !enGloss) return;

    void lingopClient
      .fetchAndGenGloss({
        source_lang: "en",
        source_word: enGloss,
        target_lang: glossTextTipLang,
      })
      .then((glossOutput) => {
        if (!cancelled) {
          setTipLangGlossResult({
            enGloss,
            glossTextTipLang,
            // Fail open to the English gloss when no translation is available.
            tipLangGloss: glossOutput?.targetWord ?? enGloss,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Error determining tip-language gloss:", error);
          setTipLangGlossResult({
            enGloss,
            glossTextTipLang,
            tipLangGloss: enGloss,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    enGloss,
    glossTextTipLang,
    lingopClient,
    shouldFetchTipLangGloss,
  ]);

  // Emoji
  useEffect(() => {
    let cancelled = false;
    setEmojiResult(null);

    if (showGlossEmoji === "NEVER" || !enGloss) return;

    void lingopClient
      .generateEmoji(enGloss)
      .then((generatedEmoji) => {
        if (!cancelled) {
          setEmojiResult({
            enGloss,
            emoji: generatedEmoji,
            lang,
            token,
          });
        }
      })
      .catch((error: unknown) => {
        // Fail open: retain the gloss fallback if public emoji data cannot load.
        if (!cancelled) {
          console.error("Error determining gloss emoji:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enGloss, lang, lingopClient, showGlossEmoji, token]);

  const shouldDisplayGloss =
    !!enGloss &&
    (showGlossText === "ALWAYS" || showGlossEmoji === "ALWAYS");

  if (!shouldDisplayGloss) {
    return (
      <span
        className="no-gloss-space"
        style={{
          ...emptyAnnotationSlotStyle,
          boxSizing: "border-box",
          width: "100%",
          userSelect: "none",
          color: astyle.glossTextColor,
          fontSize: `${astyle.glossTextSize}px`,
        }}
      >
        {visuallyEmpty}
      </span>
    );
  }

  // Emoji Font
  let emojiFont = "emoji-color-font";
  if (
    emoji &&
    isEmojiBlackWhite &&
    !shouldBlackWhiteEmojiUseColorEmojiFont(emoji)
  ) {
    emojiFont = "emoji-bw-font";
  }

  return (
    <span
      className="gloss"
      style={{
        display: "inline-flex",
        flexDirection: astyle.glossTextAboveEmoji
          ? "column-reverse"
          : "column",
        alignItems: "center",
        minWidth: "max-content",
      }}
    >
      {/* GLOSS EMOJI */}
      {showGlossEmoji === "ALWAYS" && (
        <span
          className={`gloss-emoji ${emojiFont}`}
          style={{
            minHeight: "1em",
            lineHeight: 1,
            fontSize: `${astyle.glossEmojiSize}px`,
            color: astyle.glossEmojiColor,
            ...(isEmojiBlackWhite ? { filter: "grayscale(100%)" } : {}),
          }}
          // FUTURE CONSIDERATION: CUR: BRUTE Temp Forcing to LTR. FUTURE: For RTL Langs: Emoji Content needs to adopt: (ARROW DIRECTIONS + Reflip Directions of Emojis) - 20260707
          dir="ltr"
        >
          {emoji ?? tipLangGloss ?? visuallyEmpty}
        </span>
      )}

      {/* GLOSS TEXT */}
      {showGlossText === "ALWAYS" && (
        <span
          className="gloss-text-wrapper"
          style={{
            minHeight: "1em",
            lineHeight: 1,
            fontSize: `${astyle.glossTextSize}px`,
            color: astyle.glossTextColor,
            ...(astyle.glossTextTextTransform
              ? { textTransform: astyle.glossTextTextTransform }
              : {}),
            ...(astyle.glossTextFontStyle
              ? { fontStyle: astyle.glossTextFontStyle }
              : {}),
          }}
        >
          <span className="gloss-text">
            {loadingTipLangGloss ? (
              <span className="gloss-text-loading" aria-label="Loading gloss">
                …
              </span>
            ) : (
              tipLangGloss
            )}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Renders annotated text as horizontally wrapping token blocks.
 *
 * Each word token is a small vertical stack. Its phonetic parts render as
 * character groups with spelling directly above, with token gloss below.
 * Punctuation/non-word tokens keep the same vertical slots so the main text
 * baseline stays aligned with word tokens.
 */
function AnnotatedTextViewComponent({
  annotatedText,
  showSpelling = "ALWAYS",
  showMainText = true,
  showGlossText = "ALWAYS",
  showGlossEmoji = "NEVER",
  astyle: astyleInput = DEFAULT_ANNOTATED_TEXT_STYLE,
  isEmojiBlackWhite = false,
  glossTextTipLang = "en",
  showTokenGlossPrefix_TO__ = true,
  localShouldFadeNonCoreWords = false,
  nonCoreWordsFadeOpacity = 0.5,
  supabaseClient,
}: AnnotatedTextViewProps, ref: ForwardedRef<AnnotatedTextViewHandle>): ReactNode {
  const astyle = resolveAnnotatedTextStyle(astyleInput);
  const exportHTMLElementRef = useRef<HTMLSpanElement>(null);
  const lingopClient = useMemo(
    () =>
      createLingoDataClient({
        ...(supabaseClient ? { supabaseClient } : {}),
      }),
    [supabaseClient],
  );
  const [coreWordStatusResult, setCoreWordStatusResult] = useState<{
    annotatedText: AnnotatedText;
    statuses: (boolean | null)[]; // boolean if it's a word, null if it's not
  } | null>(null);
  const tokensCoreWordOrUnknownStatus =
    coreWordStatusResult?.annotatedText === annotatedText
      ? coreWordStatusResult.statuses
      : null;

  // EXPORTS: IMPERATIVE HANDLES (For Exports)
  useImperativeHandle(ref, () => ({
    requestDownloadImage: async (index: number) => {
      const element = exportHTMLElementRef.current;
      if (!element) return;
      const scale = 4;
      const { dataUrl } = await captureAnnotatedTextImage(element, scale);
      downloadAnnotatedTextImage(dataUrl, index, scale);
    },
    requestImageData: async (scale?: number) => {
      const element = exportHTMLElementRef.current;
      if (!element) return undefined;
      return captureAnnotatedTextImage(element, scale);
    },
  }), []);

  // DISPLAY: CORE WORD STATUSES
  useEffect(() => {
    let cancelled = false;
    setCoreWordStatusResult(null);

    if (!localShouldFadeNonCoreWords) return;

    void Promise.all(
      annotatedText.tokens.map(async (token) => {
        if (!isWordToken(token)) return null;
        // Await the async function, then negate its result.
        const isNotCoreWord = await lingopClient.isNotCoreWord(
          annotatedText.lang,
          token.text,
          token.gloss ?? undefined,
        );
        return !isNotCoreWord;
      }),
    )
      .then((coreWordStatuses) => {
        if (!cancelled) {
          setCoreWordStatusResult({
            annotatedText,
            statuses: coreWordStatuses,
          });
        }
      })
      .catch((error: unknown) => {
        // Fail open: unknown words stay fully visible if public data cannot load.
        if (!cancelled) {
          console.error("Error determining core-word statuses:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [annotatedText, lingopClient, localShouldFadeNonCoreWords]);

  return (
    <span
      ref={exportHTMLElementRef}
      className="annotated-text-view"
      lang={annotatedText.lang}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        rowGap: "0.25em",
        lineHeight: 1.2,
        ...astyle.css,
      }}
    >
      <span className="tokens" style={{ display: "contents" }}>
        {annotatedText.tokens.map((token, index) => {
          const key = `${index}-${token.text}`;
          // Non-Core - Fade
          const wordIsCoreOrUnknown =
            tokensCoreWordOrUnknownStatus?.[index] ?? true;
          const opacity =
            localShouldFadeNonCoreWords && !wordIsCoreOrUnknown
              ? nonCoreWordsFadeOpacity
              : 1;
          const tokenInlinePadding = index === annotatedText.tokens.length - 1
            ? "0"
            : `${(
              (astyle.mainTextSize / 5.0) *
              astyle.wordSpacing /
              2.0
            ).toFixed(2)}px`;

          return (
            <span
              key={key}
              className="token"
              aria-hidden={
                !isWordToken(token) && token.text.trim() === ""
                  ? true
                  : undefined
              }
              style={{
                display: "inline-flex",
                flexDirection:
                  glossPlacementFlexDirections[astyle.glossPlacement],
                alignItems: "center",
                justifyContent: "flex-end",
                minWidth: "max-content",
                paddingInline: tokenInlinePadding,
                opacity,
                transition: "opacity 0.1s ease-in-out",
              }}
            >
              <TokenSpellingAndMainView
                _showSpelling={showSpelling}
                _showMainText={showMainText}
                annotatedText={annotatedText}
                astyle={astyle}
                token={token}
              />
              <TokenGlossView
                astyle={astyle}
                isEmojiBlackWhite={isEmojiBlackWhite}
                glossTextTipLang={glossTextTipLang}
                lang={annotatedText.lang}
                lingopClient={lingopClient}
                token={token}
                showGlossText={showGlossText}
                showGlossEmoji={showGlossEmoji}
                showTokenGlossPrefix_TO__={showTokenGlossPrefix_TO__}
              />
            </span>
          );
        })}
      </span>
    </span>
  );
}

export const AnnotatedTextView = forwardRef<
  AnnotatedTextViewHandle,
  AnnotatedTextViewProps
>(AnnotatedTextViewComponent);

AnnotatedTextView.displayName = "AnnotatedTextView";
