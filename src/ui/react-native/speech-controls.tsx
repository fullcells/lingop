import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  SpeechController,
  SpeechRequest,
  SpeechVoiceList,
  LingopSpeechVoice,
} from "../../speech/controller.js";
import { useNativeResource } from "./native-resource.js";
import { defaultTranslate, type NativeTranslate } from "./word-detail-types.js";

export type SpeechControlsProps = {
  controller: SpeechController;
  request: SpeechRequest;
  translate?: NativeTranslate;
};
const voiceLabel = (v: LingopSpeechVoice) =>
  v.service === "DEVICE" ? v.name : v.voice_id;
const key = (v: LingopSpeechVoice) =>
  `${v.service}:${v.voice_id}:${v.voice_lang}`;

/** Shares voice/speed preferences with every native view using this controller. */
export function SpeechControls({
  controller,
  request,
  translate = defaultTranslate,
}: SpeechControlsProps) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const owner = useRef({}).current;
  const [picker, setPicker] = useState(false);
  const referenceKey = JSON.stringify(request.ref);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") void controller.stop(owner).catch(() => {});
    });
    return () => {
      subscription.remove();
      void controller.stop(owner).catch(() => {});
    };
  }, [
    controller,
    owner,
    request.text,
    request.lang,
    request.contentContext,
    referenceKey,
  ]);
  const owned = state.owner === owner;
  const busy =
    owned && (state.status === "loading" || state.status === "speaking");
  const preferred = state.preferences.voices[request.lang.toLowerCase()];
  const play = () => {
    if (busy) void controller.stop(owner).catch(() => {});
    else void controller.speak(request, owner).catch(() => {}); // Error is exposed in the shared snapshot.
  };
  return (
    <View style={styles.controls}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate(busy ? "Stop audio" : "Play audio")}
          onPress={play}
          style={styles.button}
        >
          <Text style={styles.label}>
            {translate(
              busy
                ? state.status === "loading"
                  ? "Cancel loading"
                  : "Stop audio"
                : "Play audio",
            )}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate("Choose voice")}
          onPress={() => setPicker(true)}
          style={styles.button}
        >
          <Text style={styles.label}>
            {preferred
              ? voiceLabel(preferred)
              : translate("Device voice (automatic)")}{" "}
            ▾
          </Text>
        </Pressable>
      </View>
      {owned && state.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {translate(state.error)}
        </Text>
      )}
      {picker && (
        <SpeechVoicePicker
          controller={controller}
          lang={request.lang}
          onClose={() => setPicker(false)}
          translate={translate}
        />
      )}
    </View>
  );
}

export function SpeechVoicePicker({
  controller,
  lang,
  onClose,
  translate = defaultTranslate,
}: {
  controller: SpeechController;
  lang: string;
  onClose: () => void;
  translate?: NativeTranslate;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const loader = useMemo(
    () => () => controller.listVoices(lang),
    [controller, lang],
  );
  const result = useNativeResource<SpeechVoiceList>(loader);
  const selected = state.preferences.voices[lang.toLowerCase()];
  const select = (voice: LingopSpeechVoice | null) => {
    void controller.stop().catch(() => {});
    controller.setVoice(lang, voice);
    onClose();
  };
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          onPress={onClose}
        />
        <View
          style={styles.sheet}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <View style={styles.row}>
            <Text accessibilityRole="header" style={styles.title}>
              {translate("Choose voice")}
            </Text>
            <Pressable
              style={styles.button}
              accessibilityRole="button"
              onPress={onClose}
            >
              <Text>{translate("Close")}</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Pressable
              style={styles.button}
              accessibilityRole="radio"
              accessibilityState={{ checked: !selected }}
              onPress={() => select(null)}
            >
              <Text>
                {!selected ? "✓ " : ""}
                {translate("Automatic — prefer device voice")}
              </Text>
            </Pressable>
            {result.status === "LOADING" && (
              <Text>{translate("Loading voices…")}</Text>
            )}
            {result.value?.voices.map((voice) => (
              <Pressable
                key={key(voice)}
                style={styles.button}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: !!selected && key(selected) === key(voice),
                }}
                onPress={() => select(voice)}
              >
                <Text>
                  {selected && key(selected) === key(voice) ? "✓ " : ""}
                  {voiceLabel(voice)}
                </Text>
                <Text style={styles.secondary}>
                  {voice.voice_lang} ·{" "}
                  {voice.service === "DEVICE"
                    ? translate("On device")
                    : `${voice.service} · ${translate("Online")}`}
                </Text>
              </Pressable>
            ))}
            {result.value && !result.value.voices.length && (
              <Text>{translate("No voices available for this language.")}</Text>
            )}
            {(result.status === "FAILED" || !!result.value?.errors.length) && (
              <View>
                <Text style={styles.error}>
                  {translate("Some voices could not be loaded.")}
                </Text>
                <Pressable
                  style={styles.button}
                  accessibilityRole="button"
                  onPress={result.retry}
                >
                  <Text>{translate("Retry")}</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.title}>{translate("Speaking speed")}</Text>
            <View style={styles.row}>
              {[0.75, 1, 1.25, 1.5].map((rate) => (
                <Pressable
                  key={rate}
                  style={styles.button}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: state.preferences.rate === rate,
                  }}
                  onPress={() => controller.setRate(rate)}
                >
                  <Text>
                    {state.preferences.rate === rate ? "✓ " : ""}
                    {rate}×
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  controls: { gap: 8, marginTop: 12, direction: "ltr" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  button: {
    minHeight: 44,
    justifyContent: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#e8eee4",
    marginVertical: 3,
  },
  label: { color: "#173e32", fontSize: 14 },
  secondary: { fontSize: 12, color: "#526758" },
  error: { color: "#a12222" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.38)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "80%",
    padding: 22,
    paddingBottom: 40,
    backgroundColor: "#fffef9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: { fontSize: 18, fontWeight: "600", paddingVertical: 12 },
});
