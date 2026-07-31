import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addWORDExposureNow,
  createWordExposureRow,
  deleteWORDExposureRow,
  getWORDExposureRow,
  type SBUserWordExposure,
  type SupabaseUserWordExposuresClient,
} from "./user-word-exposures.js";

type Result = {
  data: unknown[] | null;
  error: unknown | null;
};

function makeQuery(result: Result, eqCalls: Array<[string, unknown]>) {
  const query = {
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return query;
    }),
    ilike: vi.fn((column: string, value: string) => {
      eqCalls.push([column, value]);
      return query;
    }),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    select: vi.fn(() => query),
    then: (
      resolve: (result: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function exposureRow(
  overrides: Partial<SBUserWordExposure> = {},
): SBUserWordExposure {
  return {
    id: 1,
    user_id: "user-1",
    word_lang: "es",
    word: "HOLA",
    user_gloss: "hello",
    user_gloss_lang: "en",
    exposures: 0,
    recent_exposures: [],
    created_at: "2026-07-31T00:00:00.000Z",
    position: null,
    ...overrides,
  };
}

function makeClient({
  selectResults = [],
  insertResult,
  updateResult,
  deleteResult,
}: {
  selectResults?: Result[];
  insertResult?: Result;
  updateResult?: Result;
  deleteResult?: Result;
} = {}) {
  const eqCalls: Array<[string, unknown]> = [];
  const insertedRows: Record<string, unknown>[] = [];
  const updatedRows: Record<string, unknown>[] = [];
  let selectIndex = 0;

  const table = {
    select: vi.fn(() =>
      makeQuery(
        selectResults[selectIndex++] ?? { data: [], error: null },
        eqCalls,
      ),
    ),
    insert: vi.fn((row: Record<string, unknown>) => {
      insertedRows.push(row);
      return makeQuery(insertResult ?? { data: [], error: null }, eqCalls);
    }),
    update: vi.fn((row: Record<string, unknown>) => {
      updatedRows.push(row);
      return makeQuery(updateResult ?? { data: [], error: null }, eqCalls);
    }),
    delete: vi.fn(() =>
      makeQuery(deleteResult ?? { data: [], error: null }, eqCalls),
    ),
  };

  const supabaseClient: SupabaseUserWordExposuresClient = {
    from: vi.fn(() => table),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
      })),
    },
  };

  return { supabaseClient, table, eqCalls, insertedRows, updatedRows };
}

describe("user word exposure Supabase helpers", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates a zero-exposure row while preserving the word's casing", async () => {
    const created = exposureRow({
      word: "Obama",
      position: "Biography, opening paragraph",
    });
    const { supabaseClient, insertedRows, eqCalls } = makeClient({
      selectResults: [{ data: [], error: null }],
      insertResult: { data: [created], error: null },
    });

    await expect(
      createWordExposureRow({
        supabaseClient,
        word_lang: "en",
        word: "Obama",
        user_gloss_lang: "en",
        user_gloss: "Barack Obama",
        position: "Biography, opening paragraph",
      }),
    ).resolves.toEqual(created);
    expect(insertedRows).toEqual([
      {
        user_id: "user-1",
        word_lang: "en",
        word: "Obama",
        user_gloss_lang: "en",
        user_gloss: "Barack Obama",
        exposures: 0,
        recent_exposures: [],
        position: "Biography, opening paragraph",
      },
    ]);
    expect(eqCalls).toEqual([
      ["user_id", "user-1"],
      ["user_gloss_lang", "en"],
      ["word_lang", "en"],
      ["word", "Obama"],
    ]);
  });

  it("does not create a case-insensitive duplicate", async () => {
    const existing = exposureRow({ word: "Obama" });
    const { supabaseClient, table } = makeClient({
      selectResults: [{ data: [{ id: existing.id }], error: null }],
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      createWordExposureRow({
        supabaseClient,
        word_lang: "es",
        word: "OBAMA",
        user_gloss_lang: "en",
        user_gloss: "Barack Obama",
      }),
    ).resolves.toBeNull();
    expect(table.insert).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("adds the newest exposure first, increments the count, and keeps 10", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:00.000Z"));
    const oldExposures = Array.from(
      { length: 10 },
      (_, index) => `2026-07-${String(30 - index).padStart(2, "0")}T00:00:00.000Z`,
    );
    const current = exposureRow({
      exposures: 10,
      recent_exposures: oldExposures,
      position: "Chapter 1, paragraph 2",
    });
    const updated = exposureRow({
      exposures: 11,
      recent_exposures: [
        "2026-07-31T12:00:00.000Z",
        ...oldExposures.slice(0, 9),
      ],
      position: "Chapter 1, paragraph 2",
    });
    const { supabaseClient, updatedRows } = makeClient({
      selectResults: [{ data: [current], error: null }],
      updateResult: { data: [updated], error: null },
    });

    await expect(
      addWORDExposureNow({
        supabaseClient,
        word_lang: "es",
        word: "hola",
        user_gloss_lang: "en",
      }),
    ).resolves.toEqual(updated);
    expect(updatedRows).toEqual([
      {
        exposures: 11,
        recent_exposures: [
          "2026-07-31T12:00:00.000Z",
          ...oldExposures.slice(0, 9),
        ],
      },
    ]);
  });

  it("deletes case-insensitively using the complete unique key", async () => {
    const { supabaseClient, eqCalls } = makeClient({
      deleteResult: { data: [{ id: 1 }], error: null },
    });

    await expect(
      deleteWORDExposureRow({
        supabaseClient,
        word_lang: "es",
        word: "hola",
        user_gloss_lang: "en",
      }),
    ).resolves.toBe(true);
    expect(eqCalls).toEqual([
      ["user_id", "user-1"],
      ["user_gloss_lang", "en"],
      ["word_lang", "es"],
      ["word", "hola"],
    ]);
  });

  it("gets a case-insensitive word match or returns null", async () => {
    const row = exposureRow({ word: "Obama" });
    const found = makeClient({
      selectResults: [{ data: [row], error: null }],
    });

    await expect(
      getWORDExposureRow({
        supabaseClient: found.supabaseClient,
        word_lang: "es",
        word: "OBAMA",
      }),
    ).resolves.toEqual(row);
    expect(found.eqCalls).toEqual([
      ["user_id", "user-1"],
      ["word_lang", "es"],
      ["word", "OBAMA"],
    ]);

    const missing = makeClient({
      selectResults: [{ data: [], error: null }],
    });
    await expect(
      getWORDExposureRow({
        supabaseClient: missing.supabaseClient,
        word_lang: "es",
        word: "missing",
      }),
    ).resolves.toBeNull();
  });
});
