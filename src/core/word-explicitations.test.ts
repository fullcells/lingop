import { describe, expect, it, vi } from "vitest";
import {
  getOneWayWordExplicitations,
  loadWordExplicitationsRows,
  type SupabaseWordExplicitationsClient,
  type SupabaseWordExplicitationsQuery,
  type SupabaseWordExplicitationsQueryResult,
  type WordExplicitationsRow,
} from "./word-explicitations.js";

const rows: WordExplicitationsRow[] = [
  {
    id: 1,
    a_lang: "en",
    b_lang: "yue",
    a_word_sense: "good",
    a2b_explicitations: ["好"],
    b2a_explicitations: ["good"],
    b_word_sense: "好",
  },
  {
    id: 2,
    a_lang: "en",
    b_lang: "ja",
    a_word_sense: "eat",
    a2b_explicitations: ["食べる"],
    b2a_explicitations: ["eat"],
    b_word_sense: "食べる",
  },
];

function makeQuery(
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
    then: (onfulfilled, onrejected) =>
      Promise.resolve(resultForRange(rangeFrom, rangeTo)).then(onfulfilled, onrejected),
  };

  return query;
}

function makeSupabaseClient(data: WordExplicitationsRow[]): {
  supabaseClient: SupabaseWordExplicitationsClient;
  select: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn(
    (
      _columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): SupabaseWordExplicitationsQuery => {
      if (options?.head) {
        return makeQuery(() => ({ data: null, error: null, count: data.length }));
      }

      return makeQuery((from, to) => ({
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

describe("word explicitations", () => {
  it("loads rows from Supabase and caches them by injected client", async () => {
    const { supabaseClient, select } = makeSupabaseClient(rows);

    await expect(loadWordExplicitationsRows({ supabaseClient })).resolves.toEqual(rows);
    await expect(loadWordExplicitationsRows({ supabaseClient })).resolves.toEqual(rows);

    expect(select).toHaveBeenCalledTimes(2);
  });

  it("returns one-way explicitations when the target language is B", async () => {
    const { supabaseClient } = makeSupabaseClient(rows);

    await expect(
      getOneWayWordExplicitations(
        { source_lang: "en", source_word: "GOOD", target_lang: "yue" },
        { supabaseClient },
      ),
    ).resolves.toEqual({
      input: { source_lang: "en", source_word: "GOOD", target_lang: "yue" },
      rows: [{ id: 1, word_sense: "好", explicitations: ["good"] }],
      targetLangIsA: false,
    });
  });

  it("returns one-way explicitations when the target language is A", async () => {
    const { supabaseClient } = makeSupabaseClient(rows);

    await expect(
      getOneWayWordExplicitations(
        {
          source_lang: "yue",
          source_word: "好",
          target_lang: "en",
        },
        { supabaseClient },
      ),
    ).resolves.toEqual({
      input: { source_lang: "yue", source_word: "好", target_lang: "en" },
      rows: [{ id: 1, word_sense: "good", explicitations: ["好"] }],
      targetLangIsA: true,
    });
  });
});
