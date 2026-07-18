import { describe, expect, it, vi } from "vitest";

import {
  deleteWordStreaks,
  getSBUserWordStreaksForLang,
  setWordStreaksByDelta,
  setWordStreaksToMin1,
  setWordStreaksToValue,
  upsertSBUserWordStreaksForLang,
  type SBUserWordStreaks,
  type SupabaseUserWordStreaksClient,
} from "./user-word-streaks.js";
import type { SupabaseQueryLike } from "./supabase.js";

type SupabaseUserWordStreaksQuery = SupabaseQueryLike;

type QueryResult = {
  data: unknown[] | null;
  error: unknown | null;
};

function makeQuery({
  result,
  eqCalls,
}: {
  result: QueryResult;
  eqCalls: Array<[string, unknown]>;
}): SupabaseUserWordStreaksQuery {
  const query: SupabaseUserWordStreaksQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return query;
    }),
    select: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  return query;
}

function makeSupabaseClient({
  rows,
  userID = "user-1",
}: {
  rows: SBUserWordStreaks[];
  userID?: string;
}): {
  supabaseClient: SupabaseUserWordStreaksClient;
  select: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eqCalls: Array<[string, unknown]>;
  upsertRows: Record<string, unknown>[];
} {
  const eqCalls: Array<[string, unknown]> = [];
  const upsertRows: Record<string, unknown>[] = [];
  const select = vi.fn(() =>
    makeQuery({
      result: { data: rows, error: null },
      eqCalls,
    }),
  );
  const upsert = vi.fn((row: Record<string, unknown>) => {
    upsertRows.push(row);
    return makeQuery({
      result: { data: [row], error: null },
      eqCalls,
    });
  });

  return {
    supabaseClient: {
      from: vi.fn(() => ({
        select,
        upsert,
      })),
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: userID } },
        })),
      },
    },
    select,
    upsert,
    eqCalls,
    upsertRows,
  };
}

describe("user word streak helpers", () => {
  it("normalizes words to uppercase when setting values", () => {
    expect(setWordStreaksToValue({ HELLO: 2 }, ["hello", "World"], 1)).toEqual({
      HELLO: 1,
      WORLD: 1,
    });
  });

  it("clamps deltas between 0 and 100", () => {
    expect(
      setWordStreaksByDelta(
        { LOW: 1, HIGH: 99 },
        [
          { word: "low", streakDelta: -10 },
          { word: "high", streakDelta: 10 },
          { word: "new", streakDelta: 3 },
        ],
      ),
    ).toEqual({
      LOW: 0,
      HIGH: 100,
      NEW: 3,
    });
  });

  it("deletes words case-insensitively", () => {
    expect(deleteWordStreaks({ Hello: 2, WORLD: 3 }, ["hello"])).toEqual({
      WORLD: 3,
    });
  });

  it("sets only new words to a minimum streak of 1", () => {
    expect(setWordStreaksToMin1({ HELLO: 2 }, ["hello", "world"])).toEqual({
      wordStreaks: { HELLO: 2, WORLD: 1 },
      newWords: ["WORLD"],
    });
  });
});

describe("user word streak Supabase helpers", () => {
  it("loads user word streaks by authenticated user id and lang", async () => {
    const row: SBUserWordStreaks = {
      user_id: "user-1",
      lang: "es",
      word_streaks: { HOLA: 4 },
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { supabaseClient, eqCalls } = makeSupabaseClient({ rows: [row] });

    await expect(
      getSBUserWordStreaksForLang({ supabaseClient, lang: "es" }),
    ).resolves.toEqual(row);
    expect(eqCalls).toEqual([
      ["lang", "es"],
      ["user_id", "user-1"],
    ]);
  });

  it("upserts user word streaks", async () => {
    const { supabaseClient, upsertRows } = makeSupabaseClient({ rows: [] });

    await expect(
      upsertSBUserWordStreaksForLang({
        supabaseClient,
        lang: "es",
        wordStreaks: { HOLA: 4 },
      }),
    ).resolves.toMatchObject({
      user_id: "user-1",
      lang: "es",
      word_streaks: { HOLA: 4 },
    });
    expect(upsertRows[0]).toMatchObject({
      user_id: "user-1",
      lang: "es",
      word_streaks: { HOLA: 4 },
    });
  });

});
