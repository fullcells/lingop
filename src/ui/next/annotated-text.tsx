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
  type MouseEvent,
  type ReactNode,
} from "react";

import { linearizeTemplaticAText } from "../../core/annotation/converters.js";
import type {
  AnnotatedText,
  AnnotatedToken,
  ATokenSubMorphemes,
  PhoneticPart,
} from "../../core/annotation/types.js";
import {
  convertEmojiTextToBlackWhiteCompatibleEmojiText,
  shouldBlackWhiteEmojiUseColorEmojiFont,
} from "../../core/emojify.js";
import {
  getSpellingContent,
  getWordExplanationsForWord,
  SpellingSystemsByLang,
  type SpellingSystem,
} from "../../core/language/index.js";
import {
  type LingoDataClient,
  type SupabaseLingoDataClient,
} from "../../core/lingo-data-client.js";
import { ilike, stripDisambiguatorFromToken } from "../../core/misc.js";
import type { TripleDisplayState } from "../types.js";
import {
  captureAnnotatedTextImage,
  downloadAnnotatedTextImage,
  type AnnotatedTextImageData,
} from "./annotated-text-image.js";
import { useLingopClientDataOrCreate } from "./lingop-client-data-provider.js";
import { useOptionalUserLingoPrefsData } from "./user-lingo-prefs.js";
import { useOptionalUserWordStreaksData } from "./user-word-streaks.js";

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
  showSpelling?: TripleDisplayState;
  showMainText?: boolean;
  showGlossText?: TripleDisplayState;
  showGlossEmoji?: TripleDisplayState;
  isEmojiBlackWhite?: boolean;
  /** Language used for the displayed gloss text. */
  glossTextTipLang?: string;
  /** OmniAccess-compatible per-instance annotated-text styling. */
  astyle?: AnnotatedTextStyle;
  /** Whether English verb glosses retain their leading "TO " prefix. */
  showTokenGlossPrefix_TO__?: boolean;
  /** Fades words identified as non-core; Supabase-backed checks require provider configuration. */
  localShouldFadeNonCoreWords?: boolean | null;
  nonCoreWordsFadeOpacity?: number;
  l10nWordDetailHandler?: (
    l10nAText: AnnotatedText,
    l10nATextTokenIdx: number,
    eventWithCurrentTarget: MouseEvent<HTMLDivElement>,
    wordSubMorphemes: ATokenSubMorphemes,
  ) => void;
  /** @deprecated Configure this once on LingopClientDataProvider instead. */
  supabaseClient?: SupabaseLingoDataClient;
};

const visuallyEmpty = "\u00a0";

const WORD_STREAK_LIMIT_FOR_AUTO_HINT = 3;

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
// The current port includes the basic render-component structure, visibility
// and style inputs, optional UserLingoPrefsDataProvider visibility/fading
// defaults, and spelling-system conversions. Action Buttons, TTS, and the
// other OmniAccess behavior are intentionally not ported yet.
// 20260824: userWordStreaks, isWordUnfamiliar, l10nWordDetailHandler, and their
// ON_HINT visibility and styling behavior are now ported. They activate only
// when AnnotatedTextView is rendered within UserWordStreaksDataProvider;
// otherwise streak-dependent behavior is disabled.
// 20260821: Gloss emojis currently port basic color/black-and-white rendering
// and visibility. Per-grapheme flipping, loading spinners, and non-core gloss
// preferences remain deferred.
// 20260822: The OmniAccess astyle shape, defaults, and current render behavior
// are ported without its Chakra dependency. astyle.css applies to Lingop's
// .annotated-text-view root because the future action-button wrapper is not
// present yet.
// 20260822: Download-image and image-data imperative handles are ported with a
// lazy html2canvas import. HTML-table export and unrelated imperative handles
// remain deferred.
type TokenSpellingAndMainViewProps = {
  _showSpelling: TripleDisplayState;
  _showMainText: boolean;
  annotatedText: AnnotatedText;
  astyle: ResolvedAnnotatedTextStyle;
  l10nWordDetailHandler?: AnnotatedTextViewProps["l10nWordDetailHandler"];
  token: AnnotatedToken;
};

