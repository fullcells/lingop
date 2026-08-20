import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseQueryLike, SupabaseQueryResult } from "./supabase.js";
import {
  clearWordListsCache,
  loadSBCacheWordListsForLang,
  loadWordListMetaData,
  loadWordLists,
  type SBCacheWordListL10nWordsRow,
  type SBWordListRow,
  type SupabaseWordListsClient,
} from "./word-lists.js";

type TestRow = SBWordListRow | SBCacheWordListL10nWordsRow;

function makeQuery(
  rows: TestRow[],
  filters: Record<string, unknown>,
): SupabaseQueryLike {
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const query: SupabaseQueryLike = {
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return query;
    }),
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return query;
    }),
    then: (resolve, reject) => {
      const filtered = rows.filter((row) =>
        Object.entries(filters).every(
          ([column, value]) =>
            (row as unknown as Record<string, unknown>)[column] === value,
        ),
      );
      const result: SupabaseQueryResult = {
        data:
          rangeFrom === null || rangeTo === null
            ? filtered
            : filtered.slice(rangeFrom, rangeTo + 1),
        error: null,
      };
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return query;
}

function makeSupabaseClient({
  wordLists = [],
  localizedWordLists = [],
}: {
  wordLists?: SBWordListRow[];
  localizedWordLists?: SBCacheWordListL10nWordsRow[];
}): {
  supabaseClient: SupabaseWordListsClient;
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn((columns: string) => {
    const rows = columns.includes("l10n_words") ? localizedWordLists : wordLists;
    return makeQuery(rows, {});
  });
  const from = vi.fn(() => ({ select }));
  return { supabaseClient: { from }, from, select };
}

function makeWordList(index: number): SBWordListRow {
  return {
    title: `List ${String(index).padStart(4, "0")}`,
    lang: "en",
    sublists: index % 2 === 0 ? ["Basics"] : null,
    words: [`word-${index}`],
    type: "LANG_SPECIFIC",
    updated_at: "2026-08-20T00:00:00.000Z",
  };
}

describe("word lists", () => {
  beforeEach(() => {
    clearWordListsCache();
  });

  it("loads every word-list page once and derives metadata from the cache", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => makeWordList(index));
    const { supabaseClient, select } = makeSupabaseClient({ wordLists: rows });

    await expect(loadWordLists({ supabaseClient })).resolves.toEqual(rows);
    const metadata = await loadWordListMetaData({ supabaseClient });

    expect(metadata).toHaveLength(rows.length);
    expect(metadata[0]).not.toHaveProperty("words");
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent localized loads and caches each language separately", async () => {
    const rows: SBCacheWordListL10nWordsRow[] = [
      {
        lang: "yue",
        list_title: "Animals",
        l10n_words: ["貓", "狗"],
        updated_at: "2026-08-20T00:00:00.000Z",
        is_human_verified: true,
      },
      {
        lang: "fr",
        list_title: "Animals",
        l10n_words: ["chat", "chien"],
        updated_at: "2026-08-20T00:00:00.000Z",
        is_human_verified: false,
      },
    ];
    const { supabaseClient, from } = makeSupabaseClient({
      localizedWordLists: rows,
    });

    const [first, second] = await Promise.all([
      loadSBCacheWordListsForLang("yue", { supabaseClient }),
      loadSBCacheWordListsForLang("yue", { supabaseClient }),
    ]);
    const french = await loadSBCacheWordListsForLang("fr", { supabaseClient });

    expect(first).toEqual([rows[0]]);
    expect(second).toBe(first);
    expect(french).toEqual([rows[1]]);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("uses public selects without inspecting Supabase auth", async () => {
    const auth = { getUser: vi.fn(), getSession: vi.fn() };
    const { supabaseClient } = makeSupabaseClient({
      wordLists: [makeWordList(1)],
    });
    const clientWithAuth = { ...(supabaseClient as object), auth };

    await expect(loadWordLists({ supabaseClient: clientWithAuth })).resolves.toHaveLength(1);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("does not cache a missing-client result", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(loadWordLists()).resolves.toEqual([]);

    const { supabaseClient } = makeSupabaseClient({
      wordLists: [makeWordList(1)],
    });
    await expect(loadWordLists({ supabaseClient })).resolves.toHaveLength(1);

    consoleError.mockRestore();
  });
});
