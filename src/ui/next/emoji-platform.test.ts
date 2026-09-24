import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { guessPlatformUsesNotoColorEmoji } from "./emoji-platform.js";
import { AnnotatedTextView } from "./annotated-text.js";
import type { AnnotatedText } from "../../core/annotation/types.js";

describe("default color emoji platform estimate", () => {
  it.each([
    ["macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/140", false],
    ["MacIntel", "Mozilla/5.0 (Macintosh; Intel Mac OS X) Mobile Safari", false],
    ["iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS) CriOS/140", false],
    ["Windows", "Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/140", false],
    ["Win32", "Mozilla/5.0 Firefox/140", false],
    ["Android", "Mozilla/5.0 (Linux; Android 10; K) Chrome/140", true],
    ["Linux armv8l", "Mozilla/5.0 (Linux; Android 14) Chrome/140", true],
    ["Chrome OS", "Mozilla/5.0 (X11; CrOS x86_64) Chrome/140", true],
    ["Linux x86_64", "Mozilla/5.0 (X11; Linux x86_64) Firefox/140", true],
    ["", "Mozilla/5.0 (X11; CrOS aarch64) Chrome/140", true],
    ["", "", false],
    ["Unknown", "SomeBrowser", false],
  ])("%s / %s => %s", (platform, ua, expected) => {
    expect(guessPlatformUsesNotoColorEmoji(platform, ua)).toBe(expected);
  });
});

const annotation: AnnotatedText = {
  lang: "en", lang_text: "hello", containsGloss: true, containsPhonetics: false,
  tokens: [{ text: "hello", isWord: 1, gloss: "hello" }], ref: null, owner_id: null,
};

describe("ATV color font override and server rendering", () => {
  it.each([true, false, undefined])("respects override %s without a browser", value => {
    const html = renderToStaticMarkup(createElement(AnnotatedTextView, {
      annotatedText: annotation,
      ...(value === undefined ? {} : { colorEmojiFontIsNoto: value }),
      showGlossEmoji: "ALWAYS",
    }));
    expect(html).toContain(`data-color-emoji-is-noto="${value ?? false}"`);
    expect(html).not.toContain('font-family:');
  });
});
