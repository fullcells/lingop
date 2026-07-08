import { afterEach, describe, expect, it, vi } from "vitest";

import callSBSelectTranslationsByRef, {
  __sbSelectTranslationsByRef,
} from "./select-translations-by-ref.js";
import type {
  SupabaseTranslationClient,
  TranslationRow,
} from "./types.js";

function makeTranslationRow(id: number): TranslationRow {
  return {
    id,
    source_lang: "en",
    source_text: `source-${id}`,
    target_lang: "th",
    target_text: `target-${id}`,
    owner_id: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    translator: "test",
    ref: {
      db: {
        table: "posts",
        column: "body",
        id,
      },
    },
  };
}

function makeSupabaseClient(data: unknown[]): {
  supabaseClient: SupabaseTranslationClient;
  calls: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
  };
} {
  const calls = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };

  const query = {
    eq: vi.fn((column: string, value: unknown) => {
      calls.eq(column, value);
      return query;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      calls.in(column, values);
      return query;
    }),
    then: (
      resolve: (value: { data: unknown[]; error: null }) => unknown,
      reject?: (reason?: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };

  const supabaseClient: SupabaseTranslationClient = {
    from: vi.fn(() => ({
      select: vi.fn((columns: string) => {
        calls.select(columns);
        return query;
      }),
    })),
  };

  return { supabaseClient, calls };
}

describe("callSBSelectTranslationsByRef", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects translations by owner, language pair, and db ref", async () => {
    const { supabaseClient, calls } = makeSupabaseClient([makeTranslationRow(1)]);

    await expect(
      __sbSelectTranslationsByRef({
        supabaseClient,
        owner_id: "owner-1",
        source_lang: "en",
        target_lang: "th",
        db_table: "posts",
        db_column: "body",
        dbIds: [1],
      }),
    ).resolves.toEqual({ data: [makeTranslationRow(1)], error: null });

    expect(calls.select).toHaveBeenCalledWith(
      "id, source_lang, source_text, target_lang, target_text, owner_id, created_at, translator, ref",
    );
    expect(calls.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(calls.eq).toHaveBeenCalledWith("source_lang", "en");
    expect(calls.eq).toHaveBeenCalledWith("target_lang", "th");
    expect(calls.eq).toHaveBeenCalledWith("ref->db->>table", "posts");
    expect(calls.eq).toHaveBeenCalledWith("ref->db->>column", "body");
    expect(calls.in).toHaveBeenCalledWith("ref->db->>id", [1]);
  });

  it("batches requests with matching owner, languages, table, and column", async () => {
    vi.useFakeTimers();

    const { supabaseClient, calls } = makeSupabaseClient([
      makeTranslationRow(1),
      makeTranslationRow(2),
      makeTranslationRow(3),
    ]);

    const firstRequest = callSBSelectTranslationsByRef({
      supabaseClient,
      owner_id: "owner-1",
      source_lang: "en",
      target_lang: "th",
      db_table: "posts",
      db_column: "body",
      dbIds: [1, 2],
    });
    const secondRequest = callSBSelectTranslationsByRef({
      supabaseClient,
      owner_id: "owner-1",
      source_lang: "en",
      target_lang: "th",
      db_table: "posts",
      db_column: "body",
      dbIds: [3],
    });

    expect(calls.in).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { data: [makeTranslationRow(1), makeTranslationRow(2)], error: null },
      { data: [makeTranslationRow(3)], error: null },
    ]);
    expect(calls.in).toHaveBeenCalledTimes(1);
    expect(calls.in).toHaveBeenCalledWith("ref->db->>id", [1, 2, 3]);
  });

  it("dedupes matching in-flight requests", async () => {
    vi.useFakeTimers();

    const { supabaseClient, calls } = makeSupabaseClient([makeTranslationRow(1)]);

    const firstRequest = callSBSelectTranslationsByRef({
      supabaseClient,
      owner_id: "owner-1",
      source_lang: "en",
      target_lang: "th",
      db_table: "posts",
      db_column: "body",
      dbIds: [1],
    });
    const secondRequest = callSBSelectTranslationsByRef({
      supabaseClient,
      owner_id: "owner-1",
      source_lang: "en",
      target_lang: "th",
      db_table: "posts",
      db_column: "body",
      dbIds: [1],
    });

    expect(firstRequest).toBe(secondRequest);

    await vi.advanceTimersByTimeAsync(50);
    await expect(firstRequest).resolves.toEqual({
      data: [makeTranslationRow(1)],
      error: null,
    });
    expect(calls.in).toHaveBeenCalledTimes(1);
  });

  it("drops rows that do not match the known translation shape", async () => {
    const { supabaseClient } = makeSupabaseClient([
      makeTranslationRow(1),
      {
        source_lang: "en",
        source_text: "bad",
        target_lang: "th",
        target_text: "bad",
        owner_id: 123,
        ref: null,
      },
    ]);

    await expect(
      __sbSelectTranslationsByRef({
        supabaseClient,
        owner_id: "owner-1",
        source_lang: "en",
        target_lang: "th",
        db_table: "posts",
        db_column: "body",
        dbIds: [1],
      }),
    ).resolves.toEqual({ data: [makeTranslationRow(1)], error: null });
  });
});
