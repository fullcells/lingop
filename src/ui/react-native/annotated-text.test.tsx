import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnnotatedText, AnnotatedToken } from "../../core/annotation/types.js";

// Exercise the component tree and callbacks without loading RN's native bridge
// in Node. Actual Yoga layout/font metrics still need a device or simulator.
const native = vi.hoisted(() => ({ nodes: [] as { type: string; props: Record<string, any> }[] }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const component = (type: string) => (props: Record<string, any>) => {
    native.nodes.push({ type, props });
    return createElement(`rn-${type}`, {
      "data-label": props.accessibilityLabel,
    }, props.children);
  };
  return {
    View: component("view"), Text: component("text"),
    Pressable: component("pressable"), ActivityIndicator: component("activity"),
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

import { AnnotatedTextView, type AnnotatedTextViewProps } from "./index.js";
import { prepareAnnotatedText } from "./annotated-text-model.js";

function annotation(tokens: AnnotatedToken[], lang = "ja"): AnnotatedText {
  return { lang, lang_text: tokens.map(({ text }) => text).join(""), tokens,
    containsGloss: tokens.some((token) => !!token.gloss),
    containsPhonetics: tokens.some((token) => !!token.phoneticToken?.length),
    ref: null, owner_id: null };
}
const sample = annotation([
  { text: "猫", isWord: 1, gloss: "cat", phoneticToken: [["猫", "ねこ"]] },
  { text: "。", isWord: 0 },
]);
function render(props: Partial<AnnotatedTextViewProps> = {}) {
  return renderToStaticMarkup(createElement(AnnotatedTextView, {
    annotatedText: sample, ...props,
  }));
}
const texts = () => native.nodes.filter(({ type }) => type === "text")
  .map(({ props }) => props.children as ReactNode);
const flatStyle = (style: any): Record<string, any> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatStyle)) : style ?? {};

beforeEach(() => { native.nodes.length = 0; });

describe("native AnnotatedTextView", () => {
  it("renders furigana, surface text, gloss and punctuation as native text", () => {
    render();
    expect(texts()).toEqual(["ねこ", "猫", "cat", "\u00a0", "。", "\u00a0"]);
    expect(native.nodes.some(({ type }) => type === "pressable")).toBe(false);
  });

  it("renders null as an accessible busy indicator and forwards native View props", () => {
    render({ annotatedText: null, testID: "loading", loadingLabel: "Preparing words" });
    expect(native.nodes[0]?.props).toMatchObject({ testID: "loading", accessible: true,
      accessibilityLabel: "Preparing words", accessibilityState: { busy: true } });
    expect(native.nodes.some(({ type }) => type === "activity")).toBe(true);
    expect(texts()).toEqual([]);
  });

  it("hides disabled rows and supports spelling-only punctuation", () => {
    render({ showMainText: false, showGlossText: "NEVER" });
    expect(texts()).toEqual(["ねこ", "。"]);
    native.nodes.length = 0;
    render({ showMainText: false, showSpelling: "NEVER", showGlossText: "NEVER" });
    expect(texts()).toEqual([]);
  });

  it("retains surface text when there are no phonetics, including incomplete metadata", () => {
    render({ annotatedText: annotation([{ text: "hello", isWord: 1 }], "en"),
      showMainText: false });
    expect(texts()).toEqual(["hello"]);
    native.nodes.length = 0;
    render({ annotatedText: { ...sample, containsPhonetics: false } });
    expect(texts()).toContain("ねこ");
  });

  it("keeps punctuation in spelling-only hint mode", () => {
    render({ showMainText: false, showSpelling: "ON_HINT", showGlossText: "NEVER", showGlossEmoji: "NEVER",
      isTokenHinted: () => true });
    expect(texts()).toEqual(["ねこ", "。"]);
  });

  it("reserves the spelling slot without duplicating a missing reading", () => {
    render({ annotatedText: annotation([...sample.tokens, { text: "犬", isWord: 1 }]) });
    expect(texts().slice(-3)).toEqual(["\u00a0", "犬", "\u00a0"]);
  });

  it("suppresses duplicate Japanese kana but keeps it in spelling-only mode", () => {
    const kana = annotation([{ text: "かな", isWord: 1, phoneticToken: [["かな", "かな"]] }]);
    render({ annotatedText: kana });
    expect(texts()).toEqual(["\u00a0", "かな"]);
    native.nodes.length = 0;
    render({ annotatedText: kana, showMainText: false });
    expect(texts()).toEqual(["かな"]);
  });

  it("shows ON_HINT rows only for app-selected words and does not resolve hidden emoji", () => {
    const getTokenEmoji = vi.fn(() => "🐈");
    const props = { showSpelling: "ON_HINT", showGlossText: "ON_HINT",
      showGlossEmoji: "ON_HINT", getTokenEmoji } as const;
    render(props);
    expect(texts()).not.toContain("ねこ");
    expect(texts()).not.toContain("cat");
    expect(getTokenEmoji).not.toHaveBeenCalled();
    native.nodes.length = 0;
    render({ ...props, isTokenHinted: ({ index }) => index === 0 });
    expect(texts()).toEqual(["ねこ", "猫", "🐈", "cat", "\u00a0", "。", "\u00a0", "\u00a0"]);
    expect(getTokenEmoji).toHaveBeenCalledTimes(1);
  });

  it.each(["bottom", "top", "left", "right"] as const)(
    "keeps missing and hidden emoji/gloss slots aligned with gloss at %s", (glossPlacement) => {
      render({ annotatedText: annotation([
        { text: "猫", isWord: 1, gloss: "cat" },
        { text: "は", isWord: 1, gloss: ":" },
        { text: "犬", isWord: 1 },
      ]), showGlossEmoji: "ALWAYS", showSpelling: "NEVER",
        astyle: { glossPlacement, glossTextAboveEmoji: true },
        getTokenEmoji: ({ index }) => index === 0 ? "🐈" : null });
      const labels = native.nodes.filter(({ type }) => type === "text")
        .filter(({ props }) => flatStyle(props.style).fontSize === 12);
      // Each token has two slots, even when neither annotation is available.
      expect(labels.map(({ props }) => props.children)).toEqual(["🐈", "cat", ":", ":", "\u00a0", "\u00a0"]);
      expect(native.nodes.filter(({ type, props }) => type === "view" &&
        flatStyle(props.style).flexDirection === "column-reverse")).toHaveLength(3);
    },
  );

  it("keeps an unhinted word's text gloss below the hinted word's emoji row", () => {
    render({ annotatedText: annotation([
      { text: "猫", isWord: 1, gloss: "cat" },
      { text: "は", isWord: 1, gloss: ":" },
    ]), showGlossEmoji: "ON_HINT", isTokenHinted: ({ index }) => index === 0,
      getTokenEmoji: () => "🐈" });
    expect(texts()).toEqual(["猫", "🐈", "cat", "は", "\u00a0", ":"]);
  });

  it("provides word callbacks with stable indices and leaves punctuation non-interactive", () => {
    const onTokenPress = vi.fn();
    const onTokenLongPress = vi.fn();
    render({ onTokenPress, onTokenLongPress, tokenAccessibilityHint: "Open word details" });
    const buttons = native.nodes.filter(({ type }) => type === "pressable");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props).toMatchObject({ accessibilityRole: "button",
      accessibilityLabel: "猫, cat", accessibilityHint: "Open word details" });
    buttons[0]!.props.onPress();
    buttons[0]!.props.onLongPress();
    const context = { annotatedText: sample, token: sample.tokens[0], index: 0,
      morphemes: [{ morpheme: "猫", gloss: "cat" }] };
    expect(onTokenPress).toHaveBeenCalledWith(context);
    expect(onTokenLongPress).toHaveBeenCalledWith(context);
  });

  it("uses native styling and font scaling, and reserves top gloss slots for punctuation", () => {
    render({ astyle: { mainTextSize: 24, glossPlacement: "top", spellingOnBottom: true },
      mainTextStyle: { fontFamily: "AppFont" }, maxFontSizeMultiplier: 2 });
    expect(texts()).toEqual(["cat", "ねこ", "猫", "\u00a0", "\u00a0", "。"]);
    const main = native.nodes.find(({ type, props }) => type === "text" && props.children === "猫");
    expect(flatStyle(main?.props.style)).toMatchObject({ fontSize: 24, fontFamily: "AppFont" });
    expect(main?.props).toMatchObject({ allowFontScaling: true, maxFontSizeMultiplier: 2 });
  });

  it("uses language direction independently of the application and allows an override", () => {
    const arabic = annotation([{ text: "كتاب", isWord: 1 }], "ar");
    render({ annotatedText: arabic });
    expect(flatStyle(native.nodes[0]?.props.style).direction).toBe("rtl");
    native.nodes.length = 0;
    render({ annotatedText: arabic, textDirection: "ltr" });
    expect(flatStyle(native.nodes[0]?.props.style).direction).toBe("ltr");
  });

  it("can remove the TO prefix and strips main-text liaison markers", () => {
    render({ annotatedText: annotation([{ text: "가‿다", isWord: 1, gloss: "TO GO" }], "ko"),
      showTokenGlossPrefix_TO__: false });
    expect(texts()).toEqual(["가다", "GO"]);
  });
});

