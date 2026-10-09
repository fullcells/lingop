import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLingoDataClient } from "./lingo-data-client.js";
import {
  clearWordScoresCache, getWordScores, loadWordScoreKeys, sortWordsByScore,
  WORD_SCORES_CACHE_MAX_AGE_MS, WORD_SCORES_CACHE_MAX_ENTRIES,
} from "./word-scores.js";

type Row = Record<string, unknown>;
type Request = { table: string; columns: string; filters: Record<string, unknown>; words?: string[]; filterText?: string; offset: number };
const key = (id = 1) => ({ id, title: `Rank ${id}`, sort_direction: "asc", updated_at: "2026-10-10T00:00:00Z" });
const score = (word: string, value: number, lang = "yue", score_key_id = 1) => ({ lang, word, score_key_id, value });
function database(tables: Record<string, Row[]> = {}, cap = 1000) {
  const requests: Request[] = [];
  let gate: Promise<void> | undefined;
  let transform: ((request: Request, rows: Row[]) => { data: unknown; error: unknown; count?: number | null }) | undefined;
  let active = 0, maxActive = 0;
  const supabaseClient = {
    from(table: string) {
      return { select(columns: string) {
        const filters: Record<string, unknown> = {};
        const inFilters: Record<string, unknown[]> = {};
        const orders: string[] = [];
        let words: string[] | undefined, filterText: string | undefined, offset = 0, end = 999;
        const query = {
          eq(column: string, value: unknown) { filters[column] = value; return query; },
          in(column: string, values: unknown[]) { inFilters[column] = values; return query; },
          filter(column: string, operator: string, value: string) {
            expect([column, operator]).toEqual(["word", "in"]);
            filterText = value;
            words = [...value.matchAll(/"((?:\\[\s\S]|[^"\\])*)"/g)].map(match => match[1]!.replace(/\\([\s\S])/g, "$1"));
            return query;
          },
          order(column: string) { orders.push(column); return query; },
          range(start: number, stop: number) { offset = start; end = stop; return query; },
          then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
            const request = { table, columns, filters, words, filterText, offset };
            requests.push(request);
            active++; maxActive = Math.max(active, maxActive);
            const rows = (tables[table] ?? []).filter(row =>
              Object.entries(filters).every(([column, value]) => row[column] === value) &&
              Object.entries(inFilters).every(([column, values]) => values.includes(row[column])) &&
              (!words || words.includes(String(row.word))))
              .slice().sort((a, b) => {
                for (const column of orders) {
                  const av = a[column], bv = b[column];
                  if (av === bv) continue;
                  return av! < bv! ? -1 : 1;
                }
                return 0;
              });
            const result = transform ? transform(request, rows) : {
              data: rows.slice(offset, Math.min(end + 1, offset + cap)).map(row => ({ ...row })), error: null, count: rows.length,
            };
            return (gate ?? Promise.resolve()).then(() => result).finally(() => { active--; }).then(resolve, reject);
          },
        };
        return query;
      } };
    },
  };
  return { supabaseClient, requests, tables, get maxActive() { return maxActive; },
    pause(value?: Promise<void>) { gate = value; },
    transform(value?: typeof transform) { transform = value; },
  };
}

