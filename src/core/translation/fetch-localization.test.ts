import { describe, expect, it, vi } from "vitest";

import {
  BE_API_PRODUCTION_URL,
  BE_API_STAGING_URL,
} from "../backend-api.js";
import utilsFetchLocalization, { type TranslationCacheRef } from "./fetch-localization.js";
import type { SupabaseTranslationClient, TranslationRow } from "./types.js";
import type { SourceContent } from "../misc.js";

function makeDbSourceContent(id = 1): SourceContent {
  return {
    owner_id: "owner-1",
    lang: "en",
    text: `source-${id}`,
    ref: {
      db: {
        table: "posts",
        column: "body",
        id,
      },
    },
  };
}

function makeFileSourceContent(text = "hello"): SourceContent {
  return {
    owner_id: "public-owner",
    lang: "en",
    text,
    ref: { file: "lingodex" },
  };
}

function makeTranslationRow(id: number, overrides: Partial<TranslationRow> = {}): TranslationRow {
  return {
    id,
    source_lang: "en",
    source_text: `source-${id}`,
    target_lang: "th",
    target_text: `target-${id}`,
    owner_id: "owner-1",
    created_at: `2026-01-0${id}T00:00:00.000Z`,
    translator: "test",
    ref: {
      db: {
        table: "posts",
        column: "body",
        id,
      },
    },
    ...overrides,
  };
}

function makeCache(rows: TranslationRow[] = []): TranslationCacheRef {
  return { current: rows };
}

function makeSupabaseClient(
  data: unknown[],
  accessToken: string | null = "token-1",
): SupabaseTranslationClient {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (
      resolve: (value: { data: unknown[]; error: null }) => unknown,
      reject?: (reason?: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => query),
    })),
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: accessToken ? { access_token: accessToken } : null,
        },
      })),
    },
  };
}

describe("utilsFetchLocalization", () => {
  it("returns source text when target language matches source language", async () => {
    const sourceContent = makeDbSourceContent();

    await expect(
      utilsFetchLocalization({
        l10n_lang: "EN",
        sourceContent,
        translationsCache: makeCache(),
      }),
    ).resolves.toEqual({
      text: sourceContent.text,
      l10n_lang: "EN",
      sourceContent,
    });
  });

  it("returns newest matching translation from cache and keeps cache sorted", async () => {
    const sourceContent = makeDbSourceContent(1);
    const older = makeTranslationRow(1, {
      target_text: "older",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const newer = makeTranslationRow(2, {
      source_text: "source-1",
      target_text: "newer",
      created_at: "2026-01-02T00:00:00.000Z",
      ref: older.ref,
    });
    const cache = makeCache([older, newer]);

    await expect(
      utilsFetchLocalization({
        l10n_lang: "th",
        sourceContent,
        translationsCache: cache,
      }),
    ).resolves.toMatchObject({
      text: "newer",
      translationRow: newer,
    });
    expect(cache.current.map((row) => row.id)).toEqual([2, 1]);
  });

  it("fetches public translations with caller-provided fetch", async () => {
    const sourceContent = makeFileSourceContent("hello");
    const publicTranslation = makeTranslationRow(10, {
      source_text: "hello",
      target_text: "sawasdee",
      owner_id: "public-owner",
      ref: { file: "lingodex" },
    });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => publicTranslation,
    }));

    await expect(
      utilsFetchLocalization({
        l10n_lang: "th",
        sourceContent,
        translationsCache: makeCache(),
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      text: "sawasdee",
      translationRow: publicTranslation,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://camplingo.com/api/lingoprocessor/translate-get-public",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ref: sourceContent.ref,
          source_lang: "en",
          target_lang: "th",
          file_text: "hello",
        }),
      }),
    );
  });

  it("uses Supabase lookup for db refs and updates cache", async () => {
    const sourceContent = makeDbSourceContent(3);
    const translation = makeTranslationRow(3);
    const cache = makeCache();

    await expect(
      utilsFetchLocalization({
        l10n_lang: "th",
        sourceContent,
        translationsCache: cache,
        supabaseClient: makeSupabaseClient([translation]),
      }),
    ).resolves.toMatchObject({
      text: "target-3",
      translationRow: translation,
    });
    expect(cache.current).toEqual([translation]);
  });

  it("generates owner translations through the backend when cache and Supabase miss", async () => {
    const sourceContent = makeDbSourceContent(4);
    const generatedTranslation = makeTranslationRow(4, {
      target_text: "generated",
    });
    const cache = makeCache();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => [generatedTranslation],
    }));

    await expect(
      utilsFetchLocalization({
        l10n_lang: "th",
        sourceContent,
        translationsCache: cache,
        supabaseClient: makeSupabaseClient([]),
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      text: "generated",
      translationRow: generatedTranslation,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/translate`,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
        },
        body: JSON.stringify({
          source_lang: "en",
          target_lang: "th",
          source_texts: ["source-4"],
          refs: [sourceContent.ref],
          options: [],
        }),
      }),
    );
    expect(cache.current).toEqual([generatedTranslation]);
  });

  it("uses staging backend for generated owner translations when requested", async () => {
    const sourceContent = makeDbSourceContent(5);
    const generatedTranslation = makeTranslationRow(5);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => [generatedTranslation],
    }));

    await expect(
      utilsFetchLocalization({
        l10n_lang: "th",
        sourceContent,
        translationsCache: makeCache(),
        supabaseClient: makeSupabaseClient([]),
        fetchImpl,
        useStagingBackend: true,
      }),
    ).resolves.toMatchObject({
      translationRow: generatedTranslation,
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BE_API_STAGING_URL}/api/translate`);
  });
});
