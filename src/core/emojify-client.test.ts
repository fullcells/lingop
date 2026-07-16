import { describe, expect, it, vi } from "vitest";
import { createLingoDataClient, type SupabaseLingoDataClient } from "./lingo-data-client.js";
import type {
  EmojiRow,
  SupabaseEmojiQuery,
  SupabaseEmojiQueryResult,
} from "./emojify.js";

function makeQuery(
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

  return query;
}

function makeSupabaseClient(data: EmojiRow[]): {
  supabaseClient: SupabaseLingoDataClient;
  select: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn(
    (
      _columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): SupabaseEmojiQuery => {
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

describe("LingoDataClient emoji helpers", () => {
  it("generates emoji through the owned client cache", async () => {
    const { supabaseClient, select } = makeSupabaseClient([
      { emoji: "👍", en_gloss: "good" },
    ]);
    const client = createLingoDataClient({ supabaseClient });

    await expect(client.loadEmojiData()).resolves.toEqual([
      { emoji: "👍", en_gloss: "GOOD" },
    ]);
    await expect(client.generateEmoji("good")).resolves.toBe("👍");

    expect(select).toHaveBeenCalledTimes(2);
  });
});