describe("word scores", () => {
  beforeEach(() => clearWordScoresCache());
  afterEach(() => vi.useRealTimers());

  it("pages scoring methods under a small server cap, caches and copies metadata", async () => {
    const db = database({ word_score_keys: [key(3), key(2), key(1)] }, 1);
    const [a, b] = await Promise.all([loadWordScoreKeys(db), loadWordScoreKeys(db)]);
    expect(a.map(row => row.id)).toEqual([1, 2, 3]);
    expect(db.requests.map(r => r.offset)).toEqual([0, 1, 2]);
    a[0]!.title = "changed"; a.length = 0;
    expect(await loadWordScoreKeys(db)).toEqual(b);
    db.tables.word_score_keys![0]!.title = "Renamed";
    expect((await loadWordScoreKeys({ ...db, forceRefresh: true }))[2]!.title).toBe("Renamed");
  });

  it("matches exact word/language/key, preserves zero and returns null for missing words", async () => {
    const db = database({ word_scores: [score("青", 0), score("青", 9, "ja"), score("青", -2, "yue", 2), score("青(color)", 4)] });
    const found = await getWordScores(["missing", "青", "青", "青(color)"], "yue", 1, db);
    expect([...found]).toEqual([["missing", null], ["青", 0], ["青(color)", 4]]);
    found.set("青", 100);
    expect((await getWordScores(["青"], "yue", 1, db)).get("青")).toBe(0);
    expect(db.requests).toHaveLength(1);
    expect((await getWordScores(["青"], "ja", 1, db)).get("青")).toBe(9);
    expect((await getWordScores(["青"], "yue", 2, db)).get("青")).toBe(-2);
    expect(db.requests.every(r => r.columns === "lang,word,score_key_id,value")).toBe(true);
    expect(await getWordScores([], "yue", 1, db)).toEqual(new Map());
    expect(db.requests).toHaveLength(3);
  });

  it("escapes punctuation and backslashes without stripping markers or normalizing text", async () => {
    const words = ['a,b', 'food (dish)', '"quote"', 'a\\b', 'a\\",(b)', 'two\nlines', "a.b", "a:b", "青", "é", "e\u0301", "__proto__"];
    const db = database({ word_scores: words.map((word, i) => score(word, i)) });
    const result = await getWordScores(words, "yue", 1, db);
    expect([...result]).toEqual(words.map((word, i) => [word, i]));
    expect(db.requests[0]!.words).toEqual(words);
  });

  it("batches large lists by encoded size, respects server caps, and bounds concurrency", async () => {
    const words = Array.from({ length: 1205 }, (_, i) => `廣東菜${i}`);
    const db = database({ word_scores: words.map((word, i) => score(word, i)) }, 17);
    const result = await getWordScores(words, "yue", 1, db);
    expect(result.size).toBe(words.length);
    expect(result.get(words[1204]!)).toBe(1204);
    expect(db.maxActive).toBeLessThanOrEqual(4);
    expect(db.maxActive).toBeGreaterThan(1);
    expect(db.requests.every(r => r.words!.length <= 100 && encodeURIComponent(r.filterText!).length <= 3010)).toBe(true);
    expect(db.requests.some(r => r.offset === 17)).toBe(true);
    const count = db.requests.length;
    await getWordScores(words.slice().reverse(), "yue", 1, db);
    expect(db.requests).toHaveLength(count);
  });

  it("shares in-flight lookups across overlapping lists, including missing words", async () => {
    const db = database({ word_scores: [score("a", 1), score("c", 3)] });
    let release!: () => void;
    db.pause(new Promise<void>(resolve => { release = resolve; }));
    const first = getWordScores(["a", "b"], "yue", 1, db);
    const second = getWordScores(["b", "c"], "yue", 1, db);
    await vi.waitFor(() => expect(db.requests).toHaveLength(2));
    expect(db.requests.map(r => r.words)).toEqual([["a", "b"], ["c"]]);
    release();
    expect([...await first]).toEqual([["a", 1], ["b", null]]);
    expect([...await second]).toEqual([["b", null], ["c", 3]]);
    await getWordScores(["b", "a", "c"], "yue", 1, db);
    expect(db.requests).toHaveLength(2);
  });

  it("expires negative and positive caches and supports maxAgeMs zero", async () => {
    vi.useFakeTimers();
    const db = database({ word_scores: [score("a", 1)] });
    await getWordScores(["a", "b"], "yue", 1, db);
    db.tables.word_scores = [score("a", 2), score("b", 3)];
    expect([...await getWordScores(["a", "b"], "yue", 1, db)]).toEqual([["a", 1], ["b", null]]);
    vi.advanceTimersByTime(WORD_SCORES_CACHE_MAX_AGE_MS);
    expect([...await getWordScores(["a", "b"], "yue", 1, db)]).toEqual([["a", 2], ["b", 3]]);
    db.tables.word_scores = [];
    expect((await getWordScores(["a"], "yue", 1, { ...db, maxAgeMs: 0 })).get("a")).toBe(null);
    expect(db.requests).toHaveLength(3);
  });

  it("isolates clients and prevents old in-flight responses from restoring an invalidated cache", async () => {
    const a = database({ word_scores: [score("a", 1)] });
    const b = database({ word_scores: [score("a", 2)] });
    let release!: () => void;
    a.pause(new Promise<void>(resolve => { release = resolve; }));
    const old = getWordScores(["a"], "yue", 1, a);
    await vi.waitFor(() => expect(a.requests).toHaveLength(1));
    a.tables.word_scores = [score("a", 3)]; a.pause();
    expect((await getWordScores(["a"], "yue", 1, { ...a, forceRefresh: true })).get("a")).toBe(3);
    expect((await getWordScores(["a"], "yue", 1, b)).get("a")).toBe(2);
    release(); await old;
    expect((await getWordScores(["a"], "yue", 1, a)).get("a")).toBe(3);
    expect(a.requests).toHaveLength(2);
    clearWordScoresCache(a.supabaseClient);
    await getWordScores(["a"], "yue", 1, b);
    expect(b.requests).toHaveLength(1);
  });

  it("rejects failed partial batches rather than caching missing scores, and retries", async () => {
    const db = database({ word_scores: [score("a", 1), score("b", 2)] });
    db.transform((r, rows) => r.offset ? { data: null, error: new Error("offline") } : { data: rows.slice(0, 1), error: null, count: 2 });
    await expect(getWordScores(["a", "b"], "yue", 1, db)).rejects.toThrow("Failed to load word_scores");
    db.transform();
    expect([...await getWordScores(["a", "b"], "yue", 1, db)]).toEqual([["a", 1], ["b", 2]]);
  });

  it.each([
    [score("other", 1)], [score("a", 1, "ja")], [score("a", 1, "yue", 99)],
    [score("a", Infinity)], [score("a", Number.MAX_SAFE_INTEGER + 1)],
    [score("a", 1), score("a", 2)], [{ ...score("a", 1), value: null }],
  ])("rejects malformed or out-of-scope scores (%j)", async (...rows) => {
    const db = database();
    db.transform(() => ({ data: rows, count: rows.length, error: null }));
    await expect(getWordScores(["a"], "yue", 1, db)).rejects.toThrow("word_scores rows");
    db.transform();
    expect((await getWordScores(["a"], "yue", 1, db)).get("a")).toBe(null);
  });

  it("rejects malformed keys and retries", async () => {
    const db = database({ word_score_keys: [{ ...key(), sort_direction: "other" }] });
    await expect(loadWordScoreKeys(db)).rejects.toThrow("word_score_keys rows");
    db.tables.word_score_keys = [key()];
    expect(await loadWordScoreKeys(db)).toEqual([key()]);
  });

  it("continues without a count under a small cap and rejects inconsistent counted pages", async () => {
    const db = database({ word_scores: [score("a", 1), score("b", 2)] });
    db.transform((r, rows) => ({ data: rows.slice(r.offset, r.offset + 1), error: null, count: null }));
    expect((await getWordScores(["a", "b"], "yue", 1, db)).size).toBe(2);
    expect(db.requests.map(r => r.offset)).toEqual([0, 1, 2]);
    db.transform((r, rows) => ({ data: rows.slice(r.offset, r.offset + 1), error: null, count: r.offset ? 3 : 2 }));
    await expect(getWordScores(["a", "b"], "yue", 1, { ...db, forceRefresh: true })).rejects.toThrow("Inconsistent count");
  });

  it("bounds the word cache and evicts least recently used values", async () => {
    const db = database();
    const words = Array.from({ length: WORD_SCORES_CACHE_MAX_ENTRIES }, (_, i) => `w${i}`);
    await getWordScores(words, "yue", 1, db);
    await getWordScores(["w0"], "yue", 1, db);
    await getWordScores(["new"], "yue", 1, db);
    const before = db.requests.length;
    await getWordScores(["w0"], "yue", 1, db);
    expect(db.requests).toHaveLength(before);
    await getWordScores(["w1"], "yue", 1, db);
    expect(db.requests).toHaveLength(before + 1);
  });

  it("validates configuration and inputs before requesting scores", async () => {
    const db = database();
    await expect(loadWordScoreKeys()).rejects.toThrow("Supabase client");
    await expect(getWordScores(["a"], "", 1, db)).rejects.toThrow("language");
    await expect(getWordScores(["a"], "yue", 0, db)).rejects.toThrow("score-key ID");
    await expect(getWordScores([""], "yue", 1, db)).rejects.toThrow("non-empty words");
    await expect(getWordScores(["a"], "yue", 1, { ...db, maxAgeMs: -1 })).rejects.toThrow("maxAgeMs");
    await expect(getWordScores(["a", "長".repeat(400)], "yue", 1, db)).rejects.toThrow("too long");
    expect(db.requests).toHaveLength(0);
  });

  it("sorts both directions, keeps unscored words last and ties stable, without mutation", () => {
    const words = ["missing", "a", "b", "zero", "negative", "a", "also missing"];
    const values = new Map<string, number | null>([["a", 1.5], ["b", 1.5], ["zero", 0], ["negative", -2], ["missing", null]]);
    expect(sortWordsByScore(words, values, "asc").map(row => row.word)).toEqual(["negative", "zero", "a", "b", "a", "missing", "also missing"]);
    expect(sortWordsByScore(words, values, "desc").map(row => row.word)).toEqual(["a", "b", "a", "zero", "negative", "missing", "also missing"]);
    expect(words[0]).toBe("missing");
    expect(values.size).toBe(5);
  });

  it("composes with recursive V3 list reads through LingoDataClient", async () => {
    const db = database({
      word_score_keys: [key()], word_scores: [score("蛋撻", 12), score("公仔麵", 1)],
      word_lists_v3: [1, 2].map(id => ({ id, lang: "yue", anchor_list_id: null, title: `Food ${id}`, updated_at: "now" })),
      word_list_words: [{ id: 1, list_id: 1, text: "蛋撻", position: 1 }, { id: 2, list_id: 2, text: "公仔麵", position: 1 }, { id: 3, list_id: 2, text: "未評分", position: 2 }],
      word_list_sublists: [{ parent_list_id: 1, child_list_id: 2, position: 1 }],
    });
    const client = createLingoDataClient(db);
    const keys = await client.loadWordScoreKeys();
    const words = await client.getDescendantL10nsOfWordListsV3([1], "yue");
    const scores = await client.getWordScores(words, "yue", keys[0]!.id);
    expect(sortWordsByScore(words, scores, keys[0]!.sort_direction)).toEqual([
      { word: "公仔麵", value: 1 }, { word: "蛋撻", value: 12 }, { word: "未評分", value: null },
    ]);
    const count = db.requests.length;
    await client.getWordScores(words, "yue", 1);
    expect(db.requests).toHaveLength(count);
    client.clearWordScoresCache();
    await client.getWordScores(words, "yue", 1);
    expect(db.requests).toHaveLength(count + 1);
    await client.getDescendantL10nsOfWordListsV3([1], "yue");
    expect(db.requests).toHaveLength(count + 1);
  });
});
