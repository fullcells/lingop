import { describe, expect, it } from "vitest";

import {
  addBinderFocusLang,
  buildBinderDocLocalizationInput,
  buildBinderDocSegmentLocalization,
  buildLocalizedBinderDocSegmentLocalization,
  isBinderDocL10nCacheStale,
  normalizeBinderFocusLangs,
} from "./localization.js";

describe("binder localization helpers", () => {
  const binder = {
    id: 7,
    name: "Kanji",
    lang: "ja",
    owner_id: "owner-1",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const doc = {
    id: 12,
    binder_id: 7,
    name: "Doc",
    text: "食べる",
    updated_at: "2026-01-02T00:00:00.000Z",
  };

  it("normalizes focus languages", () => {
    expect(normalizeBinderFocusLangs([" JA ", "", "en"])).toEqual(["ja", "en"]);
    expect(addBinderFocusLang(["ja"], " EN ")).toEqual(["ja", "en"]);
  });

  it("builds document localization input with a binder doc ref", () => {
    expect(buildBinderDocLocalizationInput(binder, doc, " EN ")).toEqual({
      l10n_lang: "en",
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
          },
        },
      },
    });
  });

  it("builds source and localized segment refs", () => {
    const sourceSegment = buildBinderDocSegmentLocalization({
      binder,
      doc,
      text: "食べる",
      lineIdx: 2,
      segIdx: 1,
    });

    expect(sourceSegment.sourceContent.ref).toEqual({
      db: {
        id: 12,
        table: "user_binder_docs",
        column: "text",
        binder_id: 7,
        line_idx: 2,
        seg_idx: 1,
      },
    });

    expect(
      buildLocalizedBinderDocSegmentLocalization({
        localization: sourceSegment,
        text: "eat",
        l10nLang: "en",
        lineIdx: 0,
        segIdx: 0,
        translationId: 99,
        binderId: 7,
        docId: 12,
      }).sourceContent.ref,
    ).toEqual({
      db: {
        id: 99,
        table: "translations",
        column: "target_text",
        line_idx: 0,
        seg_idx: 0,
      },
    });
  });

  it("detects stale l10n caches from source or translation timestamps", () => {
    expect(isBinderDocL10nCacheStale(doc, null, null)).toBe(true);
    expect(
      isBinderDocL10nCacheStale(doc, null, {
        updated_at: "2026-01-01T23:59:00.000Z",
      }),
    ).toBe(true);
    expect(
      isBinderDocL10nCacheStale(
        doc,
        { translationCreatedAt: "2026-01-03T00:00:00.000Z" },
        { updated_at: "2026-01-02T12:00:00.000Z" },
      ),
    ).toBe(true);
    expect(
      isBinderDocL10nCacheStale(
        doc,
        { translationCreatedAt: "2026-01-03T00:00:00.000Z" },
        { updated_at: "2026-01-03T00:01:00.000Z" },
      ),
    ).toBe(false);
  });
});

