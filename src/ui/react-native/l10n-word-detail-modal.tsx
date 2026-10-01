import { useCallback, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { AnnotatedTextTokenContext } from "./annotated-text.js";
import {
  L10nWordDetailContent,
  type L10nWordDetailContentProps,
} from "./l10n-word-detail-content.js";
import {
  defaultTranslate,
  type L10nWordDetailData,
  type NativeTranslate,
} from "./word-detail-types.js";

/** Shared shell for word details and chip learning controls; Android Back closes it. */
export function WordDetailSheet({
  visible,
  onClose,
  children,
  translate = defaultTranslate,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  translate?: NativeTranslate | undefined;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {translate("Word details")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate("Close word details")}
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.title}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export type L10nWordDetailModalProps = L10nWordDetailContentProps & {
  visible: boolean;
  onClose: () => void;
};
export function L10nWordDetailModal({
  visible,
  onClose,
  ...props
}: L10nWordDetailModalProps) {
  return (
    <WordDetailSheet
      visible={visible}
      onClose={onClose}
      translate={props.translate}
    >
      {visible && <L10nWordDetailContent {...props} onClose={onClose} />}
    </WordDetailSheet>
  );
}
export type UseL10nWordDetailModalOptions = Omit<
  L10nWordDetailContentProps,
  "l10nWordDetailData" | "onClose"
>;
export function useL10nWordDetailModal(options: UseL10nWordDetailModalOptions) {
  const [data, setData] = useState<L10nWordDetailData | null>(null);
  const closeL10nWordDetail = useCallback(() => setData(null), []);
  const openL10nWordDetail = useCallback(
    (detail: L10nWordDetailData) => setData(detail),
    [],
  );
  const onTokenPress = useCallback(
    ({ annotatedText, token, index, morphemes }: AnnotatedTextTokenContext) => {
      setData({
        l10nWord: token.text,
        l10nLang: annotatedText.lang,
        l10nAText: annotatedText,
        l10nATextTokenIdx: index,
        wordSubMorphemes: morphemes,
      });
    },
    [],
  );
  return {
    open: data !== null,
    l10nWordDetailData: data,
    openL10nWordDetail,
    closeL10nWordDetail,
    onTokenPress,
    ModalComponent: (
      <L10nWordDetailModal
        {...options}
        l10nWordDetailData={data}
        visible={data !== null}
        onClose={closeL10nWordDetail}
      />
    ),
  };
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.38)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: "#fffef9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  title: { fontSize: 20, fontWeight: "600", color: "#173e32" },
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 22, gap: 16 },
});
