"use client";

import {
  forwardRef,
  useCallback,
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
  doesLangMainScriptHaveReadingGuide,
  getLang,
  getLangScript,
  getMainScriptReadingGuidePart,
  getSpellingContent,
  getWordExplanationsForWord,
  SpellingSystemsByLang,
  type SpellingSystem,
} from "../../core/language/index.js";
import {
  type LingoDataClient,
  type SupabaseLingoDataClient,
} from "../../core/lingo-data-client.js";
import {
  ilike,
  stripDisambiguatorFromToken,
  type ContentReference,
} from "../../core/misc.js";
import type { TripleDisplayState } from "../types.js";
import {
  captureAnnotatedTextImage,
  downloadAnnotatedTextImage,
  type AnnotatedTextImageData,
} from "./annotated-text-image.js";
import {
  useLingopClientDataOrCreate,
  useOptionalLingopClientData,
} from "./lingop-client-data-provider.js";
import * as speechSynthTTS from "./speech-synth-tts.js";
import type {
  APIVoiceAccessProfile,
  ContentContext,
  SpeechSynthTTSOptions,
  SpeechSynthTTSVoice,
} from "./speech-synth-tts.js";
import { useOptionalUserLingoPrefsData } from "./user-lingo-prefs.js";
import { useOptionalUserWordStreaksData } from "./user-word-streaks.js";

export type { AnnotatedTextImageData } from "./annotated-text-image.js";

export type AnnotatedTextViewHandle = {
  requestDownloadImage: (index: number) => Promise<void>;
  requestImageData: (
    scale?: number,
  ) => Promise<AnnotatedTextImageData | undefined>;
  triggerSpeechSynthesis: () => Promise<void>;
  getSpelling: () => string | null;
};

export type GlossPlacement = "bottom" | "left" | "top" | "right";

export type AnnotatedTextActionsPlacement =
  | "LEFT_RIGHT"
  | "TOP"
  | "BOTTOM"
  | "RIGHT_LEFT";

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
  /** Overrides the shared preference for locally generated script guides. */
  showLocalMainTextReadingGuide?: boolean | null;
  /** Fades words identified as non-core; Supabase-backed checks require provider configuration. */
  localShouldFadeNonCoreWords?: boolean | null;
  nonCoreWordsFadeOpacity?: number;

  // 20260118: Replace showAction* with
  // actionsVisible: ("PLAY_AUDIO" | "TOGGLE_GLOSS_EMOJI")[]. Retain the
  // current OmniAccess input during the ATV migration.
  showActionPlayAudio?: boolean;
  actionsPlacement?: AnnotatedTextActionsPlacement;

  apiVoiceAccessProfile?: APIVoiceAccessProfile; // TTS
  contentContext_forAPISpeech?: ContentContext;
  // contentRef may be usable for other things in future.
  contentRef_forAPISpeech?: ContentReference;
  shouldPreloadSpeech?: boolean;

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

const mainTextFontFamiliesByLang: Partial<Record<string, string>> = {
  ja: "Noto Sans JP",
  tok: "Linja Laso",
};

function isWordToken(token: AnnotatedToken): boolean {
  return token.isWord === 1;
}

