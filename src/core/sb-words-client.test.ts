import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLingoDataClient, type SupabaseLingoDataClient } from "./lingo-data-client.js";
import type { EmojiRow } from "./emojify.js";
import type { SBWordRow2 } from "./sb-words.js";
import { clearSBWordsCache as resetSBWordsCache } from "./sb-words.js";
import type { SupabaseQueryLike, SupabaseQueryResult } from "./supabase.js";

type SupabaseEmojiQuery = SupabaseQueryLike;
type SupabaseEmojiQueryResult = SupabaseQueryResult;
type SupabaseSBWordsQuery = SupabaseQueryLike;
type SupabaseSBWordsQueryResult = SupabaseQueryResult;

function makeSBWordRow(id: number, overrides: Partial<SBWordRow2> = {}): SBWordRow2 {
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

function makeEmojiQuery(
  rows: EmojiRow[],
  resultForRange: (from: number | null, to: number | null) => SupabaseEmojiQueryResult,
): SupabaseEmojiQuery {
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const query: SupabaseEmojiQuery = {
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return query;
    }),
    then: (resolve, reject) =>
      Promise.resolve(resultForRange(rangeFrom, rangeTo)).then(resolve, reject),
  };

  void rows;
  return query;
}

function makeSBWordsQuery(
  rows: SBWordRow2[],
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

  void rows;
  return query;
}

function makeSupabaseClient({
  emojiRows,
  sbWordRows,
}: {
  emojiRows: EmojiRow[];
  sbWordRows: SBWordRow2[];
}): SupabaseLingoDataClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "emojis") {
        return {
          select: vi.fn(
            (_columns: string, options?: { count?: "exact"; head?: boolean }) => {
              if (options?.head) {
                return makeEmojiQuery(emojiRows, () => ({
                  data: null,
                  error: null,
                  count: emojiRows.length,
                }));
              }

              return makeEmojiQuery(emojiRows, (from, to) => ({
                data:
                  from === null || to === null
                    ? emojiRows
                    : emojiRows.slice(from, Math.min(to + 1, emojiRows.length)),
                error: null,
              }));
            },
          ),
        };
      }

      return {
        select: vi.fn(() =>
          makeSBWordsQuery(sbWordRows, (filters, from, to) => {
            const filtered = sbWordRows.filter((row) =>
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
        ),
      };
    }) as SupabaseLingoDataClient["from"],
  };
}

describe("LingoDataClient SBWords helpers", () => {
  beforeEach(() => {
    resetSBWordsCache();
  });

  it("uses the shared SBWords cache when generating emoji", async () => {
    const client = createLingoDataClient({
      supabaseClient: makeSupabaseClient({
        emojiRows: [
          { emoji: "🏃", en_gloss: "run" },
        ],
        sbWordRows: [
          makeSBWordRow(1, {
            word: "the",
            is_core: false,
          }),
        ],
      }),
    });

    await expect(client.isNotCoreWord("en", "the")).resolves.toBe(true);
    await expect(client.generateEmoji("the running")).resolves.toBe("\u2007 🏃");
  });
});
