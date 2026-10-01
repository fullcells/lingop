import { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { getLang, getLangScript } from "../../core/language/index.js";
import { WORD_STREAKS_MASTERY_THRESHOLD } from "../../core/word-lists.js";
import {
  buildCanonicalWordCaseMap,
  resolveWordDisplayCase,
} from "../word-chips-array-view-utils.js";
import { useNativeResource } from "./native-resource.js";
import {
  useL10nWordDetailModal,
  WordDetailSheet,
  type UseL10nWordDetailModalOptions,
} from "./l10n-word-detail-modal.js";
import {
  WordStreakControls,
  useEnsureWordStreaks,
} from "./word-detail-controls.js";
import {
  defaultTranslate,
  type NativeWordStreaksData,
} from "./word-detail-types.js";

export type L10nWordTapHandler = (
  word: string,
  event: GestureResponderEvent,
) => void;
export type WordChipsArrayViewProps = Omit<ViewProps, "children"> &
  Pick<
    UseL10nWordDetailModalOptions,
    | "lingopClient"
    | "guiLang"
    | "translate"
    | "onPlayAudio"
    | "speechController"
    | "strokeDataProvider"
  > & {
    words: readonly string[];
    lang: string;
    showWordStreaks?: boolean;
    showWordDetailStreakControls?: boolean;
    wordStreaksData?: NativeWordStreaksData;
    onL10nWordTap?: L10nWordTapHandler;
    chipStyle?: StyleProp<ViewStyle>;
    wordStyle?: StyleProp<TextStyle>;
    emptyLabel?: string;
  };

/** Wrapping native chips with one shared word-detail sheet per array. */
export function WordChipsArrayView({
  words,
  lang,
  lingopClient,
  guiLang = "en",
  translate = defaultTranslate,
  onPlayAudio,
  speechController,
  strokeDataProvider,
  showWordStreaks = false,
  showWordDetailStreakControls = true,
  wordStreaksData,
  onL10nWordTap,
  chipStyle,
  wordStyle,
  emptyLabel,
  style,
  ...viewProps
}: WordChipsArrayViewProps) {
  const script = getLangScript(getLang(lang)?.g_script ?? "");
  const caseSensitive = script?.case_sensitive ?? false;
  const load = useMemo(
    () =>
      !caseSensitive
        ? null
        : async () =>
            buildCanonicalWordCaseMap(
              await lingopClient.getSBWordsForLangDir(lang, "en"),
            ),
    [caseSensitive, lang, lingopClient],
  );
  const cases = useNativeResource(load);
  useEnsureWordStreaks(showWordStreaks ? wordStreaksData : undefined, lang);
  const detail = useL10nWordDetailModal({
    lingopClient,
    guiLang,
    focusLang: lang,
    translate,
    showWordStreakControls: showWordDetailStreakControls,
    ...(wordStreaksData ? { wordStreaksData } : {}),
    ...(onPlayAudio ? { onPlayAudio } : {}),
    ...(speechController ? { speechController } : {}),
    ...(strokeDataProvider ? { strokeDataProvider } : {}),
  });
  const [streakWord, setStreakWord] = useState<{
    word: string;
    lang: string;
  } | null>(null);
  const activeStreak =
    streakWord?.lang === lang && showWordStreaks && wordStreaksData
      ? streakWord
      : null;
  const openDetail = detail.openL10nWordDetail;
  const onWord = useCallback<L10nWordTapHandler>(
    (word, event) => {
      if (onL10nWordTap) onL10nWordTap(word, event);
      else openDetail({ l10nWord: word, l10nLang: lang });
    },
    [onL10nWordTap, openDetail, lang],
  );
  const onStreak = useCallback(
    (word: string) => setStreakWord({ word, lang }),
    [lang],
  );
  const closeStreak = useCallback(() => setStreakWord(null), []);
  return (
    <>
      <View
        {...viewProps}
        style={[
          styles.array,
          { direction: script?.is_ltr === false ? "rtl" : "ltr" },
          style,
        ]}
      >
        {!words.length && (
          <Text style={styles.empty}>
            {emptyLabel ?? `0 ${translate("Words")}`}
          </Text>
        )}
        {words.map((source, index) => {
          const word = resolveWordDisplayCase({
            word: source,
            isLangCaseSensitive: caseSensitive,
            canonicalWordCases: cases.value ?? null,
          });
          return (
            <WordChip
              key={`${source}-${index}`}
              word={word}
              onWord={onWord}
              onStreak={onStreak}
              count={
                wordStreaksData?.userWordStreaks[lang]?.[word.toUpperCase()] ??
                0
              }
              showStreak={showWordStreaks && !!wordStreaksData}
              chipStyle={chipStyle}
              wordStyle={wordStyle}
              translate={translate}
            />
          );
        })}
      </View>
      {!onL10nWordTap &&
        detail.l10nWordDetailData?.l10nLang === lang &&
        detail.ModalComponent}
      {!!activeStreak && wordStreaksData && (
        <WordDetailSheet visible onClose={closeStreak} translate={translate}>
          <Text style={styles.word}>{activeStreak.word}</Text>
          <WordStreakControls
            key={`${lang}:${activeStreak.word}`}
            data={wordStreaksData}
            lang={lang}
            word={activeStreak.word}
            translate={translate}
          />
          <Text style={styles.empty}>
            {translate("Word Streaks represent how well you know a word.")}
          </Text>
        </WordDetailSheet>
      )}
    </>
  );
}
const WordChip = memo(function WordChip({
  word,
  count,
  showStreak,
  onWord,
  onStreak,
  chipStyle,
  wordStyle,
  translate,
}: {
  word: string;
  count: number;
  showStreak: boolean;
  onWord: L10nWordTapHandler;
  onStreak: (word: string) => void;
  chipStyle: StyleProp<ViewStyle>;
  wordStyle: StyleProp<TextStyle>;
  translate: (text: string) => string;
}) {
  const mastered = count >= WORD_STREAKS_MASTERY_THRESHOLD;
  return (
    <View style={[styles.chip, chipStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={word}
        onPress={(event) => onWord(word, event)}
        style={styles.wordButton}
      >
        <Text style={[styles.word, wordStyle]}>{word}</Text>
      </Pressable>
      {showStreak && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${word}: ${translate("Word Streaks")}, ${count}`}
          onPress={() => onStreak(word)}
          style={[
            styles.streak,
            {
              backgroundColor: mastered
                ? "#c9dfbd"
                : count > 0
                  ? "#fef3c7"
                  : "#edf0e9",
            },
          ]}
        >
          <Text style={styles.count}>
            {mastered ? "◆" : "◇"}{" "}
            {String(Math.max(0, Math.min(99, count))).padStart(2, "0")}
          </Text>
        </Pressable>
      )}
    </View>
  );
});
const styles = StyleSheet.create({
  array: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-start",
  },
  chip: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d5dfce",
    borderRadius: 14,
    backgroundColor: "#fffef9",
    overflow: "hidden",
    maxWidth: "100%",
  },
  wordButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    flexShrink: 1,
  },
  word: { fontSize: 18, color: "#173e32" },
  streak: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  count: { fontSize: 13, color: "#36533c", fontVariant: ["tabular-nums"] },
  empty: { color: "#64748b", fontSize: 15, lineHeight: 22 },
});
