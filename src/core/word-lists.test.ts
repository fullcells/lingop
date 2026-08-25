import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseQueryLike, SupabaseQueryResult } from "./supabase.js";
import {
  buildWordListMetaTree,
  clearWordListsCache,
  getDescendantL10nsOfWordLists,
  getListPksInWordListsMetaTree,
  loadSBCacheWordListsForLang,
  loadWordListMetaData,
  loadWordLists,
  segmentWordListTitle,
  WORD_STREAKS_MASTERY_THRESHOLD,
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

  it("segments titles and exposes the word-streaks mastery threshold", () => {
    expect(segmentWordListTitle("First_Words#3")).toEqual({
      titleLabel: "First Words",
      titleCounter: 3,
    });
    expect(WORD_STREAKS_MASTERY_THRESHOLD).toBe(10);
  });

  it("builds filtered trees while allowing shared nodes across sibling branches", () => {
    const rows: SBWordListRow[] = [
      {
        ...makeWordList(1),
        title: "Root",
        lang: "en",
        type: "UNIVERSAL",
        sublists: ["Branch A", "Branch B", "Japanese", "French"],
      },
      {
        ...makeWordList(2),
        title: "Branch A",
        lang: "en",
        type: "UNIVERSAL",
        sublists: ["Shared"],
      },
      {
        ...makeWordList(3),
        title: "Branch B",
        lang: "en",
        type: "UNIVERSAL",
        sublists: ["Shared"],
      },
      {
        ...makeWordList(4),
        title: "Shared",
        lang: "en",
        type: "UNIVERSAL",
        sublists: null,
      },
      {
        ...makeWordList(5),
        title: "Japanese",
        lang: "ja",
        type: "LANG_SPECIFIC",
        sublists: null,
      },
      {
        ...makeWordList(6),
        title: "French",
        lang: "fr",
        type: "LANG_SPECIFIC",
        sublists: null,
      },
    ];
    const metadata = rows.map(({ words: _words, ...meta }) => meta);

    const tree = buildWordListMetaTree(metadata, "Root", "ja");

    expect(tree?.children?.map((child) => child.meta.title)).toEqual([
      "Branch A",
      "Branch B",
      "Japanese",
    ]);
    expect(tree?.children?.[0]?.children?.[0]?.meta.title).toBe("Shared");
    expect(tree?.children?.[1]?.children?.[0]?.meta.title).toBe("Shared");
    expect(tree && getListPksInWordListsMetaTree(tree)).toEqual([
      "Root",
      "Branch A",
      "Shared",
      "Branch B",
      "Japanese",
    ]);
  });

  it("can fail hard on ancestry cycles for build-time validation", () => {
    const rows: SBWordListRow[] = [
      { ...makeWordList(1), title: "A", sublists: ["B"] },
      { ...makeWordList(2), title: "B", sublists: ["A"] },
    ];
    const metadata = rows.map(({ words: _words, ...meta }) => meta);

    expect(() =>
      buildWordListMetaTree(metadata, "A", "_ANY", {
        throwOnCycle: true,
      }),
    ).toThrow("Infinite word-list ancestry loop detected at A.");
  });

  it("gets unique descendant localizations in their original casing", async () => {
    const wordLists: SBWordListRow[] = [
      {
        ...makeWordList(1),
        title: "Root",
        type: "UNIVERSAL",
        sublists: ["Animals", "Birds"],
      },
      { ...makeWordList(2), title: "Animals", sublists: null },
      { ...makeWordList(3), title: "Birds", sublists: null },
      { ...makeWordList(4), title: "Unselected", sublists: null },
    ];
    const localizedWordLists: SBCacheWordListL10nWordsRow[] = [
      {
        lang: "en",
        list_title: "Animals",
        l10n_words: ["Cat", "DOG"],
        updated_at: "2026-08-20T00:00:00.000Z",
        is_human_verified: true,
      },
      {
        lang: "en",
        list_title: "Birds",
        l10n_words: ["DOG", "Bird"],
        updated_at: "2026-08-20T00:00:00.000Z",
        is_human_verified: true,
      },
      {
        lang: "en",
        list_title: "Unselected",
        l10n_words: ["Ignore"],
        updated_at: "2026-08-20T00:00:00.000Z",
        is_human_verified: true,
      },
    ];
    const { supabaseClient } = makeSupabaseClient({
      wordLists,
      localizedWordLists,
    });

    await expect(
      getDescendantL10nsOfWordLists(["Root"], "en", { supabaseClient }),
    ).resolves.toEqual(["Cat", "DOG", "Bird"]);
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
