import type { SpeechController, SpeechRequest } from "../../speech/controller.js";
import { SpeechControls } from "./speech-controls.js";
import { useEffect, useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import type {
  AnnotatedText,
  AnnotatedToken,
  ATokenSubMorphemes,
} from "../../core/annotation/types.js";
import { phoneticPartToSpelling } from "../annotated-text-utils.js";
import type { TripleDisplayState } from "../types.js";
import { prepareAnnotatedText } from "./annotated-text-model.js";
import { useGlossEmojis, type AnnotatedTextEmojiClient } from "./use-gloss-emojis.js";
export type { AnnotatedTextEmojiClient } from "./use-gloss-emojis.js";

export type GlossPlacement = "bottom" | "left" | "top" | "right";

/** Sizes and gaps are React Native layout units. Register custom fonts in the app. */
export type AnnotatedTextStyle = {
  mainTextSize?: number;
  spellingSize?: number;
  glossTextSize?: number;
  glossEmojiSize?: number;
  mainTextColor?: string;
  spellingColor?: string;
  glossTextColor?: string;
  glossEmojiColor?: string;
  /** Multiplier matching the web renderer's inter-token padding. */
  wordSpacing?: number;
  lineSpacing?: number;
  tokenPhonicsColumnGap?: number;
  spellingOnBottom?: boolean;
  glossPlacement?: GlossPlacement;
  glossTextAboveEmoji?: boolean;
};

export const DEFAULT_ANNOTATED_TEXT_STYLE: Required<AnnotatedTextStyle> = {
  mainTextSize: 16,
  spellingSize: 12,
  glossTextSize: 12,
  glossEmojiSize: 12,
  mainTextColor: "#000",
  spellingColor: "#000",
  glossTextColor: "#000",
  glossEmojiColor: "#000",
  wordSpacing: 3,
  lineSpacing: 4,
  tokenPhonicsColumnGap: 0,
  spellingOnBottom: false,
  glossPlacement: "bottom",
  glossTextAboveEmoji: false,
};

export type AnnotatedTextTokenContext = {
  /** Original annotation passed to the component. */
  annotatedText: AnnotatedText;
  /** Display token, after templatic linearization and disambiguator removal. */
  token: AnnotatedToken;
  /** Index in the linearized token array, including whitespace/punctuation. */
  index: number;
  /** Original morphemes, useful for app-owned learning state or word details. */
  morphemes: ATokenSubMorphemes;
};

export type AnnotatedTextViewProps = Omit<ViewProps, "children"> & {
  /** Null displays an accessible loading indicator. */
  annotatedText: AnnotatedText | null;
  showSpelling?: TripleDisplayState;
  showMainText?: boolean;
  showGlossText?: TripleDisplayState;
  showGlossEmoji?: TripleDisplayState;
  showTokenGlossPrefix_TO__?: boolean;
  /** ON_HINT rows are visible only when this returns true. */
  isTokenHinted?: (context: AnnotatedTextTokenContext) => boolean;
  /** Shared LingoDataClient; visible glosses use its cached, batched emoji resolver. */
  lingopClient?: AnnotatedTextEmojiClient;
  onEmojiLoadStateChange?: (loading: boolean) => void;
  /** Optional pre-resolved override; bypasses the client's resolver when provided. */
  getTokenEmoji?: (context: AnnotatedTextTokenContext) => string | null | undefined;
  onTokenPress?: (context: AnnotatedTextTokenContext) => void;
  onTokenLongPress?: (context: AnnotatedTextTokenContext) => void;
  tokenAccessibilityHint?: string;
  astyle?: AnnotatedTextStyle;
  mainTextStyle?: StyleProp<TextStyle>;
  spellingStyle?: StyleProp<TextStyle>;
  glossTextStyle?: StyleProp<TextStyle>;
  glossEmojiStyle?: StyleProp<TextStyle>;
  /** Overrides the direction inferred from the annotation language. */
  textDirection?: "ltr" | "rtl";
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number;
  loadingLabel?: string;
  speechController?: SpeechController;
  showActionPlayAudio?: boolean;
  /** Required for API voices; device voices need only annotation text/language. */
  speechContext?: Pick<SpeechRequest, "contentContext" | "ref">;
};

const EMPTY = "\u00a0";
const isVisible = (state: TripleDisplayState, hinted: boolean) =>
  state === "ALWAYS" || (state === "ON_HINT" && hinted);

/** Native renderer with optional app-owned Lingop speech controller. */
export function AnnotatedTextView({
  annotatedText,
  showSpelling = "ALWAYS",
  showMainText = true,
  showGlossText = "ALWAYS",
  showGlossEmoji = "ON_HINT",
  showTokenGlossPrefix_TO__ = true,
  isTokenHinted,
  lingopClient,
  onEmojiLoadStateChange,
  getTokenEmoji,
  onTokenPress,
  onTokenLongPress,
  tokenAccessibilityHint,
  astyle,
  mainTextStyle,
  spellingStyle,
  glossTextStyle,
  glossEmojiStyle,
  textDirection,
  allowFontScaling = true,
  maxFontSizeMultiplier,
  loadingLabel = "Loading annotations",
  style,
  speechController,
  showActionPlayAudio = true,
  speechContext,
  ...viewProps
}: AnnotatedTextViewProps): ReactNode {
  const model = useMemo(
    () => annotatedText ? prepareAnnotatedText(annotatedText) : null,
    [annotatedText],
  );
  const resolved = { ...DEFAULT_ANNOTATED_TEXT_STYLE, ...astyle };

  const contexts = model && annotatedText ? model.tokens.map((token, index) => {
    const context: AnnotatedTextTokenContext = {
      annotatedText, token, index,
      morphemes: model.morphemesPerLinearToken[index] ?? [],
    };
    const hinted = token.isWord === 1 && (isTokenHinted?.(context) ?? false);
    const rawGloss = token.isWord === 1 ? token.gloss ?? "" : "";
    return {
      context, hinted,
      englishGloss: showTokenGlossPrefix_TO__ ? rawGloss : rawGloss.replace(/^to /i, ""),
      emojiVisible: token.isWord === 1 && isVisible(showGlossEmoji, hinted),
    };
  }) : [];
  const emojiBatch = useGlossEmojis(
    getTokenEmoji ? undefined : lingopClient,
    contexts.filter(({ emojiVisible }) => emojiVisible).map(({ englishGloss }) => englishGloss),
  );
  useEffect(() => {
    onEmojiLoadStateChange?.(emojiBatch.loading);
  }, [emojiBatch.loading, onEmojiLoadStateChange]);

  if (!annotatedText || !model) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={loadingLabel}
        accessibilityState={{ busy: true }}
        {...viewProps}
        style={style}
      >
        <ActivityIndicator accessible={false} />
      </View>
    );
  }

  const direction = textDirection ?? model.direction;
  // Explicit layout direction makes a text's language independent of the app's
  // global I18nManager setting. English glosses keep their own LTR direction.
  const layoutDirection: ViewStyle = { direction };
  const interactive = !!(onTokenPress || onTokenLongPress);
  const reserveSpelling = showSpelling !== "NEVER" &&
    model.tokens.some((token) => token.phoneticToken?.length);
  const fontScaling = {
    allowFontScaling,
    ...(maxFontSizeMultiplier === undefined ? {} : { maxFontSizeMultiplier }),
  };
  const mainStyle: StyleProp<TextStyle> = [
    styles.text,
    { fontSize: resolved.mainTextSize, lineHeight: resolved.mainTextSize * 1.25,
      color: resolved.mainTextColor,
      writingDirection: direction },
    mainTextStyle,
  ];
  const rubyStyle: StyleProp<TextStyle> = [
    styles.text,
    { fontSize: showMainText ? resolved.spellingSize : resolved.mainTextSize,
      lineHeight: (showMainText ? resolved.spellingSize : resolved.mainTextSize) * 1.25,
      color: resolved.spellingColor },
    spellingStyle,
  ];
  const glossStyle: StyleProp<TextStyle> = [
    styles.text,
    { fontSize: resolved.glossTextSize, lineHeight: resolved.glossTextSize * 1.25,
      color: resolved.glossTextColor,
      writingDirection: "ltr" },
    glossTextStyle,
  ];
  const emojiStyle: StyleProp<TextStyle> = [
    styles.text,
    { fontSize: resolved.glossEmojiSize, lineHeight: resolved.glossEmojiSize * 1.25,
      color: resolved.glossEmojiColor,
      writingDirection: "ltr" },
    glossEmojiStyle,
  ];

  const rows = model.lines.map((groups) => groups.map((group) => group.map((item) => {
    const { context: sourceContext, hinted, englishGloss, emojiVisible } = contexts[item.index]!;
    const context = { ...sourceContext, token: item.token };
    const emoji = emojiVisible
      ? (getTokenEmoji ? getTokenEmoji(context) : emojiBatch.results?.[englishGloss])
      : null;
    return {
      ...item,
      context,
      spellingVisible: isVisible(showSpelling, hinted),
      gloss: isVisible(showGlossText, hinted) ? englishGloss : "",
      // Match the web renderer: a missing emoji falls back to its English gloss.
      emoji: emojiVisible ? emoji || englishGloss : "",
      emojiLoading: emojiVisible && !!englishGloss && emojiBatch.loading,
    };
  })));

  return (
    <View {...viewProps} style={[styles.container, layoutDirection, style]}>
      {rows.map((groups, lineIndex) => {
        const lineTokens = groups.flat();
        // Reserve identical slots in every placement, including missing data,
        // punctuation and unhinted words. Otherwise text moves into the emoji row.
        const hasGloss = lineTokens.some(({ gloss }) => !!gloss);
        const hasEmoji = lineTokens.some(({ emoji }) => !!emoji);
        return (
          <View
            key={lineIndex}
            style={[styles.line, layoutDirection, { rowGap: resolved.lineSpacing,
              marginTop: lineIndex > 0 ? resolved.lineSpacing : 0 }]}
          >
            {groups.length === 0 && (
              <Text accessible={false} {...fontScaling} style={mainStyle}>{EMPTY}</Text>
            )}
            {groups.map((group, groupIndex) => (
              <View key={groupIndex} style={[styles.group, layoutDirection]}>
                {group.map(({ token, index, context, spellingVisible, gloss, emoji, emojiLoading }, tokenIndex) => {
                  const parts = reserveSpelling && token.isWord === 1 && token.phoneticToken?.length
                    ? token.phoneticToken : [[token.text] as [string]];
                  const showBase = showMainText || (showSpelling !== "NEVER" && !reserveSpelling);
                  const glossRows = (hasGloss || hasEmoji) ? (
                    <View style={[styles.gloss, {
                      flexDirection: resolved.glossTextAboveEmoji ? "column-reverse" : "column",
                    }]}>
                      {hasEmoji ? (
                        <View>
                          <Text accessible={false} {...fontScaling}
                            style={[emojiStyle, emojiLoading && { opacity: 0 }]}>{emoji || EMPTY}</Text>
                          {emojiLoading && <ActivityIndicator accessible={false}
                            style={StyleSheet.absoluteFill} size="small" />}
                        </View>
                      ) : null}
                      {hasGloss ? (
                        <Text accessible={false} {...fontScaling} style={glossStyle}>{gloss || EMPTY}</Text>
                      ) : null}
                    </View>
                  ) : null;
                  const baseRows = (reserveSpelling || showBase) ? (
                    <View style={[styles.phonics, layoutDirection, { columnGap: resolved.tokenPhonicsColumnGap }]}>
                      {parts.map((part, partIndex) => {
                        // Preserve punctuation and missing readings in spelling-only mode.
                        const hasReading = !!token.phoneticToken?.length;
                        const spelling = !showMainText && token.isWord !== 1
                          ? token.text
                          : spellingVisible && (hasReading || !showMainText)
                            ? phoneticPartToSpelling(part, annotatedText.lang, showMainText)
                            : EMPTY;
                        return (
                          <View key={partIndex} style={[styles.part, {
                            flexDirection: resolved.spellingOnBottom ? "column-reverse" : "column",
                          }]}>
                            {reserveSpelling && (
                              <Text accessible={false} {...fontScaling} style={rubyStyle}>
                                {token.isWord === 1 || !showMainText ? spelling : EMPTY}
                              </Text>
                            )}
                            {showBase && (
                              <Text accessible={false} {...fontScaling} style={mainStyle}>
                                {part[0].replaceAll("‿", "")}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : null;
                  if (!baseRows && !glossRows) return null;

                  const horizontalGloss = resolved.glossPlacement === "left" || resolved.glossPlacement === "right";
                  const glossFirst = resolved.glossPlacement === "top" || resolved.glossPlacement === "left";
                  const tokenStyle: StyleProp<ViewStyle> = [styles.token, {
                    // left/right are physical placement choices, independent of text direction.
                    direction: horizontalGloss ? "ltr" : direction,
                    flexDirection: horizontalGloss ? "row" : "column",
                    alignItems: horizontalGloss ? "flex-start" : "center",
                    paddingHorizontal: index === model.tokens.length - 1
                      ? 0 : resolved.mainTextSize / 5 * resolved.wordSpacing / 2,
                  }];
                  const content = glossFirst ? <>{glossRows}{baseRows}</> : <>{baseRows}{glossRows}</>;
                  const key = `${index}-${tokenIndex}`;
                  const accessibilityLabel = [token.text.replaceAll("‿", ""), gloss].filter(Boolean).join(", ");
                  if (interactive && token.isWord === 1) {
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={accessibilityLabel}
                        {...(tokenAccessibilityHint ? { accessibilityHint: tokenAccessibilityHint } : {})}
                        {...(onTokenPress ? { onPress: () => onTokenPress(context) } : {})}
                        {...(onTokenLongPress ? { onLongPress: () => onTokenLongPress(context) } : {})}
                        style={tokenStyle}
                      >{content}</Pressable>
                    );
                  }
                  return (
                    <View key={key} accessible={token.text.trim().length > 0}
                      accessibilityLabel={accessibilityLabel} style={tokenStyle}>
                      {content}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}
      {speechController && showActionPlayAudio && <SpeechControls controller={speechController}
        request={{ ...speechContext, text: annotatedText.lang_text, lang: annotatedText.lang }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch" },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  group: { flexDirection: "row", alignItems: "flex-start" },
  token: { alignItems: "center", gap: 3 },
  phonics: { flexDirection: "row", alignItems: "flex-start" },
  part: { alignItems: "center" },
  gloss: { alignItems: "center", gap: 2 },
  text: { textAlign: "center", includeFontPadding: false },
});
