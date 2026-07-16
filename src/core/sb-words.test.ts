import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSBWordsCache,
  fetchAndGenGloss,
  getSBWordsForLangDir,
  isNotCoreWord,
  type SBWordRow2,
  type SupabaseSBWordsClient,
  type SupabaseSBWordsQuery,
  type SupabaseSBWordsQueryResult,
} from "./sb-words.js";
import type { OneWayWordExplicitations } from "./word-explicitations.js";

const nonCoreRows: SBWordRow2[] = [
  makeRow(1, {
    word_lang: "en",
    word: "the",
    gloss: "the",
    gloss_lang: "yue",
    is_core: false,
  }),
];

const coreRows: SBWordRow2[] = [
  makeRow(2, {
    word_lang: "en",
    word: "cat",
    gloss: "貓",
    gloss_lang: "yue",
    is_core: true,
    is_human_verified: true,
  }),
];

function makeRow(id: number, overrides: Partial<SBWordRow2> = {}): SBWordRow2 {
  return {
    id,
    word_lang: "en",
    word: `word-${id}`,
    gloss: `gloss-${id}`,
    gloss_lang: "yue",
    is_core: true,
    created_at: `2026-01-0${id}T00:00:00.000Z`,
    is_human_verified: false,
    ...overrides,
  };
}

function makeQuery(
  resultForRange: (
    filters: Record<string, unknown>,
    from: number | null,
    to: number | null,
  ) => SupabaseSBWordsQueryResult,
): SupabaseSBWordsQuery {
  const filters: Record<string, unknown> = {};
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const query: SupabaseSBWordsQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return query;
    }),
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return query;
    }),
    then: (resolve, reject) =>
      Promise.resolve(resultForRange(filters, rangeFrom, rangeTo)).then(resolve, reject),
  };

  return query;
}

function makeSupabaseClient(rows: SBWordRow2[]): {
  supabaseClient: SupabaseSBWordsClient;
  select: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn(() =>
    makeQuery((filters, from, to) => {
      const filtered = rows.filter((row) =>
        Object.entries(filters).every(([column, value]) => {
          if (column === "is_core") return row.is_core === value;
          return (row as unknown as Record<string, unknown>)[column] === value;
        }),
      );
      return {
        data:
          from === null || to === null
            ? filtered
            : filtered.slice(from, Math.min(to + 1, filtered.length)),
        error: null,
      };
    }),
  );

  return {
    supabaseClient: {
      from: vi.fn(() => ({ select })),
    },
    select,
  };
}

describe("sb words", () => {
  beforeEach(() => {
    clearSBWordsCache();
  });

  it("detects non-core words from markers, gloss, and Supabase rows", async () => {
    const { supabaseClient } = makeSupabaseClient([...nonCoreRows, ...coreRows]);

    await expect(isNotCoreWord("ko", "‿가", undefined, { supabaseClient })).resolves.toBe(
      true,
    );
    await expect(isNotCoreWord("en", "word", "(aside)", { supabaseClient })).resolves.toBe(
      true,
    );
    await expect(isNotCoreWord("en", "THE", undefined, { supabaseClient })).resolves.toBe(
      true,
    );
    await expect(isNotCoreWord("en", "cat", undefined, { supabaseClient })).resolves.toBe(
      false,
    );
  });

  it("loads core words for a language direction once", async () => {
    const { supabaseClient, select } = makeSupabaseClient([...nonCoreRows, ...coreRows]);

    await expect(getSBWordsForLangDir("en", "yue", { supabaseClient })).resolves.toEqual([
      ...nonCoreRows,
      ...coreRows,
    ]);
    await expect(getSBWordsForLangDir("en", "yue", { supabaseClient })).resolves.toEqual([
      ...nonCoreRows,
      ...coreRows,
    ]);

    expect(select).toHaveBeenCalledTimes(2);
  });

  it("generates glosses from explicitations before SBWords", async () => {
    const explicitations: OneWayWordExplicitations = {
      input: { source_lang: "en", source_word: "he", target_lang: "yue" },
      rows: [{ id: 1, word_sense: "佢", explicitations: ["male"] }],
      targetLangIsA: false,
    };

    await expect(
      fetchAndGenGloss(
        { source_lang: "en", source_word: "he", target_lang: "yue" },
        {
          getOneWayWordExplicitations: vi.fn(async () => explicitations),
          generateEmojiForGloss: vi.fn(async () => "[♂]"),
        },
      ),
    ).resolves.toEqual({ targetWord: "佢 [♂]", is_human_verified: true });
  });

  it("generates glosses from cached SBWords", async () => {
    const { supabaseClient } = makeSupabaseClient([...nonCoreRows, ...coreRows]);

    await expect(
      fetchAndGenGloss(
        { source_lang: "en", source_word: "cat", target_lang: "yue" },
        {
          supabaseClient,
          getOneWayWordExplicitations: vi.fn(async () => ({
            input: { source_lang: "en", source_word: "cat", target_lang: "yue" },
            rows: [],
            targetLangIsA: false,
          })),
          generateEmojiForGloss: vi.fn(async () => null),
        },
      ),
    ).resolves.toEqual({ targetWord: "貓", is_human_verified: true });
  });
});
