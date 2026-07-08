import { describe, expect, it } from "vitest";

import {
  convertLineToMarkdownSegments,
  convertTextToMarkdownLines,
  uniqueWordsFromAnnotatedMarkdownLines,
} from "./markdown-segments.js";
import type { AnnotatedMarkdownSegment } from "./types.js";

describe("binder markdown segments", () => {
  it("splits common markdown prefixes from content", () => {
    expect(convertLineToMarkdownSegments("## Heading")).toEqual([
      { isMd: true, text: "## " },
      { isMd: false, text: "Heading" },
    ]);
    expect(convertLineToMarkdownSegments("- item")).toEqual([
      { isMd: true, text: "- " },
      { isMd: false, text: "item" },
    ]);
  });

  it("keeps table delimiters as markdown segments", () => {
    expect(convertTextToMarkdownLines("a | b\n--- | ---")).toEqual([
      [
        { isMd: false, text: "a" },
        { isMd: true, text: "|" },
        { isMd: false, text: "b" },
      ],
      [{ isMd: true, text: "--- | ---" }],
    ]);
  });

  it("extracts sorted unique words from annotated text segments", () => {
    const lines: AnnotatedMarkdownSegment[][] = [
      [
        { isMd: true, text: "- " },
        {
          isMd: false,
          text: "hello world",
          atext: {
            lang: "en",
            lang_text: "hello world",
            tokens: [
              { text: "hello", isWord: true },
              { text: "world", isWord: true },
              { text: ".", isWord: false },
            ],
          },
        },
      ],
      [
        {
          isMd: false,
          text: "Hello",
          atext: {
            lang: "en",
            lang_text: "Hello",
            tokens: [{ text: "Hello", isWord: true }],
          },
        },
      ],
    ];

    expect(uniqueWordsFromAnnotatedMarkdownLines(lines)).toEqual(["HELLO", "WORLD"]);
  });
});

