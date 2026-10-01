import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { AnnotatedText } from "../../core/annotation/types.js";
import type { WordDetailClient } from "./word-detail-types.js";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const c = (name: string) => (props: any) =>
    createElement(name, props, props.children);
  return {
    AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
    View: c("view"),
    Text: c("text"),
    Pressable: c("pressable"),
    ScrollView: c("scroll"),
    Modal: (props: any) =>
      props.visible ? createElement("modal", props, props.children) : null,
    ActivityIndicator: c("activity"),
    StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  };
});
vi.mock("react-native-svg", async () => {
  const { createElement } = await import("react");
  const c = (name: string) => (props: any) =>
    createElement(name, props, props.children);
  return { Svg: c("svg"), G: c("g"), Path: c("path") };
});
import {
  WordChipsArrayView,
  L10nWordDetailContent,
  L10nWordDetailModal,
  useL10nWordDetailModal,
} from "./index.js";
import { StrokeCharacterDiagram } from "./stroke-order-view.js";
import { WORD_STREAKS_MASTERY_THRESHOLD } from "../../core/word-lists.js";
let tree: ReactTestRenderer | undefined;
const a = (word: string, lang = "ja"): AnnotatedText => ({
  lang,
  lang_text: word,
  tokens: [{ text: word, isWord: 1, gloss: `${word} meaning` }],
  containsGloss: true,
  containsPhonetics: false,
  ref: null,
  owner_id: null,
});
function client(): WordDetailClient {
  return {
    fetchLocalization: vi.fn(async (input) => ({
      lang: input.l10n_lang,
      text: input.sourceContent.text,
      ref: { file: "WORDS" },
      owner_id: null,
    })),
    fetchAnnotation: vi.fn(async ({ localization }) =>
      a(localization.text, localization.lang),
    ),
    getSBWordsForLangDir: vi.fn(async () => []),
    getHancharDecomposition: vi.fn(async () => null),
    fetchAndGenGloss: vi.fn(async () => ({
      targetWord: "translated",
      is_human_verified: true,
    })),
    generateEmojis: vi.fn(async () => ({})),
  } as WordDetailClient;
}
const strings = () =>
  tree!.root
    .findAllByType("text")
    .map((n) => n.props.children)
    .filter((v) => typeof v === "string");
const button = (label: string) =>
  tree!.root
    .findAllByType("pressable")
    .find((n) => n.props.accessibilityLabel === label)!;
