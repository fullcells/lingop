import { describe, expect, it, vi } from "vitest";

import { annotateBinderMarkdownLines } from "./annotate-markdown-lines.js";

describe("annotateBinderMarkdownLines", () => {
  const binder = { id: 7, lang: "ja", owner_id: "owner-1" };
  const doc = { id: 12 };

  it("annotates text segments with stable binder document coordinates", async () => {
    const annotation = {
      lang: "ja",
      lang_text: "食べる",
      tokens: [{ text: "食べる", isWord: true }],
    };
    const fetchAnnotation = vi.fn(async () => annotation);

    const result = await annotateBinderMarkdownLines({
      lines: [
        [
          { isMd: true, text: "## " },
          { isMd: false, text: "食べる" },
        ],
      ],
      binder,
      doc,
      fetchAnnotation,
    });

    expect(result).toEqual([
      [
        { isMd: true, text: "## " },
        { isMd: false, text: "食べる", atext: annotation },
      ],
    ]);
    expect(fetchAnnotation).toHaveBeenCalledWith({
      localization: {
        text: "食べる",
        l10n_lang: "ja",
        sourceContent: {
          owner_id: "owner-1",
          lang: "ja",
          text: "食べる",
          ref: {
            db: {
              id: 12,
              table: "user_binder_docs",
              column: "text",
              binder_id: 7,
              line_idx: 0,
              seg_idx: 1,
            },
          },
        },
      },
    });
  });

  it("preserves markdown and blank text segments without annotation calls", async () => {
    const fetchAnnotation = vi.fn();
    const lines = [[
      { isMd: true, text: "- " },
      { isMd: false, text: "   " },
    ]];

    await expect(
      annotateBinderMarkdownLines({ lines, binder, doc, fetchAnnotation }),
    ).resolves.toEqual(lines);
    expect(fetchAnnotation).not.toHaveBeenCalled();
  });

  it("allows a caller to override the localization language", async () => {
    const fetchAnnotation = vi.fn(async () => null);

    await annotateBinderMarkdownLines({
      lines: [[{ isMd: false, text: "食べる" }]],
      binder,
      doc,
      fetchAnnotation,
      l10nLang: "en",
    });

    expect(fetchAnnotation.mock.calls[0]?.[0].localization.l10n_lang).toBe("en");
  });

  it("builds translation-target refs for localized document segments", async () => {
    const fetchAnnotation = vi.fn(async () => null);
    const onAnnotationComplete = vi.fn();

    await annotateBinderMarkdownLines({
      lines: [[{ isMd: false, text: "eat" }]],
      binder,
      doc,
      fetchAnnotation,
      localization: {
        text: "eat",
        l10n_lang: "en",
        sourceContent: {
          owner_id: "owner-1",
          lang: "ja",
          text: "食べる",
          ref: null,
        },
      },
      l10nLang: "en",
      translationId: 99,
      onAnnotationComplete,
    });

    expect(fetchAnnotation.mock.calls[0]?.[0].localization.sourceContent.ref).toEqual({
      db: {
        id: 99,
        table: "translations",
        column: "target_text",
        line_idx: 0,
        seg_idx: 0,
      },
    });
    expect(onAnnotationComplete).toHaveBeenCalledOnce();
  });
});
