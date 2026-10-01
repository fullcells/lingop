import type { SpeechController } from "../../speech/controller.js";
import { SpeechControls } from "./speech-controls.js";
import { lazy, Suspense, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type ViewProps,
} from "react-native";
import type { AnnotatedText } from "../../core/annotation/types.js";
import {
  getLang,
  getLangScript,
  getWordExplanationsForWord,
  traditionalToSimplifiedChinese,
} from "../../core/language/index.js";
import {
  getStrokeCharacters,
  supportsStrokeOrder,
  type StrokeDataProvider,
} from "../../stroke-order/index.js";
import {
  formatL10nWordAsAnnotatedText,
  getUniqueHanCharacters,
  supportsHancharComponents,
  type WordDetailCharacterTab,
} from "../l10n-word-detail-utils.js";
import { AnnotatedTextView } from "./annotated-text.js";
import { useNativeResource } from "./native-resource.js";
import { HancharComponents } from "./hanchar-components.js";
import { Action, s, WordStreakControls } from "./word-detail-controls.js";
import {
  defaultTranslate,
  type L10nWordDetailData,
  type NativeTranslate,
  type NativeWordStreaksData,
  type WordDetailClient,
} from "./word-detail-types.js";
const NativeStrokes = lazy(() =>
  import("./stroke-order-view.js").then((module) => ({
    default: module.StrokeOrderView,
  })),
);

export type L10nWordDetailContentProps = Omit<ViewProps, "children"> & {
  l10nWordDetailData: L10nWordDetailData | null;
  lingopClient: WordDetailClient;
  guiLang?: string;
  focusLang?: string;
  onClose?: () => void;
  showWordStreakControls?: boolean;
  wordStreaksData?: NativeWordStreaksData;
  /** Supply OAT or another app-owned translation function for interface labels. */
  translate?: NativeTranslate;
  speechController?: SpeechController;
  /** Legacy app callback; speechController takes precedence when supplied. */
  onPlayAudio?: (annotation: AnnotatedText) => void | Promise<void>;
  strokeDataProvider?: StrokeDataProvider;
};