const press = async (label: string) => {
  await act(async () => {
    button(label).props.onPress({ nativeEvent: {} });
  });
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const error = console.error;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated"))
      error(...args);
  });
});
afterEach(async () => {
  if (tree) await act(() => tree!.unmount());
  tree = undefined;
  vi.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

it("renders supplied annotations with shared explanations without re-annotating", async () => {
  const c = client();
  await act(() => {
    tree = create(
      <L10nWordDetailContent
        lingopClient={c}
        l10nWordDetailData={{ l10nWord: "に", l10nAText: a("に") }}
      />,
    );
  });
  expect(c.fetchLocalization).not.toHaveBeenCalled();
  expect(c.fetchAnnotation).not.toHaveBeenCalled();
  expect(strings().join(" ")).toContain("Marks a destination");
  expect(strings()).toContain("に meaning");
});
it("resolves raw chips through public WORDS and dismisses on Android Back", async () => {
  const c = client();
  await act(() => {
    tree = create(
      <WordChipsArrayView words={["猫"]} lang="ja" lingopClient={c} />,
    );
  });
  await press("猫");
  expect(c.fetchLocalization).toHaveBeenCalledExactlyOnceWith({
    l10n_lang: "ja",
    isPublic: true,
    sourceContent: {
      lang: "ja",
      text: "猫",
      ref: { file: "WORDS" },
      owner_id: null,
    },
  });
  expect(c.fetchAnnotation).toHaveBeenCalledOnce();
  expect(strings()).toContain("猫 meaning");
  await act(() => tree!.root.findByType("modal").props.onRequestClose());
  expect(tree!.root.findAllByType("modal")).toHaveLength(0);
});
it("restores canonical case, keeps duplicate chips, and delegates taps without opening details", async () => {
  const c = client();
  const onTap = vi.fn();
  vi.mocked(c.getSBWordsForLangDir).mockResolvedValue([
    { word: "London" },
    { word: "Apple" },
    { word: "apple" },
  ] as any);
  await act(() => {
    tree = create(
      <WordChipsArrayView
        words={["LONDON", "APPLE", "APPLE"]}
        lang="en"
        lingopClient={c}
        onL10nWordTap={onTap}
      />,
    );
  });
  expect(strings()).toEqual(["London", "apple", "apple"]);
  await press("London");
  expect(onTap).toHaveBeenCalledWith("London", { nativeEvent: {} });
  expect(c.fetchLocalization).not.toHaveBeenCalled();
  expect(tree!.root.findAllByType("modal")).toHaveLength(0);
});
it("retains script-insensitive text, sets RTL and labels an empty array", async () => {
  const c = client();
  await act(() => {
    tree = create(
      <WordChipsArrayView
        words={[]}
        lang="ar"
        lingopClient={c}
        emptyLabel="No words yet"
      />,
    );
  });
  expect(strings()).toEqual(["No words yet"]);
  expect(tree!.root.findByType("view").props.style[1].direction).toBe("rtl");
  expect(c.getSBWordsForLangDir).not.toHaveBeenCalled();
});
it("does not show a stale word or stale response when a pending selection changes", async () => {
  const c = client();
  const first = deferred<AnnotatedText>();
  const second = deferred<AnnotatedText>();
  vi.mocked(c.fetchAnnotation)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const view = (word: string) => (
    <L10nWordDetailContent
      lingopClient={c}
      l10nWordDetailData={{ l10nWord: word, l10nLang: "en" }}
    />
  );
  await act(() => {
    tree = create(view("first"));
  });
  await act(() => tree!.update(view("second")));
  await act(() => second.resolve(a("second", "en")));
  await act(() => first.resolve(a("first", "en")));
  expect(strings()).toContain("second meaning");
  expect(strings()).not.toContain("first meaning");
});
it("shows failed resolution, retries, and translates non-English glosses via the client", async () => {
  const c = client();
  vi.mocked(c.fetchAnnotation).mockRejectedValueOnce(new Error("offline"));
  await act(() => {
    tree = create(
      <L10nWordDetailContent
        lingopClient={c}
        guiLang="es"
        l10nWordDetailData={{ l10nWord: "cat", l10nLang: "en" }}
      />,
    );
  });
  expect(strings()).toContain("Could not load word details.");
  await press("Retry");
  expect(strings()).toContain("translated");
  expect(c.fetchAndGenGloss).toHaveBeenCalledWith({
    source_lang: "en",
    source_word: "cat meaning",
    target_lang: "es",
  });
});
it("updates all supplied morphemes, waits for success, and reports failed learning changes", async () => {
  const c = client();
  const save = deferred<void>();
  const close = vi.fn();
  const streaks = {
    userWordStreaks: { en: {} },
    ensureUserWordStreaksForLang: vi.fn(),
    setUserWordStreaksToValue: vi.fn(() => save.promise),
    deleteUserWordStreaks: vi.fn(async () => {}),
  };
  await act(() => {
    tree = create(
      <L10nWordDetailContent
        lingopClient={c}
        onClose={close}
        wordStreaksData={streaks}
        l10nWordDetailData={{
          l10nWord: "walked",
          l10nAText: a("walked", "en"),
          wordSubMorphemes: [
            { morpheme: "walk", gloss: "walk" },
            { morpheme: "ed", gloss: "past" },
          ],
        }}
      />,
    );
  });
  await press("Learnt");
  expect(streaks.setUserWordStreaksToValue).toHaveBeenCalledWith(
    "en",
    ["walk", "ed"],
    WORD_STREAKS_MASTERY_THRESHOLD,
  );
  expect(close).not.toHaveBeenCalled();
  expect(button("Learnt").props.disabled).toBe(true);
  await act(async () => {
    save.resolve();
  });
  expect(close).toHaveBeenCalledOnce();
  streaks.deleteUserWordStreaks.mockRejectedValueOnce(new Error("offline"));
  await press("Reset");
  expect(strings()).toContain("Could not save word streaks. Please try again.");
});
it("feeds annotated-text tap context into a native detail modal without fetching a different word", async () => {
  const c = client();
  const annotation = a("cat", "en");
  let handle: ReturnType<typeof useL10nWordDetailModal>;
  function Harness() {
    handle = useL10nWordDetailModal({ lingopClient: c });
    return handle.ModalComponent;
  }
  await act(() => {
    tree = create(<Harness />);
  });
  await act(() =>
    handle.onTokenPress({
      annotatedText: annotation,
      token: annotation.tokens[0]!,
      index: 0,
      morphemes: [{ morpheme: "cat", gloss: "cat" }],
    }),
  );
  expect(strings()).toContain("cat meaning");
  expect(c.fetchAnnotation).not.toHaveBeenCalled();
  await press("Close word details");
  expect(handle!.open).toBe(false);
});
it("does not fetch hidden modal details", async () => {
  const c = client();
  await act(() => {
    tree = create(
      <L10nWordDetailModal
        visible={false}
        onClose={() => {}}
        lingopClient={c}
        l10nWordDetailData={{ l10nWord: "cat", l10nLang: "en" }}
      />,
    );
  });
  expect(c.fetchLocalization).not.toHaveBeenCalled();
});
it("renders cumulative stroke paths and preserves source transforms", async () => {
  await act(() => {
    tree = create(
      <StrokeCharacterDiagram
        data={{
          character: "二",
          source: "MAKEMEAHANZI",
          viewBox: "0 0 1024 1024",
          pathKind: "OUTLINE",
          transform: "scale(1 -1)",
          strokes: ["M1 1L5 1", "M1 2L5 2"],
        }}
      />,
    );
  });
  expect(tree!.root.findAllByType("svg")).toHaveLength(2);
  expect(tree!.root.findAllByType("path")).toHaveLength(3);
  expect(tree!.root.findAllByType("g")[0]!.props.transform).toBe("scale(1 -1)");
  expect(tree!.root.findAllByType("path")[2]!.props.fill).toBe("#dc493a");
});

it("native sentence and details share speech controls; word API refs are WORDS, not the sentence ref", async () => {
  const { createSpeechController } = await import("../../speech/controller.js");
  const { AnnotatedTextView } = await import("./annotated-text.js");
  const { SpeechControls } = await import("./speech-controls.js");
  const controller = createSpeechController({
    device: {
      getVoices: async () => [
        {
          service: "DEVICE",
          voice_id: "ja",
          voice_lang: "ja-JP",
          name: "Japanese",
        },
      ],
      speak: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    },
  });
  const annotation = { ...a("猫"), ref: { file: "sentence" } };
  await act(() => {
    tree = create(
      <ViewForTest>
        <AnnotatedTextView
          annotatedText={annotation}
          speechController={controller}
          speechContext={{
            contentContext: "PUBLIC_CONTENT",
            ref: annotation.ref,
          }}
        />
        <L10nWordDetailContent
          lingopClient={client()}
          speechController={controller}
          l10nWordDetailData={{
            l10nAText: annotation,
            l10nWord: "猫",
            l10nATextTokenIdx: 0,
          }}
        />
      </ViewForTest>,
    );
  });
  const controls = tree!.root.findAllByType(SpeechControls);
  expect(controls).toHaveLength(2);
  expect(controls[0]!.props.request.ref).toEqual({ file: "sentence" });
  expect(controls[1]!.props.request).toEqual({
    text: "猫",
    lang: "ja",
    contentContext: "PUBLIC_CONTENT",
    ref: { file: "WORDS" },
  });
  expect(controls[1]!.props.controller).toBe(controller);
});
function ViewForTest({ children }: { children: import("react").ReactNode }) {
  return <>{children}</>;
}
