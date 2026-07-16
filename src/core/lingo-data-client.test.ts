import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLingoDataClient,
  type SupabaseLingoDataClient,
} from "./lingo-data-client.js";
import type { Localization } from "./misc.js";
import type { AnnotatedText } from "./annotation/types.js";
import type { TranslationRow } from "./translation/types.js";
import type {
  SupabaseWordExplicitationsQuery,
  SupabaseWordExplicitationsQueryResult,
  WordExplicitationsRow,
} from "./word-explicitations.js";
import { clearWordExplicitationsCache } from "./word-explicitations.js";

function makeLocalization(): Localization {
  return {
    text: "hello",
    l10n_lang: "en",
    sourceContent: {
      owner_id: "owner-1",
      lang: "en",
      text: "hello",
      ref: { db: { table: "custom_sources", column: "text", id: 1 } },
    },
  };
}

function makeAnnotatedText(text: string): AnnotatedText {
  return {
    lang: "en",
    lang_text: text,
    tokens: [{ text, isWord: 1 }],
    containsGloss: false,
    containsPhonetics: false,
    ref: { db: { table: "custom_sources", column: "text", id: 1 } },
    owner_id: "user-1",
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
    ref: { db: { table: "custom_sources", column: "text", id } },
    ...overrides,
  };
}

function makeWordExplicitationsQuery(
  resultForRange: (from: number | null, to: number | null) => SupabaseWordExplicitationsQueryResult,
): SupabaseWordExplicitationsQuery {
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const query: SupabaseWordExplicitationsQuery = {
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return query;
    }),
    then: (resolve, reject) =>
      Promise.resolve(resultForRange(rangeFrom, rangeTo)).then(resolve, reject),
  };

  return query;
}

function makeWordExplicitationsSupabaseClient(
  data: WordExplicitationsRow[],
): { supabaseClient: SupabaseLingoDataClient; select: ReturnType<typeof vi.fn> } {
  const select = vi.fn(
    (
      _columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): SupabaseWordExplicitationsQuery => {
      if (options?.head) {
        return makeWordExplicitationsQuery(() => ({
          data: null,
          error: null,
          count: data.length,
        }));
      }

      return makeWordExplicitationsQuery((from, to) => ({
        data:
          from === null || to === null
            ? data
            : data.slice(from, Math.min(to + 1, data.length)),
        error: null,
      }));
    },
  );

  return {
    supabaseClient: {
      from: vi.fn(() => ({ select })),
    },
    select,
  };
}