/** Reusable native body; may also be placed inside an app-owned screen or sheet. */
export function L10nWordDetailContent({
  l10nWordDetailData,
  lingopClient,
  guiLang = "en",
  focusLang,
  onClose,
  showWordStreakControls = true,
  wordStreaksData,
  translate = defaultTranslate,
  onPlayAudio,
  speechController,
  strokeDataProvider,
  style,
  ...viewProps
}: L10nWordDetailContentProps) {
  const lang =
    l10nWordDetailData?.l10nLang ??
    l10nWordDetailData?.l10nAText?.lang ??
    focusLang;
  const word = l10nWordDetailData?.l10nWord;
  const provided = useMemo(
    () =>
      l10nWordDetailData?.l10nAText
        ? formatL10nWordAsAnnotatedText(
            l10nWordDetailData.l10nAText,
            l10nWordDetailData.l10nATextTokenIdx,
          )
        : null,
    [l10nWordDetailData?.l10nAText, l10nWordDetailData?.l10nATextTokenIdx],
  );
  const load = useMemo(
    () =>
      provided || !word || !lang
        ? null
        : async () => {
            const localization = await lingopClient.fetchLocalization({
              l10n_lang: lang,
              isPublic: true,
              sourceContent: {
                lang,
                text: word,
                ref: { file: "WORDS" },
                owner_id: null,
              },
            });
            if (!localization) throw new Error("No word localization");
            const annotation = await lingopClient.fetchAnnotation({
              localization,
            });
            const detail =
              annotation && formatL10nWordAsAnnotatedText(annotation);
            if (!detail) throw new Error("No word annotation");
            return detail;
          },
    [provided, word, lang, lingopClient],
  );
  const result = useNativeResource(load);
  const detail = provided ?? result.value;
  if (!l10nWordDetailData) return null;
  return (
    <View {...viewProps} style={[s.section, style]}>
      {detail ? (
        <ResolvedDetail
          key={`${detail.annotatedText.lang}:${detail.annotatedText.lang_text}:${l10nWordDetailData.l10nATextTokenIdx ?? 0}`}
          detail={detail}
          data={l10nWordDetailData}
          client={lingopClient}
          guiLang={guiLang}
          translate={translate}
          {...(onClose ? { onClose } : {})}
          {...(onPlayAudio ? { onPlayAudio } : {})}
          {...(speechController ? { speechController } : {})}
          {...(strokeDataProvider ? { strokeDataProvider } : {})}
          {...(showWordStreakControls && wordStreaksData
            ? { wordStreaksData }
            : {})}
        />
      ) : (
        <>
          <Text style={s.title}>{word}</Text>
          {result.status === "LOADING" ? (
            <ActivityIndicator
              accessibilityLabel={translate("Loading word details")}
            />
          ) : (
            <>
              <Text accessibilityRole="alert" style={s.error}>
                {translate("Could not load word details.")}
              </Text>
              {!!load && (
                <Action label={translate("Retry")} onPress={result.retry} />
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
function ResolvedDetail({
  detail,
  data,
  client,
  guiLang,
  translate,
  wordStreaksData,
  onClose,
  onPlayAudio,
  speechController,
  strokeDataProvider,
}: {
  detail: NonNullable<ReturnType<typeof formatL10nWordAsAnnotatedText>>;
  data: L10nWordDetailData;
  client: WordDetailClient;
  guiLang: string;
  translate: NativeTranslate;
  wordStreaksData?: NativeWordStreaksData;
  onClose?: () => void;
  onPlayAudio?: L10nWordDetailContentProps["onPlayAudio"];
  speechController?: SpeechController;
  strokeDataProvider?: StrokeDataProvider;
}) {
  const a = detail.annotatedText;
  const token = a.tokens[0]!;
  const lang = a.lang.toLowerCase();
  const english = guiLang.toLowerCase() === "en";
  const [tab, setTab] = useState<WordDetailCharacterTab>("COMPONENTS");
  const glossLoader = useMemo(
    () => async () => {
      if (!english && token.gloss) {
        const output = await client.fetchAndGenGloss({
          source_lang: "en",
          source_word: token.gloss,
          target_lang: guiLang,
        });
        return output?.targetWord ?? token.gloss;
      }
      const words = await client.getSBWordsForLangDir(a.lang, "en");
      return (
        (
          words.find(({ word }) => word === token.text) ??
          words.find(
            ({ word }) => word.toUpperCase() === token.text.toUpperCase(),
          )
        )?.gloss ?? null
      );
    },
    [client, english, token.gloss, token.text, guiLang, a.lang],
  );
  const gloss = useNativeResource(glossLoader);
  const hanKey = getUniqueHanCharacters(token.text).join("");
  const componentsLoader = useMemo(
    () =>
      !supportsHancharComponents(lang) || !hanKey
        ? null
        : async () => {
            const values = await Promise.all(
              [...hanKey].map((character) =>
                client.getHancharDecomposition(character),
              ),
            );
            return values.filter((value) => value !== null);
          },
    [lang, hanKey, client],
  );
  const components = useNativeResource(componentsLoader);
  const simpleScript = getLang(a.lang)?.g_script === "Traditional Chinese";
  const simpleLoader = useMemo(
    () =>
      !simpleScript ? null : () => traditionalToSimplifiedChinese(token.text),
    [simpleScript, token.text],
  );
  const simplified = useNativeResource(simpleLoader);
  const tabs: WordDetailCharacterTab[] = [
    ...(componentsLoader ? ["COMPONENTS" as const] : []),
    ...(supportsStrokeOrder(lang) ? ["STROKES" as const] : []),
    ...(simpleScript ? ["SIMPLE_SCRIPT" as const] : []),
  ];
  const selectedTab = tabs.includes(tab) ? tab : tabs[0];
  const morphemes = data.wordSubMorphemes?.length
    ? data.wordSubMorphemes
    : detail.wordSubMorphemes;
  const glosses = english
    ? [
        ...new Set(
          [
            token.gloss,
            gloss.value,
            ...getWordExplanationsForWord(lang, token.text),
          ].filter(Boolean),
        ),
      ]
    : [gloss.value ?? token.gloss];
  const glossDirection =
    getLangScript(getLang(guiLang)?.g_script ?? "")?.is_ltr === false
      ? "rtl"
      : "ltr";
  return (
    <View style={s.section}>
      <AnnotatedTextView
        annotatedText={a}
        showGlossEmoji="NEVER"
        showGlossText="NEVER"
        astyle={{ mainTextSize: 32, spellingSize: 16 }}
      />
      {speechController && (
        <SpeechControls
          controller={speechController}
          translate={translate}
          request={{
            text: a.lang_text,
            lang: a.lang,
            contentContext: "PUBLIC_CONTENT",
            ref: { file: "WORDS" },
          }}
        />
      )}
      {!speechController && onPlayAudio && (
        <PlayAudio onPlay={() => onPlayAudio(a)} translate={translate} />
      )}
      {glosses.map((value, index) =>
        value ? (
          <Text
            key={index}
            style={[s.body, { writingDirection: glossDirection }]}
          >
            {value}
          </Text>
        ) : null,
      )}
      {gloss.status === "LOADING" && (
        <ActivityIndicator
          accessibilityLabel={translate("Loading dictionary gloss")}
        />
      )}
      {gloss.status === "FAILED" && (
        <Action
          label={translate("Retry dictionary gloss")}
          onPress={gloss.retry}
        />
      )}
      {morphemes.length > 1 && (
        <View style={s.row}>
          {morphemes.map((morpheme, index) => (
            <View key={index} style={s.section}>
              <Text style={s.title}>{morpheme.morpheme}</Text>
              <Text style={s.body}>{morpheme.gloss}</Text>
            </View>
          ))}
        </View>
      )}
      {!!tabs.length && (
        <>
          <View accessibilityRole="tablist" style={s.row}>
            {tabs.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: value === selectedTab }}
                onPress={() => setTab(value)}
                style={[
                  s.button,
                  value === selectedTab && { backgroundColor: "#c9dfbd" },
                ]}
              >
                <Text style={s.buttonText}>
                  {translate(
                    value === "COMPONENTS"
                      ? "Components"
                      : value === "STROKES"
                        ? "Strokes"
                        : "Simple",
                  )}
                </Text>
              </Pressable>
            ))}
          </View>
          {selectedTab === "COMPONENTS" &&
            (components.status === "LOADING" ? (
              <ActivityIndicator
                accessibilityLabel={translate("Loading character components")}
              />
            ) : components.status === "FAILED" ? (
              <>
                <Text style={s.error}>
                  {translate("Could not load character components.")}
                </Text>
                <Action label={translate("Retry")} onPress={components.retry} />
              </>
            ) : components.value?.length ? (
              <HancharComponents
                decompositions={components.value}
                lang={lang}
                phonetics={token.phoneticToken}
                translate={translate}
              />
            ) : (
              <Text style={s.muted}>
                {translate("No character components available.")}
              </Text>
            ))}
          {selectedTab === "STROKES" && (
            <Suspense
              fallback={
                <ActivityIndicator
                  accessibilityLabel={translate("Loading stroke order")}
                />
              }
            >
              <NativeStrokes
                characters={getStrokeCharacters(token.text, lang)}
                lang={lang}
                translate={translate}
                {...(strokeDataProvider
                  ? { provider: strokeDataProvider }
                  : {})}
              />
            </Suspense>
          )}
          {selectedTab === "SIMPLE_SCRIPT" &&
            (simplified.status === "LOADING" ? (
              <ActivityIndicator
                accessibilityLabel={translate("Loading simplified script")}
              />
            ) : simplified.status === "FAILED" ? (
              <Action
                label={translate("Retry simplified script")}
                onPress={simplified.retry}
              />
            ) : (
              <Text style={s.title}>{simplified.value}</Text>
            ))}
        </>
      )}
      {wordStreaksData && (
        <WordStreakControls
          data={wordStreaksData}
          lang={a.lang}
          word={token.text}
          words={morphemes.map(({ morpheme }) => morpheme)}
          onLearnt={onClose}
          translate={translate}
        />
      )}
    </View>
  );
}
function PlayAudio({
  onPlay,
  translate,
}: {
  onPlay: () => void | Promise<void>;
  translate: NativeTranslate;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.section}>
      <Action
        label={translate("Play audio")}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setFailed(false);
          void Promise.resolve()
            .then(onPlay)
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      />
      {failed && (
        <Text accessibilityRole="alert" style={s.error}>
          {translate("Could not play audio.")}
        </Text>
      )}
    </View>
  );
}