function canResolveSpeechForVoice({
  contentContext,
  hasSupabaseClient,
  ref,
  voice,
}: {
  contentContext: ContentContext | undefined;
  hasSupabaseClient: boolean;
  ref: ContentReference | undefined;
  voice: SpeechSynthTTSVoice | null;
}): boolean {
  if (!voice) return false;
  if (voice.service === "BROWSER") return true;

  // Browser voices synthesize locally. Cloud voices play a stored/generated
  // audio file, so speechSynthTTS needs a contentContext to choose the correct
  // lookup/creation path. PUBLIC_CONTENT is keyed by ref; MEMBER_CONTENT uses
  // the signed-in Supabase client. LIMITED_TEMP_ANON needs neither.
  if (!contentContext) return false;
  if (contentContext === "PUBLIC_CONTENT") return ref !== undefined;
  if (contentContext === "MEMBER_CONTENT") return hasSupabaseClient;
  return true;
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

// Port status (20260824): Lingop ATV covers OmniAccess's core render/style
// inputs, spelling systems and reading guides, preference/streak-driven hints,
// non-core fading, audio actions/preloading, and image/spelling exports. It uses
// optional Lingop providers and plain DOM/CSS; astyle.css targets the exported
// content rather than its action wrapper. Remaining parity work is limited to
// nullable/loading annotations, a few exact visibility/layout cases, Korean
// affix-marker cleanup, richer emoji/non-core-gloss behavior, and HTML-table
// export.
type TokenSpellingAndMainViewProps = {
  _showSpelling: TripleDisplayState;
  _showMainText: boolean;
  annotatedText: AnnotatedText;
  astyle: ResolvedAnnotatedTextStyle;
  l10nWordDetailHandler?: AnnotatedTextViewProps["l10nWordDetailHandler"];
  mainLangFont: string | undefined;
  showMainTextReadingGuide: boolean;
  spellingSystem: SpellingSystem | null | undefined;
  token: AnnotatedToken;
  tokenCoreWordOrUnknownStatus: boolean | null;
};

function TokenSpellingAndMainView({
  _showSpelling,
  _showMainText,
  annotatedText,
  astyle,
  l10nWordDetailHandler,
  mainLangFont,
  showMainTextReadingGuide,
  spellingSystem,
  token,
  tokenCoreWordOrUnknownStatus,
}: TokenSpellingAndMainViewProps): ReactNode {
  const userWordStreaksData = useOptionalUserWordStreaksData();
  const userLingoPrefsData = useOptionalUserLingoPrefsData();
  const showNonCoreSpelling =
    userLingoPrefsData?.showNonCoreSpelling ?? "ALWAYS";
  const userWordStreaks = userWordStreaksData?.userWordStreaks;
  const wordStreak =
    userWordStreaks?.[annotatedText.lang]?.[token.text.toUpperCase()] ?? null;
  const isWordUnfamiliar =
    !!userWordStreaksData &&
    (wordStreak == null || wordStreak < WORD_STREAK_LIMIT_FOR_AUTO_HINT);
  const mainScriptHasReadingGuide = doesLangMainScriptHaveReadingGuide(
    annotatedText.lang,
  );
  const atextHasPhonetics =
    annotatedText.containsPhonetics ||
    (mainScriptHasReadingGuide && showMainTextReadingGuide);
  const readingGuideSignature = `${annotatedText.lang}\u0000${token.text}`;
  const [localReadingGuideResult, setLocalReadingGuideResult] = useState<{
    signature: string;
    part: PhoneticPart | null;
  } | null>(null);

  // Local Main Script Reading Guide Part.
  useEffect(() => {
    if (
      token.phoneticToken?.length ||
      !mainScriptHasReadingGuide ||
      !showMainTextReadingGuide
    ) {
      return;
    }

    let cancelled = false;
    void getMainScriptReadingGuidePart(annotatedText.lang, token.text)
      .then((part) => {
        if (!cancelled) {
          setLocalReadingGuideResult({
            signature: readingGuideSignature,
            part,
          });
        }
      })
      .catch(() => {
        // Fail open: retain the main text if an optional converter fails.
        if (!cancelled) {
          setLocalReadingGuideResult({
            signature: readingGuideSignature,
            part: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    annotatedText.lang,
    mainScriptHasReadingGuide,
    readingGuideSignature,
    showMainTextReadingGuide,
    token.phoneticToken,
    token.text,
  ]);

  const localMainScriptReadingGuidePart =
    localReadingGuideResult?.signature === readingGuideSignature
      ? localReadingGuideResult.part
      : null;

  // BASE TEXT: WHEN ATEXT HAS NO PHONETICS.
  if (_showSpelling === "NEVER" || !atextHasPhonetics) {
    // Match OmniAccess's content-preserving fallback: if neither a spelling
    // row nor backend/local phonetics can render, keep the token's base text.
    return (
      <TokenMainTextSpan
        astyle={astyle}
        isWord={isWordToken(token)}
        mainLangFont={mainLangFont}
      >
        {token.text}
      </TokenMainTextSpan>
    );
  }

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
          spellingSystem={spellingSystem}
        >
          {!_showMainText ? token.text : visuallyEmpty}
        </TokenSpellingTextSpan>
        {_showMainText && (
          <TokenMainTextSpan
            astyle={astyle}
            isWord={false}
            mainLangFont={mainLangFont}
          >
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
      {(token.phoneticToken?.length
        ? token.phoneticToken
        : [localMainScriptReadingGuidePart]
      ).map((part, partIndex) => (
        <TokenPhoneticPartView
          key={`${partIndex}-${part?.[0] ?? token.text}`}
          astyle={astyle}
          lang={annotatedText.lang}
          part={part}
          shouldShowSpelling={
            (_showSpelling === "ALWAYS" &&
              (tokenCoreWordOrUnknownStatus !== false ||
                showNonCoreSpelling === "ALWAYS")) ||
            (_showSpelling === "ON_HINT" &&
              !!l10nWordDetailHandler &&
              isWordUnfamiliar)
          }
          showMainText={_showMainText}
          spellingSystem={spellingSystem}
          tokenText={token.text}
          mainLangFont={mainLangFont}
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
  tokenText,
  mainLangFont,
}: {
  astyle: ResolvedAnnotatedTextStyle;
  lang: string;
  part: PhoneticPart | null;
  shouldShowSpelling: boolean;
  showMainText: boolean;
  /** `undefined` means no preferences provider is present. */
  spellingSystem: SpellingSystem | null | undefined;
  tokenText: string;
  mainLangFont: string | undefined;
}): ReactNode {
  const chars = part?.[0] ?? tokenText;
  const backendSpelling = part?.[1];
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
  const standaloneSpelling = part
    ? phoneticPartToSpelling(part, lang, showMainText)
    : visuallyEmpty;

  useEffect(() => {
    if (spellingSystem === undefined) return;
    let cancelled = false;
    const currentPart: PhoneticPart | null = part
      ? backendSpelling === undefined
        ? [chars]
        : [chars, backendSpelling]
      : null;
    void getSpellingContent(
      lang,
      currentPart,
      spellingSystem,
      showMainText,
    )
      .then((value) => {
        // If text is punctuation, use it instead. If spacing regresses, check
        // whether this is overriding getSpellingContent's EMPTY_SPACE value.
        // Ported from OmniAccess's 20260618 behavior.
        const spelling =
          !showMainText && !part && tokenText.trim().length !== 0
            ? tokenText
            : value;
        if (!cancelled) {
          setFormatResult({ signature: formatSignature, value: spelling });
        }
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
    part,
    showMainText,
    spellingSystem,
    standaloneSpelling,
    tokenText,
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
        spellingSystem={spellingSystem}
      >
        {shouldShowSpelling ? formattedSpelling : visuallyEmpty}
      </TokenSpellingTextSpan>
      {showMainText && (
        <TokenMainTextSpan
          astyle={astyle}
          isWord
          mainLangFont={mainLangFont}
        >
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
  spellingSystem,
}: {
  astyle: ResolvedAnnotatedTextStyle;
  children: ReactNode;
  lang: string;
  showMainText: boolean;
  spellingSystem: SpellingSystem | null | undefined;
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
        ...(lang === "yue" && spellingSystem?.startsWith("YUE_JYUTPING")
          ? { fontFamily: "LS Jyutping" }
          : {}),
        ...(spellingSystem?.includes("IPA")
          ? { fontFamily: "Arial" }
          : {}), // Dedicated IPA fonts can be finicky (e.g. Noto Sans italic); default fonts such as Arial render them reliably.
        ...(spellingSystem?.startsWith("EN_CL_DIACRITICS")
          ? { fontFamily: "Noto Sans, sans-serif" }
          : {}),
        // A future RTL reading-guide mode could flip horizontally based on the
        // main script direction, as considered in OmniAccess.
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
  mainLangFont,
}: {
  astyle: ResolvedAnnotatedTextStyle;
  children: ReactNode;
  isWord: boolean;
  mainLangFont: string | undefined;
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
        ...(mainLangFont ? { fontFamily: mainLangFont } : {}),
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

function ActionButtonSpeak({
  isSpeaking,
  triggerSpeechSynthesis,
}: {
  isSpeaking: boolean;
  triggerSpeechSynthesis: () => Promise<void>;
}): ReactNode {
  return (
    <button
      type="button"
      className="annotated-text-action-button annotated-text-action-speak"
      aria-label="Play audio"
      aria-busy={isSpeaking}
      disabled={isSpeaking}
      onClick={(event) => {
        event.stopPropagation();
        void triggerSpeechSynthesis();
      }}
    >
      {isSpeaking ? (
        <span className="annotated-text-action-spinner" aria-hidden="true" />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
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
  showLocalMainTextReadingGuide,
  localShouldFadeNonCoreWords,
  nonCoreWordsFadeOpacity = 0.5,
  showActionPlayAudio = false,
  actionsPlacement = "LEFT_RIGHT",
  apiVoiceAccessProfile,
  contentContext_forAPISpeech,
  contentRef_forAPISpeech,
  shouldPreloadSpeech = false,
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
  const resolvedShowMainTextReadingGuide =
    showLocalMainTextReadingGuide ??
    userLingoPrefsData?.showMainTextReadingGuide ??
    false;
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
  // `undefined` deliberately means that no provider exists, preserving the
  // component's standalone/backend-spelling behavior. Within the provider, a
  // language's first configured spelling system remains its default.
  const spellingSystem: SpellingSystem | null | undefined = userLingoPrefsData
    ? (userLingoPrefsData.userPreferredSpellingSystems[
        linearizedAText.lang
      ] ??
      SpellingSystemsByLang[linearizedAText.lang]?.[0] ??
      null)
    : undefined;
  // DISPLAY: FONTS (also used by image exports).
  const mainLangFont = mainTextFontFamiliesByLang[linearizedAText.lang];
  const streakWordDetailHandler = userWordStreaksData
    ? l10nWordDetailHandler
    : undefined;
  const providedClientData = useOptionalLingopClientData();
  const lingopClient = useLingopClientDataOrCreate(
    supabaseClient ? { supabaseClient } : {},
  );
  const speechSupabaseClient =
    supabaseClient ?? providedClientData?.supabaseClient;
  const resolvedAPIVoiceAccessProfile =
    apiVoiceAccessProfile ??
    providedClientData?.apiVoiceAccessProfile ??
    "NONE";
  const speechOptions = useMemo<SpeechSynthTTSOptions>(
    () => ({
      ...(speechSupabaseClient
        ? { supabaseClient: speechSupabaseClient }
        : {}),
      ...(providedClientData
        ? { useStagingBackend: providedClientData.useStagingBackend }
        : {}),
    }),
    [providedClientData, speechSupabaseClient],
  );
  // ACTION: AUDIO
  const [langIsSpeakable, setLangIsSpeakable] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechInFlightRef = useRef<Promise<void> | null>(null);
  const [coreWordStatusResult, setCoreWordStatusResult] = useState<{
    annotatedText: AnnotatedText;
    statuses: (boolean | null)[]; // boolean if it's a word, null if it's not
  } | null>(null);
  const tokensCoreWordOrUnknownStatus =
    coreWordStatusResult?.annotatedText === linearizedAText
      ? coreWordStatusResult.statuses
      : null;
  const spellingFormatSignature = [
    linearizedAText.lang,
    spellingSystem ?? "",
    resolvedShowMainText ? "1" : "0",
  ].join("\u0000");
  const [formattedPhoneticPartsResult, setFormattedPhoneticPartsResult] =
    useState<{
      annotatedText: AnnotatedText;
      signature: string;
      parts: string[][];
    } | null>(null);

  // SPELLING-CONTENT: Pre-format the full annotation for getSpelling(). Token
  // rendering remains local so async conversion cannot delay the whole ATV.
  useEffect(() => {
    let cancelled = false;
    setFormattedPhoneticPartsResult(null);

    if (!linearizedAText.containsPhonetics) return;

    void Promise.all(
      linearizedAText.tokens.map((token) =>
        Promise.all(
          (token.phoneticToken ?? []).map((phoneticPart) =>
            getSpellingContent(
              linearizedAText.lang,
              phoneticPart,
              spellingSystem ?? null,
              resolvedShowMainText,
            ),
          ),
        ),
      ),
    )
      .then((parts) => {
        if (!cancelled) {
          setFormattedPhoneticPartsResult({
            annotatedText: linearizedAText,
            signature: spellingFormatSignature,
            parts,
          });
        }
      })
      .catch(() => {
        // A failed optional converter leaves getSpelling unavailable while the
        // rendered ATV retains each backend spelling as its fallback.
      });

    return () => {
      cancelled = true;
    };
  }, [
    linearizedAText,
    resolvedShowMainText,
    spellingFormatSignature,
    spellingSystem,
  ]);

  const getSpelling = useCallback((): string | null => {
    const formattedResult = formattedPhoneticPartsResult;
    if (
      !formattedResult ||
      formattedResult.annotatedText !== linearizedAText ||
      formattedResult.signature !== spellingFormatSignature ||
      !linearizedAText.containsPhonetics
    ) {
      return null;
    }

    const tokenSpellings: string[] = [];
    for (const [index, token] of linearizedAText.tokens.entries()) {
      const tokenFormattedParts = formattedResult.parts[index] ?? [];
      tokenSpellings.push(
        tokenFormattedParts.length
          ? tokenFormattedParts.join(" ")
          : token.text,
      );
    }
    return tokenSpellings.join(" ");
  }, [
    formattedPhoneticPartsResult,
    linearizedAText,
    spellingFormatSignature,
  ]);

  const getResolvableActiveSpeechVoice = useCallback(async () => {
    const voice = await speechSynthTTS.getActiveVoiceForLang(
      linearizedAText.lang,
      resolvedAPIVoiceAccessProfile,
      speechOptions,
    );
    return canResolveSpeechForVoice({
      contentContext: contentContext_forAPISpeech,
      hasSupabaseClient: speechSupabaseClient !== undefined,
      ref: contentRef_forAPISpeech,
      voice,
    })
      ? voice
      : null;
  }, [
    contentContext_forAPISpeech,
    contentRef_forAPISpeech,
    linearizedAText.lang,
    resolvedAPIVoiceAccessProfile,
    speechOptions,
    speechSupabaseClient,
  ]);

  // ACTION: AUDIO - Re-check when browser voices arrive/change, the language
  // changes, or a consumer changes its cloud-speech access/configuration.
  useEffect(() => {
    let cancelled = false;
    setLangIsSpeakable(false);

    void getResolvableActiveSpeechVoice()
      .then((voice) => {
        if (!cancelled) setLangIsSpeakable(voice !== null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error(
            "Error determining whether language is speakable:",
            error,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getResolvableActiveSpeechVoice]);

  const triggerSpeechSynthesis = useCallback((): Promise<void> => {
    // One ATV should not start overlapping playback when its button or
    // imperative handle is triggered repeatedly.
    if (speechInFlightRef.current) return speechInFlightRef.current;

    let request!: Promise<void>;
    request = (async () => {
      setIsSpeaking(true);
      try {
        const voice = await getResolvableActiveSpeechVoice();
        if (!voice) return;
        await speechSynthTTS.speak({
          text: linearizedAText.lang_text,
          lang: linearizedAText.lang,
          apiVoiceAccessProfile: resolvedAPIVoiceAccessProfile,
          ...(contentContext_forAPISpeech
            ? { contentContext: contentContext_forAPISpeech }
            : {}),
          ...(contentRef_forAPISpeech ? { ref: contentRef_forAPISpeech } : {}),
          ...speechOptions,
        });
      } catch (error: unknown) {
        console.error("Could not play annotated-text speech:", error);
      } finally {
        if (speechInFlightRef.current === request) {
          speechInFlightRef.current = null;
        }
        setIsSpeaking(false);
      }
    })();
    speechInFlightRef.current = request;
    return request;
  }, [
    contentContext_forAPISpeech,
    contentRef_forAPISpeech,
    getResolvableActiveSpeechVoice,
    linearizedAText.lang,
    linearizedAText.lang_text,
    resolvedAPIVoiceAccessProfile,
    speechOptions,
  ]);

  useEffect(() => {
    if (!shouldPreloadSpeech) return;

    // Fine to call for any voice: browser speech is a no-op here. For a cloud
    // voice this follows the same metadata lookup/creation path as playback,
    // then buffers the resulting file. Keep it behind this explicit input so
    // consumers decide when that backend work should happen.
    void getResolvableActiveSpeechVoice()
      .then((voice) => {
        if (!voice) return;
        return speechSynthTTS.preloadSpeech({
          text: linearizedAText.lang_text,
          lang: linearizedAText.lang,
          apiVoiceAccessProfile: resolvedAPIVoiceAccessProfile,
          ...(contentContext_forAPISpeech
            ? { contentContext: contentContext_forAPISpeech }
            : {}),
          ...(contentRef_forAPISpeech ? { ref: contentRef_forAPISpeech } : {}),
          ...speechOptions,
        });
      })
      .catch((error: unknown) => {
        console.error("Could not preload annotated-text speech:", error);
      });
  }, [
    contentContext_forAPISpeech,
    contentRef_forAPISpeech,
    getResolvableActiveSpeechVoice,
    linearizedAText.lang,
    linearizedAText.lang_text,
    resolvedAPIVoiceAccessProfile,
    shouldPreloadSpeech,
    speechOptions,
  ]);

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
  useImperativeHandle(
    ref,
    () => ({
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
      triggerSpeechSynthesis,
      getSpelling,
    }),
    [getSpelling, triggerSpeechSynthesis],
  );

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

  const actionsAreVertical =
    actionsPlacement === "TOP" || actionsPlacement === "BOTTOM";
  const actionsAtStart = actionsPlacement !== "LEFT_RIGHT";
  const mainLang = getLang(linearizedAText.lang);
  const mainScript = mainLang ? getLangScript(mainLang.g_script) : undefined;
  const actionButton = showActionPlayAudio && langIsSpeakable ? (
    <ActionButtonSpeak
      isSpeaking={isSpeaking}
      triggerSpeechSynthesis={triggerSpeechSynthesis}
    />
  ) : null;

  return (
    <div
      className="annotated-text-view-wrapper"
      dir={mainScript?.is_ltr === false ? "rtl" : undefined}
      data-actions-placement={actionsPlacement}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "stretch",
        flexDirection:
          actionsPlacement === "TOP"
            ? "column"
            : actionsPlacement === "BOTTOM"
              ? "column-reverse"
              : "row",
      }}
    >
      {/* ACTION BUTTONS: START (LEFT) */}
      {/* Future: Smarter "splitting" of Action Buttons (on LEFT_RIGHT vs TOP),
          as actions increase. They may move into their own wrapper; now that
          Hint is deprecated, Speak is the only action button. - 20260621 */}
      {actionsAtStart && actionButton && (
        <div
          className="annotated-text-actions"
          style={actionsAreVertical ? { width: "100%", minHeight: 28 } : {}}
        >
          {actionButton}
        </div>
      )}

      {/* ANNOTATED TEXT VIEW */}
      <div
        ref={exportHTMLElementRef}
        className="annotated-text-view"
        lang={linearizedAText.lang}
        aria-label={linearizedAText.lang_text}
        style={{
          display: "flex",
          flex: 1,
          flexWrap: "wrap",
          alignContent: "center",
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
                mainLangFont={mainLangFont}
                showMainTextReadingGuide={resolvedShowMainTextReadingGuide}
                spellingSystem={spellingSystem}
                token={token}
                tokenCoreWordOrUnknownStatus={
                  tokensCoreWordOrUnknownStatus?.[index] ?? null
                }
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

      {/* ACTION BUTTONS: END (RIGHT) */}
      {!actionsAtStart && actionButton && (
        <div className="annotated-text-actions">{actionButton}</div>
      )}
    </div>
  );
}

export const AnnotatedTextView = forwardRef<
  AnnotatedTextViewHandle,
  AnnotatedTextViewProps
>(AnnotatedTextViewComponent);

AnnotatedTextView.displayName = "AnnotatedTextView";