describe("createLingoDataClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearWordExplicitationsCache();
  });

  it("infers the owner id from the caller-provided Supabase client", async () => {
    vi.useFakeTimers();

    const eqCalls: Array<[string, unknown]> = [];
    const deleteQuery = {
      eq: vi.fn((column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return deleteQuery;
      }),
      is: vi.fn(() => deleteQuery),
      select: vi.fn(async () => ({ data: [], error: null })),
    };
    const supabaseClient: SupabaseLingoDataClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => {
          const query = {
            eq: vi.fn(() => query),
            then: (
              resolve: (value: { data: []; error: null }) => unknown,
            ) => Promise.resolve(resolve({ data: [], error: null })),
          };
          return query;
        }),
        update: vi.fn(() => {
          const query = {
            eq: vi.fn(() => query),
            select: vi.fn(async () => ({ data: [], error: null })),
          };
          return query;
        }),
        delete: vi.fn(() => deleteQuery),
      })),
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: "token-1" } },
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
        })),
      },
    };
    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { texts: string[] };

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: body.texts.map(makeAnnotatedText),
        }),
      };
    });
    vi.stubGlobal("fetch", fetchImpl);

    const client = createLingoDataClient({
      supabaseClient,
    });
    const request = client.reGenOwnerAnnotation({
      localization: makeLocalization(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await expect(request).resolves.toEqual(makeAnnotatedText("hello"));
    expect(eqCalls).toContainEqual(["owner_id", "user-1"]);
    expect(supabaseClient.auth?.getUser).toHaveBeenCalled();
  });

  it("loads word explicitations through the shared module cache", async () => {
    const { supabaseClient, select } = makeWordExplicitationsSupabaseClient([
      {
        id: 1,
        a_lang: "en",
        b_lang: "yue",
        a_word_sense: "good",
        a2b_explicitations: ["好"],
        b2a_explicitations: ["good"],
        b_word_sense: "好",
      },
    ]);
    const client = createLingoDataClient({ supabaseClient });

    await expect(client.loadWordExplicitationsRows()).resolves.toHaveLength(1);
    await expect(
      client.getOneWayWordExplicitations({
        source_lang: "en",
        source_word: "GOOD",
        target_lang: "yue",
      }),
    ).resolves.toEqual({
      input: { source_lang: "en", source_word: "GOOD", target_lang: "yue" },
      rows: [{ id: 1, word_sense: "好", explicitations: ["good"] }],
      targetLangIsA: false,
    });

    expect(select).toHaveBeenCalledTimes(2);
  });

  it("regenerates translated segment annotations with the derived localization ref", async () => {
    vi.useFakeTimers();

    const expectedRef = {
      db: {
        table: "translations",
        column: "target_text",
        id: 123,
        line_idx: 4,
        seg_idx: 1,
      },
    };
    const requestBodies: unknown[] = [];
    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      requestBodies.push(JSON.parse(init.body));

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: [
            {
              ...makeAnnotatedText("สวัสดี"),
              lang: "th",
              ref: expectedRef,
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchImpl);

    const client = createLingoDataClient({
      supabaseClient: {
        from: vi.fn(() => ({
          select: vi.fn(() => {
            const query = {
              eq: vi.fn(() => query),
              then: (
                resolve: (value: { data: []; error: null }) => unknown,
              ) => Promise.resolve(resolve({ data: [], error: null })),
            };
            return query;
          }),
          update: vi.fn(),
          delete: vi.fn(),
        })),
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: { access_token: "token-1" } },
          })),
        },
      },
    });
    const request = client.reGenOwnerAnnotation({
      localization: {
        text: "สวัสดี",
        l10n_lang: "th",
        translationRow: makeTranslationRow(123),
        sourceContent: {
          owner_id: "owner-1",
          lang: "en",
          text: "hello",
          ref: {
            db: {
              table: "custom_sources",
              column: "text",
              id: 1,
              line_idx: 4,
              seg_idx: 1,
            },
          },
        },
      },
      skipDeletionOfExisting: true,
    });

    await vi.advanceTimersByTimeAsync(50);
    await expect(request).resolves.toEqual({
      ...makeAnnotatedText("สวัสดี"),
      lang: "th",
      ref: expectedRef,
    });
    expect(requestBodies).toContainEqual({
      lang: "th",
      texts: ["สวัสดี"],
      ref: expectedRef,
    });
  });

  it("updates translation cache rows by id and sorts newest first", () => {
    const client = createLingoDataClient();
    const older = makeTranslationRow(1, {
      created_at: "2026-01-01T00:00:00.000Z",
      target_text: "old",
    });
    const newer = makeTranslationRow(2, {
      created_at: "2026-01-02T00:00:00.000Z",
      target_text: "new",
    });
    const replacement = makeTranslationRow(1, {
      created_at: "2026-01-03T00:00:00.000Z",
      target_text: "updated",
    });

    client.updateTranslationsCaches([older, newer]);
    client.updateTranslationsCaches([replacement]);

    expect(client.translationsCache.current).toEqual([replacement, newer]);
  });

  it("tracks translation cache dates by source content", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T04:05:06.000Z"));

    const client = createLingoDataClient();
    const sourceContent = makeLocalization().sourceContent;

    expect(client.getT9nCacheDateBySC(sourceContent)).toBeNull();

    client._updateT9nCacheDatesBySCs([sourceContent]);

    expect(client.getT9nCacheDateBySC(sourceContent)).toBe(
      "2026-02-03T04:05:06.000Z",
    );
  });

  it("retranslates by translation id and refreshes the cached row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T05:06:07.000Z"));

    const original = makeTranslationRow(1, {
      target_text: "before",
      created_at: "2026-01-01T00:00:00.000Z",
      translator: "OLD_MODEL",
    });
    const updated = makeTranslationRow(1, {
      target_text: "after",
      created_at: "2026-03-04T05:06:07.000Z",
      translator: "NEW_MODEL",
    });
    const fetchImpl = vi.fn(async (input: string, init: { body: string }) => {
      expect(input.toString()).toMatch(/\/api\/translate-create-limited-anon$/);
      expect(JSON.parse(init.body)).toEqual({
        source_lang: "en",
        target_lang: "th",
        source_text: "source-1",
      });

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          target_text: "after",
          translator: "NEW_MODEL",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchImpl);
    const updateValues: Record<string, unknown>[] = [];

    const client = createLingoDataClient({
      supabaseClient: {
        from: vi.fn(() => ({
          select: vi.fn(() => {
            const query = {
              eq: vi.fn(() => query),
              then: (
                resolve: (value: { data: []; error: null }) => unknown,
              ) => Promise.resolve(resolve({ data: [], error: null })),
            };
            return query;
          }),
          update: vi.fn((values: Record<string, unknown>) => {
            updateValues.push(values);
            const query = {
              eq: vi.fn(() => query),
              select: vi.fn(async () => ({ data: [updated], error: null })),
            };
            return query;
          }),
          delete: vi.fn(),
        })),
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: { access_token: "token-1" } },
          })),
        },
      },
    });
    client.updateTranslationsCaches([original]);

    await expect(client.retranslate({ id: 1 })).resolves.toEqual(updated);
    expect(updateValues).toEqual([
      {
        target_text: "after",
        created_at: "2026-03-04T05:06:07.000Z",
        translator: "NEW_MODEL",
      },
    ]);
    expect(client.translationsCache.current[0]).toEqual(updated);
    expect(
      client.getT9nCacheDateBySC({
        owner_id: updated.owner_id,
        lang: updated.source_lang,
        text: updated.source_text,
        ref: updated.ref,
      }),
    ).toBe(
      "2026-03-04T05:06:07.000Z",
    );
  });

  it("updates a translation with a human edit and marks the translator as USER", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T06:07:08.000Z"));

    const original = makeTranslationRow(1, {
      target_text: "before",
      created_at: "2026-01-01T00:00:00.000Z",
      translator: "MODEL_A",
    });
    const backendRow = makeTranslationRow(1, {
      target_text: "edited by human",
      created_at: "2026-04-05T06:07:08.000Z",
      translator: "MODEL_A",
    });
    const updateValues: Record<string, unknown>[] = [];

    const client = createLingoDataClient({
      supabaseClient: {
        from: vi.fn(() => ({
          select: vi.fn(() => {
            const query = {
              eq: vi.fn(() => query),
              then: (
                resolve: (value: { data: []; error: null }) => unknown,
              ) => Promise.resolve(resolve({ data: [], error: null })),
            };
            return query;
          }),
          update: vi.fn((values: Record<string, unknown>) => {
            updateValues.push(values);
            const query = {
              eq: vi.fn(() => query),
              select: vi.fn(async () => ({
                data: [{ ...backendRow, translator: "USER" }],
                error: null,
              })),
            };
            return query;
          }),
          delete: vi.fn(),
        })),
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: { access_token: "token-1" } },
          })),
        },
      },
    });
    client.updateTranslationsCaches([original]);

    await expect(
      client.updateTranslationWithHumanEdit({
        id: 1,
        targetText: "edited by human",
      }),
    ).resolves.toEqual({
      ...backendRow,
      translator: "USER",
    });
    expect(updateValues).toEqual([
      {
        target_text: "edited by human",
        created_at: "2026-04-05T06:07:08.000Z",
        translator: "USER",
      },
    ]);
    expect(client.translationsCache.current[0]).toEqual({
      ...backendRow,
      translator: "USER",
    });
    expect(
      client.getT9nCacheDateBySC({
        owner_id: backendRow.owner_id,
        lang: backendRow.source_lang,
        text: backendRow.source_text,
        ref: backendRow.ref,
      }),
    ).toBe(
      "2026-04-05T06:07:08.000Z",
    );
  });

  it("fetches localization through the owned translation cache", async () => {
    const sourceContent = {
      owner_id: "owner-1",
      lang: "en",
      text: "source-1",
      ref: { db: { table: "custom_sources", column: "text", id: 1 } },
    } as const;
    const translation = makeTranslationRow(1, {
      target_text: "translated from cache",
    });
    const client = createLingoDataClient();
    client.updateTranslationsCaches([translation]);

    await expect(
      client.fetchLocalization({
        l10n_lang: "th",
        sourceContent,
      }),
    ).resolves.toEqual({
      text: "translated from cache",
      l10n_lang: "th",
      sourceContent,
      translationRow: translation,
    });
  });

  it("invalidates cached localization promises after translation edits", async () => {
    const sourceContent = {
      owner_id: "owner-1",
      lang: "en",
      text: "source-invalidation",
      ref: { db: { table: "custom_sources", column: "text", id: 99 } },
    } as const;
    const original = makeTranslationRow(99, {
      source_text: "source-invalidation",
      target_text: "before edit",
      translator: "MODEL_A",
    });
    const updated = makeTranslationRow(99, {
      source_text: "source-invalidation",
      target_text: "after edit",
      created_at: "2026-05-01T00:00:00.000Z",
      translator: "MODEL_B",
    });
    const fetchImpl = vi.fn(async (input: string, init: { body: string }) => {
      if (input.toString().endsWith("/api/translate-create-limited-anon")) {
        expect(JSON.parse(init.body)).toEqual({
          source_lang: "en",
          target_lang: "th",
          source_text: "source-invalidation",
        });
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            target_text: "after edit",
            translator: "MODEL_B",
          }),
        };
      }

      throw new Error(`Unexpected fetch call: ${input.toString()}`);
    });
    vi.stubGlobal("fetch", fetchImpl);

    const client = createLingoDataClient({
      supabaseClient: {
        from: vi.fn(() => ({
          select: vi.fn(() => {
            const query = {
              eq: vi.fn(() => query),
              then: (
                resolve: (value: { data: []; error: null }) => unknown,
              ) => Promise.resolve(resolve({ data: [], error: null })),
            };
            return query;
          }),
          update: vi.fn(() => {
            const query = {
              eq: vi.fn(() => query),
              select: vi.fn(async () => ({ data: [updated], error: null })),
            };
            return query;
          }),
          delete: vi.fn(),
        })),
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: { access_token: "token-1" } },
          })),
        },
      },
    });
    client.updateTranslationsCaches([original]);

    await expect(
      client.fetchLocalization({
        l10n_lang: "th",
        sourceContent,
      }),
    ).resolves.toEqual({
      text: "before edit",
      l10n_lang: "th",
      sourceContent,
      translationRow: original,
    });

    await expect(client.retranslate({ id: 99 })).resolves.toEqual(updated);

    await expect(
      client.fetchLocalization({
        l10n_lang: "th",
        sourceContent,
      }),
    ).resolves.toEqual({
      text: "after edit",
      l10n_lang: "th",
      sourceContent,
      translationRow: updated,
    });
  });
});