function TokenSpellingAndMainView({
  _showSpelling,
  _showMainText,
  annotatedText,
  astyle,
  l10nWordDetailHandler,
  token,
}: TokenSpellingAndMainViewProps): ReactNode {
  const userWordStreaksData = useOptionalUserWordStreaksData();
  const userLingoPrefsData = useOptionalUserLingoPrefsData();
  // `undefined` deliberately means that no provider exists, preserving the
  // component's original standalone/backend-spelling behavior. Within the
  // provider, a language's first configured system remains its default.
  const spellingSystem: SpellingSystem | null | undefined = userLingoPrefsData
    ? (userLingoPrefsData.userPreferredSpellingSystems[annotatedText.lang] ??
      SpellingSystemsByLang[annotatedText.lang]?.[0] ??
      null)
    : undefined;
  const userWordStreaks = userWordStreaksData?.userWordStreaks;
  const wordStreak =
    userWordStreaks?.[annotatedText.lang]?.[token.text.toUpperCase()] ?? null;
  const isWordUnfamiliar =
    !!userWordStreaksData &&
    (wordStreak == null || wordStreak < WORD_STREAK_LIMIT_FOR_AUTO_HINT);

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
      {tokenToPhoneticParts(token).map((part, partIndex) => (
        <TokenPhoneticPartView
          key={`${partIndex}-${part[0]}`}
          astyle={astyle}
          lang={annotatedText.lang}
          part={part}
          shouldShowSpelling={
            _showSpelling === "ALWAYS" ||
            (_showSpelling === "ON_HINT" &&
              !!l10nWordDetailHandler &&
              isWordUnfamiliar)
          }
          showMainText={_showMainText}
          spellingSystem={spellingSystem}
        />
      ))}
    </span>
  );
}

