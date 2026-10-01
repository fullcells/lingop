import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AnnotatedText } from "../../core/annotation/types.js";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const component = (name: string) => (props: any) => createElement(name, props, props.children);
  return {
    View: component("view"), Text: component("text"), Pressable: component("pressable"),
    ActivityIndicator: component("activity"),
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: { position: "absolute" } },
  };
});
import { AnnotatedTextView, type AnnotatedTextViewProps } from "./annotated-text.js";

let tree: ReactTestRenderer;
const annotation = (glosses: string[]): AnnotatedText => ({
  lang: "en", lang_text: glosses.join(" "),
  tokens: glosses.map((gloss) => ({ text: gloss, isWord: 1, gloss })),
  containsGloss: true, containsPhonetics: false, ref: null, owner_id: null,
});
const sentence = annotation(["cat", "cat", "unmapped"]);
const element = (props: Partial<AnnotatedTextViewProps> = {}) => createElement(AnnotatedTextView, {
  annotatedText: sentence, showGlossEmoji: "ALWAYS", ...props,
});
function deferred() {
  let resolve!: (result: Record<string, string | null>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Record<string, string | null>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const visibleTexts = () => tree.root.findAllByType("text").filter((node) =>
  !JSON.stringify(node.props.style).includes('"opacity":0'),
).map((node) => node.props.children);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const error = console.error;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) error(...args);
  });
});
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
  vi.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

it("deduplicates visible glosses, shows pending slots, then uses emoji and missing-result fallback", async () => {
  const request = deferred();
  const client = { generateEmojis: vi.fn(() => request.promise) };
  const loading = vi.fn();
  await act(() => { tree = create(element({ lingopClient: client, onEmojiLoadStateChange: loading })); });
  expect(client.generateEmojis).toHaveBeenCalledExactlyOnceWith(["cat", "unmapped"]);
  expect(tree.root.findAllByType("activity")).toHaveLength(3);
  expect(loading).toHaveBeenLastCalledWith(true);
  await act(() => request.resolve({ cat: "🐈", unmapped: null }));
  expect(tree.root.findAllByType("activity")).toHaveLength(0);
  expect(visibleTexts()).toEqual(["cat", "🐈", "cat", "cat", "🐈", "cat", "unmapped", "unmapped", "unmapped"]);
  expect(loading).toHaveBeenLastCalledWith(false);
  await act(() => tree.update(element({ lingopClient: client, onEmojiLoadStateChange: loading })));
  expect(client.generateEmojis).toHaveBeenCalledTimes(1);
});

it("ignores a late response after switching annotations or clients", async () => {
  const first = deferred(); const second = deferred(); const third = deferred();
  const client = { generateEmojis: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) };
  await act(() => { tree = create(element({ lingopClient: client })); });
  const dog = annotation(["dog"]);
  await act(() => tree.update(element({ lingopClient: client, annotatedText: dog })));
  await act(() => second.resolve({ dog: "🐕" }));
  await act(() => first.resolve({ cat: "🐈" }));
  expect(visibleTexts()).toEqual(["dog", "🐕", "dog"]);
  const otherClient = { generateEmojis: vi.fn(() => third.promise) };
  await act(() => tree.update(element({ lingopClient: otherClient, annotatedText: dog })));
  expect(tree.root.findAllByType("activity")).toHaveLength(1);
  expect(visibleTexts()).not.toContain("🐕");
  await act(() => third.resolve({ dog: "🐶" }));
  expect(visibleTexts()).toEqual(["dog", "🐶", "dog"]);
});

it("resolves only hinted words, skips disabled emoji and supports a pre-resolved override", async () => {
  const client = { generateEmojis: vi.fn(async () => ({ cat: "🐈" })) };
  await act(() => { tree = create(element({ lingopClient: client, showGlossEmoji: "ON_HINT" })); });
  expect(client.generateEmojis).not.toHaveBeenCalled();
  await act(() => tree.update(element({ lingopClient: client, showGlossEmoji: "ON_HINT", isTokenHinted: ({ index }) => index === 0 })));
  expect(client.generateEmojis).toHaveBeenCalledExactlyOnceWith(["cat"]);
  await act(() => tree.update(element({ lingopClient: client, showGlossEmoji: "NEVER" })));
  expect(visibleTexts()).not.toContain("🐈");
  await act(() => tree.update(element({ lingopClient: client, getTokenEmoji: () => "⭐" })));
  expect(visibleTexts()).toContain("⭐");
  expect(client.generateEmojis).toHaveBeenCalledTimes(1);
});

it("settles errors to text fallback and stops reporting loading", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const request = deferred(); const loading = vi.fn();
  await act(() => { tree = create(element({ lingopClient: { generateEmojis: () => request.promise }, onEmojiLoadStateChange: loading })); });
  await act(() => request.reject(new Error("offline")));
  expect(warning).toHaveBeenCalledOnce();
  expect(tree.root.findAllByType("activity")).toHaveLength(0);
  expect(loading).toHaveBeenLastCalledWith(false);
  expect(visibleTexts()).toEqual(["cat", "cat", "cat", "cat", "cat", "cat", "unmapped", "unmapped", "unmapped"]);
});
