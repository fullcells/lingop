import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLingoDataClient } from "./lingo-data-client.js";
import {
  buildWordListTreeV3,
  clearWordListsV3Cache,
  getDescendantL10nsOfWordListsV3,
  getWordListL10nV3,
  loadWordListMetaDataV3,
  loadWordListsV3,
  resolveWordListL10nV3,
  type SBWordListV3Row,
} from "./word-lists-v3.js";

type Row = Record<string, unknown>;
function list(id: number, lang = "en", anchor: number | null = null): SBWordListV3Row {
  return { id, lang, anchor_list_id: anchor, title: `List#${id}`, updated_at: "2026-10-05T00:00:00Z" };
}
function word(id: number, list_id: number, text: string, position: number | null) {
  return { id, list_id, text, position };
}
function edge(parent_list_id: number, child_list_id: number, position: number) {
  return { parent_list_id, child_list_id, position };
}
function database(tables: Record<string, Row[]>, cap = 1000) {
  const requests: { table: string; from: number; ids?: unknown[] }[] = [];
  let fail: ((table: string, from: number) => boolean) | undefined;
  let gate: Promise<void> | undefined;
  const supabaseClient = {
    from(table: string) {
      return {
        select() {
          let from = 0, to = 999;
          let filter: { column: string; ids: unknown[] } | undefined;
          const orders: string[] = [];
          const query = {
            in(column: string, ids: unknown[]) { filter = { column, ids }; return query; },
            order(column: string) { orders.push(column); return query; },
            range(start: number, end: number) { from = start; to = end; return query; },
            then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
              requests.push({ table, from, ...(filter ? { ids: filter.ids } : {}) });
              const rows = [...(tables[table] ?? [])]
                .filter((row) => !filter || filter.ids.includes(row[filter.column]))
                .sort((a, b) => {
                  for (const column of orders) {
                    const diff = Number(a[column]) - Number(b[column]);
                    if (diff) return diff;
                  }
                  return 0;
                });
              const result = fail?.(table, from)
                ? { data: null, error: new Error("offline"), count: null }
                : { data: rows.slice(from, Math.min(to + 1, from + cap)).map((row) => ({ ...row })), error: null, count: rows.length };
              return (gate ?? Promise.resolve()).then(() => result).then(resolve, reject);
            },
          };
          return query;
        },
      };
    },
  };
  return {
    supabaseClient, requests,
    failWith(callback?: typeof fail) { fail = callback; },
    pause(promise?: Promise<void>) { gate = promise; },
  };
}

function familyDatabase() {
  return database({
    word_lists_v3: [
      { ...list(1, "yue"), title: "廣東菜#1" },
      { ...list(2, "en", 1), title: "Cantonese cuisine#1" },
      list(3, "en"), list(4, "en"), list(5, "en"), list(6, "ja", 3),
      list(7, "yue"), list(8, "en", 7), list(9, "ko"),
    ],
    word_list_words: [
      word(1, 1, "點心", 1), word(3, 2, "dim sum", 1),
      word(2, 2, "tea", 2), word(4, 3, "branch", 1),
      word(5, 4, "shared", 1), word(6, 4, "tea", 2),
      word(7, 5, "last", 1), word(8, 6, "日本語", 1), word(9, 8, "resolved child", 1),
    ],
    word_list_sublists: [edge(2, 3, 1), edge(2, 5, 2), edge(3, 4, 1), edge(5, 4, 1), edge(2, 7, 3), edge(2, 9, 4)],
  });
}