describe("native annotation preparation", () => {
  it("groups punctuation without losing source indices across CRLF and blank lines", () => {
    const model = prepareAnnotatedText(annotation([
      { text: "「", isWord: 0 }, { text: "猫", isWord: 1 }, { text: "」\r\n\n", isWord: 0 },
      { text: "犬", isWord: 1 }, { text: "。", isWord: 0 },
    ]));
    expect(model.lines.map((groups) => groups.map((group) => group.map(({ index }) => index))))
      .toEqual([[[0, 1, 2]], [], [[3, 4]]]);
    expect(model.lines[0]?.[0]?.[2]?.token.text).toBe("」");
  });

  it("linearizes root/pattern morphology and retains the original morphemes", () => {
    const data = annotation([
      { text: "√ktb", isWord: 1, gloss: "write" },
      { text: "•i•e•", isWord: 1, gloss: "past" },
    ], "mt");
    const model = prepareAnnotatedText({ ...data, lang_text: "kiteb", containsPhonetics: false });
    expect(model.tokens[0]?.text).toBe("kiteb");
    expect(model.morphemesPerLinearToken[0]).toHaveLength(2);
  });

  it("strips disambiguators without mutating the input", () => {
    const data = annotation([{ text: "bank (river)", isWord: 1, gloss: "bank (river)" }], "en");
    const before = structuredClone(data);
    expect(prepareAnnotatedText(data).tokens[0]?.text).toBe("bank");
    expect(data).toEqual(before);
  });
});
