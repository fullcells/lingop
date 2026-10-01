import { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WORD_STREAKS_MASTERY_THRESHOLD } from "../../core/word-lists.js";
import {
  defaultTranslate,
  type NativeTranslate,
  type NativeWordStreaksData,
} from "./word-detail-types.js";

export function useEnsureWordStreaks(
  data: NativeWordStreaksData | undefined,
  lang: string,
) {
  const known = data?.userWordStreaks[lang] !== undefined;
  const ensure = data?.ensureUserWordStreaksForLang;
  useEffect(() => {
    if (lang && ensure && !known) void ensure(lang).catch(() => {});
  }, [ensure, known, lang]);
}

export function WordStreakControls({
  data,
  lang,
  word,
  words = [word],
  onLearnt,
  translate = defaultTranslate,
}: {
  data: NativeWordStreaksData;
  lang: string;
  word: string;
  words?: string[];
  onLearnt?: (() => void) | undefined;
  translate?: NativeTranslate | undefined;
}) {
  useEnsureWordStreaks(data, lang);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function update(reset: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (reset) await data.deleteUserWordStreaks(lang, words);
      else
        await data.setUserWordStreaksToValue(
          lang,
          words,
          WORD_STREAKS_MASTERY_THRESHOLD,
        );
      if (active.current && !reset) onLearnt?.();
    } catch {
      if (active.current) setFailed(true);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <View style={s.section}>
      <Text style={s.body}>
        {translate("Word Streaks")}:{" "}
        {data.userWordStreaks[lang]?.[word.toUpperCase()] ?? 0}
      </Text>
      <View style={s.row}>
        <Action
          label={translate("Learnt")}
          disabled={busy}
          onPress={() => void update(false)}
        />
        <Action
          label={translate("Reset")}
          disabled={busy}
          onPress={() => void update(true)}
        />
        {busy && <ActivityIndicator accessibilityLabel={translate("Saving")} />}
      </View>
      {failed && (
        <Text accessibilityRole="alert" style={s.error}>
          {translate("Could not save word streaks. Please try again.")}
        </Text>
      )}
    </View>
  );
}
export function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}
export const s = StyleSheet.create({
  section: { gap: 12 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  body: { fontSize: 16, lineHeight: 24, color: "#334155", flexShrink: 1 },
  title: { fontSize: 24, color: "#173e32", fontWeight: "600" },
  error: { color: "#b42318", fontSize: 15 },
  muted: { color: "#64748b", fontSize: 14 },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#e8eee0",
    justifyContent: "center",
  },
  buttonText: { color: "#173e32", fontSize: 15, fontWeight: "600" },
});