function TokenPhoneticPartView({
  astyle,
  lang,
  part,
  shouldShowSpelling,
  showMainText,
  spellingSystem,
}: {
  astyle: ResolvedAnnotatedTextStyle;
  lang: string;
  part: PhoneticPart;
  shouldShowSpelling: boolean;
  showMainText: boolean;
  /** `undefined` means no preferences provider is present. */
  spellingSystem: SpellingSystem | null | undefined;
}): ReactNode {
  const [chars, backendSpelling] = part;
  const formatSignature = [
    lang,
    chars,
    backendSpelling ?? "",
    spellingSystem ?? "",
    showMainText ? "1" : "0",
  ].join("\u0000");
  const [formatResult, setFormatResult] = useState<{
    signature: string;
    value: string;
  } | null>(null);
  const standaloneSpelling = phoneticPartToSpelling(part, lang, showMainText);

  useEffect(() => {
    if (spellingSystem === undefined) return;
    let cancelled = false;
    const currentPart: PhoneticPart =
      backendSpelling === undefined
        ? [chars]
        : [chars, backendSpelling];
    void getSpellingContent(
      lang,
      currentPart,
      spellingSystem,
      showMainText,
    )
      .then((value) => {
        if (!cancelled) setFormatResult({ signature: formatSignature, value });
      })
      .catch(() => {
        // Retain backend spelling if an optional runtime converter fails.
        if (!cancelled) {
          setFormatResult({
            signature: formatSignature,
            value: standaloneSpelling,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    backendSpelling,
    chars,
    formatSignature,
    lang,
    showMainText,
    spellingSystem,
    standaloneSpelling,
  ]);

  const formattedSpelling =
    formatResult?.signature === formatSignature
      ? formatResult.value
      : standaloneSpelling;

  return (
    <span
      className="phonic"
      style={{
        display: "inline-flex",
        flexDirection: astyle.spellingOnBottom ? "column-reverse" : "column",
        alignItems: "center",
        minWidth: "max-content",
      }}
    >
      <TokenSpellingTextSpan
        astyle={astyle}
        lang={lang}
        showMainText={showMainText}
      >
        {shouldShowSpelling ? formattedSpelling : visuallyEmpty}
      </TokenSpellingTextSpan>
      {showMainText && (
        <TokenMainTextSpan astyle={astyle} isWord>
          {chars}
        </TokenMainTextSpan>
      )}
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
  l10nWordDetailHandler?: AnnotatedTextViewProps["l10nWordDetailHandler"];
  token: AnnotatedToken;
  wordSubMorphemes: ATokenSubMorphemes;
  showGlossText: TripleDisplayState;
  showGlossEmoji: TripleDisplayState;
  showTokenGlossPrefix_TO__: boolean;
};

function TokenGlossView({
  astyle,
  isEmojiBlackWhite,
  glossTextTipLang,
  lang,
  lingopClient,
  l10nWordDetailHandler,
  token,
  wordSubMorphemes,
  showGlossText,
  showGlossEmoji,
  showTokenGlossPrefix_TO__,
}: TokenGlossViewProps): ReactNode {
  // 20260223 Note, updated 20260824: userWordStreaks is optional so ATV
  // consumers without streak-driven behavior do not need the provider.
  const userWordStreaksData = useOptionalUserWordStreaksData();
  const userWordStreaks = userWordStreaksData?.userWordStreaks;
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
  const isWordUnfamiliar = (wordSubMorphemes ?? []).some(({ morpheme }) => {
    const morphemeStreak =
      userWordStreaks?.[lang]?.[morpheme.toUpperCase()] ?? 0;
    return (
      !!userWordStreaksData &&
      morphemeStreak < WORD_STREAK_LIMIT_FOR_AUTO_HINT
    );
  });

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

    if (!enGloss) return;
    if (showGlossEmoji === "NEVER" && !l10nWordDetailHandler) return;
    if (showGlossEmoji === "ON_HINT" && !l10nWordDetailHandler) return;

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
  }, [
    enGloss,
    lang,
    lingopClient,
    l10nWordDetailHandler,
    showGlossEmoji,
    token,
  ]);

  let shouldDisplayGloss = false;
  if (enGloss) {
    if (showGlossEmoji === "ALWAYS" || showGlossText === "ALWAYS") {
      shouldDisplayGloss = true; // Right now, these override any hint displays.
    } else if (showGlossEmoji === "NEVER" && showGlossText === "NEVER") {
      shouldDisplayGloss = false; // This is prioritized after the full-hint display.
    } else if (!l10nWordDetailHandler) {
      shouldDisplayGloss = true;
    } else {
      shouldDisplayGloss = isWordUnfamiliar;
    }
  }

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
      {/* 20260223: ON_HINT visibility can currently be applied directly here. */}
      {(showGlossEmoji === "ALWAYS" ||
        (l10nWordDetailHandler &&
          isWordUnfamiliar &&
          showGlossEmoji === "ON_HINT")) && (
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
      {(showGlossText === "ALWAYS" ||
        (l10nWordDetailHandler &&
          isWordUnfamiliar &&
          showGlossText === "ON_HINT")) && (
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
          {l10nWordDetailHandler &&
            getWordExplanationsForWord(lang, token.text).length > 0 &&
            isWordUnfamiliar && (
              <span className="explanation-asterisk" style={{ opacity: 0.3 }}>
                *
              </span>
            )}
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
  showSpelling,
  showMainText,
  showGlossText,
  showGlossEmoji,
  astyle: astyleInput = DEFAULT_ANNOTATED_TEXT_STYLE,
  isEmojiBlackWhite = false,
  glossTextTipLang = "en",
  showTokenGlossPrefix_TO__ = true,
  localShouldFadeNonCoreWords,
  nonCoreWordsFadeOpacity = 0.5,
  l10nWordDetailHandler,
  supabaseClient,
}: AnnotatedTextViewProps, ref: ForwardedRef<AnnotatedTextViewHandle>): ReactNode {
  const astyle = resolveAnnotatedTextStyle(astyleInput);
  const userLingoPrefsData = useOptionalUserLingoPrefsData();
  // Explicit per-instance inputs take precedence over shared user preferences.
  // Existing standalone defaults remain when no preferences provider is used.
  const resolvedShowSpelling =
    showSpelling ?? userLingoPrefsData?.prefShowSpelling ?? "ALWAYS";
  const resolvedShowMainText =
    showMainText ?? userLingoPrefsData?.prefShowMainText ?? true;
  const resolvedShowGlossText =
    showGlossText ?? userLingoPrefsData?.prefShowGlossText ?? "ALWAYS";
  const resolvedShowGlossEmoji =
    showGlossEmoji ?? userLingoPrefsData?.prefShowGlossEmoji ?? "ON_HINT";
  const resolvedShouldFadeNonCoreWords =
    localShouldFadeNonCoreWords ??
    userLingoPrefsData?.fadeNonCoreWords ??
    false;
  // Render root-and-pattern languages linearly while retaining each surface
  // token's source morphemes for word-streak hinting.
  const { linearizedAText, morphemesPerLinearToken } = useMemo(
    () => linearizeTemplaticAText(annotatedText),
    [annotatedText],
  );
  const exportHTMLElementRef = useRef<HTMLDivElement>(null);
  const userWordStreaksData = useOptionalUserWordStreaksData();
  const userWordStreaks = userWordStreaksData?.userWordStreaks;
  const ensureUserWordStreaksForLang =
    userWordStreaksData?.ensureUserWordStreaksForLang;
  const setUserWordStreaksToValue =
    userWordStreaksData?.setUserWordStreaksToValue;
  const streakWordDetailHandler = userWordStreaksData
    ? l10nWordDetailHandler
    : undefined;
  const lingopClient = useLingopClientDataOrCreate(
    supabaseClient ? { supabaseClient } : {},
  );
  const [coreWordStatusResult, setCoreWordStatusResult] = useState<{
    annotatedText: AnnotatedText;
    statuses: (boolean | null)[]; // boolean if it's a word, null if it's not
  } | null>(null);
  const tokensCoreWordOrUnknownStatus =
    coreWordStatusResult?.annotatedText === linearizedAText
      ? coreWordStatusResult.statuses
      : null;

  // Word Streaks
  useEffect(() => {
    if (
      userWordStreaks &&
      ensureUserWordStreaksForLang &&
      !userWordStreaks[linearizedAText.lang]
    ) {
      // This starts adding the language to userWordStreaks, whose update calls
      // this effect again.
      void ensureUserWordStreaksForLang(linearizedAText.lang);
    }
  }, [
    ensureUserWordStreaksForLang,
    linearizedAText.lang,
    userWordStreaks,
  ]);

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

    if (!resolvedShouldFadeNonCoreWords) return;

    void Promise.all(
      linearizedAText.tokens.map(async (token) => {
        if (!isWordToken(token)) return null;
        // Await the async function, then negate its result.
        const isNotCoreWord = await lingopClient.isNotCoreWord(
          linearizedAText.lang,
          token.text,
          token.gloss ?? undefined,
        );
        return !isNotCoreWord;
      }),
    )
      .then((coreWordStatuses) => {
        if (!cancelled) {
          setCoreWordStatusResult({
            annotatedText: linearizedAText,
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
  }, [linearizedAText, lingopClient, resolvedShouldFadeNonCoreWords]);

  return (
    <div
      ref={exportHTMLElementRef}
      className="annotated-text-view"
      lang={linearizedAText.lang}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        rowGap: "0.25em",
        lineHeight: 1.2,
        ...astyle.css,
      }}
    >
      <div className="tokens" style={{ display: "contents" }}>
        {linearizedAText.tokens.map((_token, index) => {
          const token = stripDisambiguatorFromToken(_token);
          const wordSubMorphemes = morphemesPerLinearToken[index] ?? [];
          const key = `${index}-${token.text}`;
          // Word is "unfamiliar" if ANY of its sub-morphemes is unfamiliar
          // (only root-and-pattern languages like mt have more than one
          // submorpheme).
          const isWordUnfamiliar = wordSubMorphemes.some(({ morpheme }) => {
            const morphemeStreak =
              userWordStreaks?.[linearizedAText.lang]?.[
                morpheme.toUpperCase()
              ] ?? 0;
            return (
              !!userWordStreaksData &&
              morphemeStreak < WORD_STREAK_LIMIT_FOR_AUTO_HINT
            );
          });
          // Non-Core - Fade
          const wordIsCoreOrUnknown =
            tokensCoreWordOrUnknownStatus?.[index] ?? true;
          const opacity =
            resolvedShouldFadeNonCoreWords &&
            !wordIsCoreOrUnknown &&
            !isWordUnfamiliar
              ? nonCoreWordsFadeOpacity
              : 1;
          const tokenInlinePadding =
            index === linearizedAText.tokens.length - 1
              ? "0"
              : `${(
                (astyle.mainTextSize / 5.0) *
                astyle.wordSpacing /
                2.0
              ).toFixed(2)}px`;

          return (
            <div
              key={key}
              className={`token${
                streakWordDetailHandler && isWordToken(token)
                  ? " token-word-detail"
                  : ""
              }${
                streakWordDetailHandler &&
                isWordToken(token) &&
                isWordUnfamiliar
                  ? " token-word-unfamiliar"
                  : ""
              }`}
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
                transition: "all 0.1s ease-in-out",
              }}
              onClick={
                streakWordDetailHandler && isWordToken(token)
                  ? (event) => {
                    event.stopPropagation();
                    if (!isWordUnfamiliar && setUserWordStreaksToValue) {
                      // A 1-way hint-toggle (l10nWordDetailHandler's overlay
                      // itself handles de-hinting).
                      void setUserWordStreaksToValue(
                        linearizedAText.lang,
                        wordSubMorphemes.map(({ morpheme }) => morpheme),
                        1,
                      );
                    }
                    if (isWordUnfamiliar) {
                      streakWordDetailHandler(
                        linearizedAText,
                        index,
                        event,
                        wordSubMorphemes,
                      );
                    }
                  }
                  : undefined
              }
            >
              <TokenSpellingAndMainView
                _showSpelling={resolvedShowSpelling}
                _showMainText={resolvedShowMainText}
                annotatedText={linearizedAText}
                astyle={astyle}
                l10nWordDetailHandler={streakWordDetailHandler}
                token={token}
              />
              <TokenGlossView
                astyle={astyle}
                isEmojiBlackWhite={isEmojiBlackWhite}
                glossTextTipLang={glossTextTipLang}
                lang={linearizedAText.lang}
                lingopClient={lingopClient}
                l10nWordDetailHandler={streakWordDetailHandler}
                token={token}
                wordSubMorphemes={wordSubMorphemes}
                showGlossText={resolvedShowGlossText}
                showGlossEmoji={resolvedShowGlossEmoji}
                showTokenGlossPrefix_TO__={showTokenGlossPrefix_TO__}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const AnnotatedTextView = forwardRef<
  AnnotatedTextViewHandle,
  AnnotatedTextViewProps
>(AnnotatedTextViewComponent);

AnnotatedTextView.displayName = "AnnotatedTextView";