describe("v3 word lists", () => {
  beforeEach(() => clearWordListsV3Cache());
  afterEach(() => vi.useRealTimers());

  it("pages metadata and words without truncation, even with a smaller server cap", async () => {
    const db = database({
      word_lists_v3: Array.from({ length: 1001 }, (_, i) => list(i + 1, i === 0 ? "ja" : "en")),
      word_list_words: Array.from({ length: 1002 }, (_, i) => word(i + 1, 1, `word-${i}`, i + 1)),
    }, 350);
    expect(await loadWordListMetaDataV3(db)).toHaveLength(1001);
    const lists = await loadWordListsV3("ja", db);
    expect(lists[0]?.words).toHaveLength(1002);
    expect(lists[0]?.words[1001]?.text).toBe("word-1001");
    expect(db.requests.filter((r) => r.table === "word_lists_v3").map((r) => r.from)).toEqual([0, 350, 700]);
    expect(db.requests.filter((r) => r.table === "word_list_words").map((r) => r.from)).toEqual([0, 350, 700]);
  });

  it("batches many lists and preserves duplicate text, gaps, and unpositioned words", async () => {
    const db = database({
      word_lists_v3: Array.from({ length: 501 }, (_, i) => list(i + 1)),
      word_list_words: [word(1, 1, "tail", null), word(2, 1, "same", 8), word(3, 1, "same", 1), word(4, 1, "last", null)],
      word_list_sublists: [edge(1, 3, 9), edge(1, 2, 2)],
    });
    const lists = await loadWordListsV3("en", db);
    expect(lists[0]?.words.map((w) => w.id)).toEqual([3, 2, 1, 4]);
    expect(lists[0]?.sublists.map((e) => e.child_list_id)).toEqual([2, 3]);
    expect(db.requests).toHaveLength(7); // metadata + three word batches + three edge batches
    expect(db.requests.every((r) => !r.ids || r.ids.length <= 250)).toBe(true);
    expect(await loadWordListsV3("absent", db)).toEqual([]);
    expect(db.requests).toHaveLength(7);
  });

  it("shares in-flight and warm reads and protects cached data from caller edits", async () => {
    const db = familyDatabase();
    const [a, b] = await Promise.all([loadWordListsV3("en", db), loadWordListsV3("en", db)]);
    expect(a).toEqual(b);
    expect(db.requests).toHaveLength(3);
    a[0]!.title = "mutated";
    a[0]!.words[0]!.text = "mutated";
    a[0]!.sublists.length = 0;
    const fresh = await loadWordListsV3("en", db);
    expect(fresh).toEqual(b);
    const meta = await loadWordListMetaDataV3(db);
    meta[0]!.title = "mutated";
    expect((await loadWordListMetaDataV3(db))[0]?.title).toBe("廣東菜#1");
    expect(db.requests).toHaveLength(3);
  });

  it("isolates databases even when IDs and languages match", async () => {
    const a = database({ word_lists_v3: [list(1)], word_list_words: [word(1, 1, "A", 1)] });
    const b = database({ word_lists_v3: [list(1)], word_list_words: [word(1, 1, "B", 1)] });
    expect((await loadWordListsV3("en", a))[0]?.words[0]?.text).toBe("A");
    expect((await loadWordListsV3("en", b))[0]?.words[0]?.text).toBe("B");
    clearWordListsV3Cache(a.supabaseClient);
    await loadWordListsV3("en", b);
    expect(b.requests).toHaveLength(3);
    await loadWordListsV3("en", a);
    expect(a.requests).toHaveLength(6);
  });

  it("expires cached reads and supports forced refresh or zero max age", async () => {
    vi.useFakeTimers();
    const db = familyDatabase();
    await loadWordListsV3("en", db);
    vi.advanceTimersByTime(5 * 60 * 1000);
    await loadWordListsV3("en", db);
    expect(db.requests).toHaveLength(6);
    await loadWordListsV3("en", { ...db, forceRefresh: true });
    expect(db.requests).toHaveLength(9);
    await loadWordListsV3("en", { ...db, maxAgeMs: 0 });
    expect(db.requests).toHaveLength(12);
  });

  it("does not repopulate a cleared cache from an older in-flight read", async () => {
    const db = familyDatabase();
    let release!: () => void;
    db.pause(new Promise<void>((resolve) => { release = resolve; }));
    const oldRead = loadWordListsV3("en", db);
    await vi.waitFor(() => expect(db.requests).toHaveLength(1));
    clearWordListsV3Cache(db.supabaseClient);
    db.pause();
    await loadWordListsV3("en", db);
    const before = db.requests.length;
    release();
    await oldRead;
    expect(db.requests.length).toBeGreaterThan(before);
    const after = db.requests.length;
    await loadWordListsV3("en", db);
    expect(db.requests).toHaveLength(after);
  });

  it("rejects partial failed reads and retries instead of caching missing words", async () => {
    const db = database({
      word_lists_v3: [list(1)],
      word_list_words: Array.from({ length: 1001 }, (_, i) => word(i + 1, 1, `word-${i}`, i + 1)),
    });
    db.failWith((table, from) => table === "word_list_words" && from === 1000);
    await expect(loadWordListsV3("en", db)).rejects.toThrow("Failed to load word_list_words");
    db.failWith();
    expect((await loadWordListsV3("en", db))[0]?.words).toHaveLength(1001);
  });

  it("retries catalog failures and rejects invalid or unsafe database IDs", async () => {
    const db = database({ word_lists_v3: [list(1)] });
    db.failWith(() => true);
    await expect(loadWordListsV3("en", db)).rejects.toThrow("Failed to load word_lists_v3");
    db.failWith();
    expect(await loadWordListsV3("en", db)).toHaveLength(1);
    const bad = database({ word_lists_v3: [list(Number.MAX_SAFE_INTEGER + 1)] });
    await expect(loadWordListMetaDataV3(bad)).rejects.toThrow("Invalid rows");
    await expect(loadWordListsV3("en")).rejects.toThrow("require a Supabase client");
    await expect(loadWordListsV3("", db)).rejects.toThrow("language");
    await expect(loadWordListsV3("en", { ...db, maxAgeMs: -1 })).rejects.toThrow("maxAgeMs");
  });

  it("resolves non-English anchors in both directions and between siblings using IDs", async () => {
    const db = familyDatabase();
    const rows = await loadWordListMetaDataV3(db);
    expect(resolveWordListL10nV3(rows, 2, "yue")?.id).toBe(1);
    expect((await getWordListL10nV3(1, "en", db))?.title).toBe("Cantonese cuisine#1");
    expect(await getWordListL10nV3(1, "fr", db)).toBeNull();
    expect(await getWordListL10nV3(999, "en", db)).toBeNull();
    const siblings = [list(1, "yue"), list(2, "en", 1), list(3, "ja", 1)];
    expect(resolveWordListL10nV3(siblings, 2, "ja")?.id).toBe(3);
    expect(resolveWordListL10nV3([list(1), list(2)], 1, "en")?.id).toBe(1);
    expect(() => resolveWordListL10nV3([...siblings, list(4, "ja", 1)], 2, "ja")).toThrow("Ambiguous");
  });

  it("walks localized hierarchies, includes parent words, and visits shared descendants once", async () => {
    const db = familyDatabase();
    expect(await getDescendantL10nsOfWordListsV3([1, 2], "en", db))
      .toEqual(["dim sum", "tea", "branch", "shared", "last", "resolved child"]);
    expect(await getDescendantL10nsOfWordListsV3([1], "yue", db)).toEqual(["點心"]);
    expect(await getDescendantL10nsOfWordListsV3([3], "ja", db)).toEqual(["日本語"]);
    expect(await getDescendantL10nsOfWordListsV3([1], "ja", db)).toEqual([]);
    expect(await getDescendantL10nsOfWordListsV3([], "en")).toEqual([]);
  });

  it("builds shared tree branches, omits missing nodes, and handles cycles explicitly", async () => {
    const db = database({
      word_lists_v3: [list(1), list(2), list(3), list(4)],
      word_list_words: [word(1, 1, "parent", 1), word(2, 4, "shared", 1)],
      word_list_sublists: [edge(1, 2, 1), edge(1, 3, 2), edge(2, 4, 1), edge(3, 4, 1), edge(4, 1, 1), edge(4, 999, 2)],
    });
    const lists = await loadWordListsV3("en", db);
    const tree = buildWordListTreeV3(lists, 1);
    expect(tree?.children.map((c) => c.children[0]?.list.id)).toEqual([4, 4]);
    expect(tree?.children[0]?.children[0]?.children).toEqual([]);
    expect(buildWordListTreeV3(lists, 999)).toBeNull();
    expect(() => buildWordListTreeV3(lists, 1, { throwOnCycle: true })).toThrow("cycle");
    expect(await getDescendantL10nsOfWordListsV3([1], "en", db)).toEqual(["parent", "shared"]);
    await expect(getDescendantL10nsOfWordListsV3([1], "en", { ...db, throwOnCycle: true })).rejects.toThrow("cycle");
  });

  it("exposes v3 through LingoDataClient while retaining legacy methods", async () => {
    const db = familyDatabase();
    const client = createLingoDataClient(db);
    expect(await client.loadWordListMetaDataV3()).toHaveLength(9);
    expect(await client.loadWordListsV3("en")).toHaveLength(5);
    expect((await client.getWordListL10nV3(1, "en"))?.id).toBe(2);
    expect(await client.getDescendantL10nsOfWordListsV3([1], "en"))
      .toEqual(["dim sum", "tea", "branch", "shared", "last", "resolved child"]);
    expect(db.requests).toHaveLength(3);
    client.clearWordListsV3Cache();
    await client.loadWordListsV3("en");
    expect(db.requests).toHaveLength(6);
    expect(client.loadWordLists).toBeTypeOf("function");
    expect(client.loadWordListMetaData).toBeTypeOf("function");
    expect(client.loadSBCacheWordListsForLang).toBeTypeOf("function");
    expect(client.getDescendantL10nsOfWordLists).toBeTypeOf("function");
    expect(db.requests.every((r) => ["word_lists_v3", "word_list_words", "word_list_sublists"].includes(r.table))).toBe(true);
  });
});
