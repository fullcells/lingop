import { describe, expect, it, vi } from "vitest";
import { createLingoDataClient } from "./lingo-data-client.js";
import {
  generateEmoji, generateEmojiFromRows, loadEmojiData,
  traceEmoji, traceEmojiFromRows, type EmojiTraceRow,
} from "./emojify.js";

const rows: EmojiTraceRow[] = [
  { id: 1, en_gloss: "GOOD", emoji: "👍", created_at: "2026-10-18T00:00:00Z" },
  { id: 2, en_gloss: "RUN", emoji: "🏃" },
  { id: 3, en_gloss: "-ING", emoji: "…" },
  { id: 4, en_gloss: "DOG", emoji: "🐕" },
  { id: 5, en_gloss: "OLD", emoji: "👴" },
  { id: 6, en_gloss: "[MALE]", emoji: "♂" },
  { id: 7, en_gloss: "ICE", emoji: "🧊" },
  { id: 8, en_gloss: "CREAM", emoji: "🥛" },
  { id: 9, en_gloss: "ICE CREAM", emoji: "🍨" },
  { id: 10, en_gloss: "FLOAT", emoji: "🛟" },
  { id: 11, en_gloss: "COLA", emoji: "🥤" },
  { id: 12, en_gloss: "'S", emoji: "unused possessive" },
  { id: 13, en_gloss: "-SIDE", emoji: "↔" },
  { id: 14, en_gloss: "-?", emoji: "❓" },
];

describe("opt-in emoji provenance", () => {
  it.each([
    ["good", "👍", [1]],
    ["dogs", "🐕", [4]],
    ["running", "🏃…", [2, 3]],
    ["old [male] / running", "👴 [♂] / 🏃…", [5, 6, 2, 3]],
    ["Cola ice cream float", "🥤 🍨 🛟", [11, 9, 10]],
    ["Cola ICE   CREAM\tfloat", "🥤 🍨 🛟", [11, 9, 10]],
    ["Cola ice creams float", "🥤 🍨 🛟", [11, 9, 10]],
    ["Cola ice-cream float", "🥤 🍨 🛟", [11, 9, 10]],
    ["ice / cream", "🧊 / 🥛", [7, 8]],
    ["ice; cream", "🥛", [8]],
    ["dog's", "🐕", [4]],
    ["dogside", "🐕↔", [4, 13]],
    ["dog?", "🐕❓", [4, 14]],
    ["goodly", "【👍】", [1]],
    ["(good)", "(👍)", [1]],
    ["good good", "👍 👍", [1, 1]],
    ["unknown", "", []],
    ["", "", []],
  ] as const)("traces contributing rows in %s without changing its output", async (input, output, ids) => {
    const result = await traceEmojiFromRows(input, rows);
    expect(result.emoji).toBe(output);
    expect(result.matches.map(match => match.row.id)).toEqual(ids);
    expect(result.emoji).toBe(await generateEmojiFromRows(input, rows));
    expect(result.matches.every(match => rows[match.rowIndex]?.id === match.row.id)).toBe(true);
  });

  it("keeps source metadata, lookup text, and match reasons", async () => {
    const exact = await traceEmojiFromRows("good", rows);
    expect(exact.matches).toEqual([{ input: "good", lookup: "good", kind: "exact", rowIndex: 0, row: rows[0] }]);
    expect((await traceEmojiFromRows("dogs", rows)).matches[0]?.kind).toBe("plural");
    expect((await traceEmojiFromRows("ice-cream", rows)).matches[0]).toMatchObject({ input: "ice-cream", lookup: "ice cream", kind: "normalized" });
    expect((await traceEmojiFromRows("old [male]", rows)).matches[1]).toMatchObject({ input: "male", lookup: "[male]", kind: "annotation" });
    expect((await traceEmojiFromRows("running", rows)).matches.map(match => match.kind)).toEqual(["affix", "affix"]);
    const lemma = await traceEmojiFromRows("went", [{ id: 50, en_gloss: "GO", emoji: "➡" }]);
    expect(lemma.matches[0]).toMatchObject({ input: "went", lookup: "GO", kind: "lemma" });
  });

  it("reports only the winning phrase and suffix rows, omitting unused candidates", async () => {
    const exactPhrase = { id: 20, en_gloss: "COLA ICE CREAM FLOAT", emoji: "🍹" };
    expect((await traceEmojiFromRows("Cola ice cream float", [...rows, exactPhrase])).matches.map(match => match.row.id)).toEqual([20]);
    const splitAffix = { id: 21, en_gloss: "RUNN -ING", emoji: "🏃‍♂️" };
    expect((await traceEmojiFromRows("running", [...rows, splitAffix])).matches.map(match => match.row.id)).toEqual([21]);
    expect((await traceEmojiFromRows("unknowning", rows)).matches).toEqual([]);
  });

  it("preserves duplicate precedence, repeated uses, and caller-owned rows", async () => {
    const original = structuredClone(rows);
    const result = await traceEmojiFromRows("good good", [rows[0]!, { id: 22, en_gloss: " good ", emoji: "❌" }, rows[0]!]);
    expect(result.matches.map(match => [match.row.id, match.rowIndex])).toEqual([[1, 0], [1, 0]]);
    result.matches[0]!.row.emoji = "changed by inspector";
    expect(rows).toEqual(original);
    expect((await traceEmojiFromRows("dogs", [{ en_gloss: "DOG", emoji: "🐕" }])).matches[0]?.row.id).toBeUndefined();
  });

  it("excludes suppressed/non-core words and keeps asynchronous matches in output order", async () => {
    const isNotCoreWord = vi.fn(async (_lang: string, word: string) => {
      if (word === "running") await new Promise(resolve => setTimeout(resolve, 5));
      return word === "the";
    });
    const result = await traceEmojiFromRows("running the dogs", rows, { isNotCoreWord });
    expect(result.emoji).toBe("🏃… \u2007 🐕");
    expect(result.matches.map(match => match.row.id)).toEqual([2, 3, 4]);
    const suppressed = await traceEmojiFromRows("good", rows, { study_word: "啊", study_lang: "yue" });
    expect(suppressed).toEqual({ en_gloss: "good", emoji: "\u00A0", matches: [] });
  });

  it("does not reuse or contaminate the ordinary result cache", async () => {
    const isNotCoreWord = vi.fn(async () => false);
    await generateEmojiFromRows("running", rows, { isNotCoreWord });
    expect((await traceEmojiFromRows("running", rows, { isNotCoreWord })).matches).toHaveLength(2);
    const calls = isNotCoreWord.mock.calls.length;
    await generateEmojiFromRows("running", rows, { isNotCoreWord });
    expect(isNotCoreWord).toHaveBeenCalledTimes(calls);
    const first = await traceEmojiFromRows("good", rows);
    first.matches.length = 0;
    expect((await traceEmojiFromRows("good", rows)).matches).toHaveLength(1);
  });
});

function fixture() {
  let stored = structuredClone(rows), fail = false;
  const queries: { columns: string; pattern?: string; from?: number; to?: number }[] = [];
  const client = { from() { return { select(columns: string) {
    const request = { columns } as typeof queries[number]; queries.push(request);
    const query = {
      order() { return query; }, is() { return query; },
      filter(column: string, operator: string, pattern: string) {
        expect([column, operator]).toEqual(["en_gloss", "imatch"]);
        request.pattern = pattern; return query;
      },
      range(from: number, to: number) { request.from = from; request.to = to; return query; },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        const selected = request.pattern ? stored.filter(row => new RegExp(request.pattern!, "i").test(row.en_gloss)) : stored;
        const page = selected.slice(request.from ?? 0, (request.to ?? selected.length) + 1);
        const result = fail ? { data: null, error: new Error("offline"), count: null }
          : columns === "created_at" ? { data: [{ created_at: "2026-10-18T00:00:00Z" }], error: null, count: stored.length }
          : { data: columns.includes("id,") ? page : page.map(({ emoji, en_gloss }) => ({ emoji, en_gloss })), error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  } }; } };
  return { client, queries, setRows(value: EmojiTraceRow[]) { stored = value; }, setFail(value: boolean) { fail = value; } };
}

describe("lean emoji inspection", () => {
  it("reuses the normal snapshot and fetches only distinct contributing entries", async () => {
    const f = fixture(), options = { supabaseClient: f.client };
    await loadEmojiData({ ...options, storage: null });
    const before = f.queries.length;
    const result = await traceEmoji("good good / running", undefined, undefined, options);
    expect(result.emoji).toBe("👍 👍 / 🏃…");
    expect(result.matches.map(match => match.row.id)).toEqual([1, 1, 2, 3]);
    const reads = f.queries.slice(before);
    expect(reads).toHaveLength(3);
    expect(reads.every(query => query.columns === "id, emoji, en_gloss, created_at"
      && query.pattern && query.from === 0 && query.to === 0)).toBe(true);
  });

  it("fetches one metadata row even with a large shared dataset", async () => {
    const f = fixture();
    f.setRows(Array.from({ length: 1_001 }, (_, index) => ({ id: index + 1, en_gloss: `word ${index}`, emoji: "✅" })));
    await loadEmojiData({ supabaseClient: f.client, storage: null });
    const before = f.queries.length;
    const result = await traceEmoji("word 1000", undefined, undefined, { supabaseClient: f.client });
    expect(result.matches[0]?.row.id).toBe(1_001);
    expect(f.queries.slice(before)).toEqual([{ columns: "id, emoji, en_gloss, created_at", pattern: "^\\s*WORD\\s+1000\\s*$", from: 0, to: 0 }]);
  });

  it("reuses the row-position index for repeated inspections of the same snapshot", async () => {
    const snapshot = [...rows], visit = vi.spyOn(snapshot, "forEach");
    await traceEmojiFromRows("good", snapshot);
    await traceEmojiFromRows("running", snapshot);
    await traceEmojiFromRows("dogs", snapshot);
    expect(visit).toHaveBeenCalledTimes(1);
    visit.mockRestore();
  });

  it("handles literal punctuation and whitespace variants without broad wildcard matching", async () => {
    const f = fixture();
    f.setRows([
      { id: 1, en_gloss: "50-anything", emoji: "❌" },
      { id: 2, en_gloss: " 50%_off.*[sale] ", emoji: "✅" },
      { id: 3, en_gloss: " ICE\t  cream ", emoji: "🍨" },
      { id: 4, en_gloss: "ice cream", emoji: "❌" },
    ]);
    const options = { supabaseClient: f.client };
    expect((await traceEmoji("50%_off.*[sale]", undefined, undefined, options)).matches[0]?.row.id).toBe(2);
    expect((await traceEmoji("ice cream", undefined, undefined, options)).matches[0]?.row.id).toBe(3);
  });

  it("does not attach different current entries to cached output, and uses the existing refresh mechanism", async () => {
    const f = fixture(), options = { supabaseClient: f.client };
    expect((await traceEmoji("good", undefined, undefined, options)).matches[0]?.row.id).toBe(1);
    f.setRows([{ id: 100, en_gloss: "good", emoji: "✅" }]);
    const old = await traceEmoji("good", undefined, undefined, options);
    expect(old.emoji).toBe("👍"); expect(old.matches[0]?.row.id).toBeUndefined();
    // Refresh is already available on the shared loader; no second refresh/cache API.
    await loadEmojiData({ ...options, forceRefresh: true, storage: null });
    const fresh = await traceEmoji("good", undefined, undefined, options);
    expect(fresh.emoji).toBe("✅"); expect(fresh.matches[0]?.row.id).toBe(100);
    expect(fresh.matches[0]?.row.en_gloss).toBe("good");
    f.setRows([]);
    expect((await traceEmoji("good", undefined, undefined, options)).matches[0]?.row.id).toBeUndefined();
  });

  it("skips metadata reads for suppressed, empty and unmatched glosses", async () => {
    const f = fixture(), options = { supabaseClient: f.client };
    await loadEmojiData({ ...options, storage: null });
    const before = f.queries.length;
    expect((await traceEmoji("good", "啊", "yue", options)).matches).toEqual([]);
    expect((await traceEmoji("", undefined, undefined, options)).emoji).toBe("");
    expect((await traceEmoji("unknown", undefined, undefined, options)).matches).toEqual([]);
    expect(f.queries).toHaveLength(before);
  });

  it("rejects metadata failures and retries without another full-table load", async () => {
    const f = fixture(), options = { supabaseClient: f.client };
    await loadEmojiData({ ...options, storage: null });
    const before = f.queries.length;
    f.setFail(true);
    await expect(traceEmoji("good", undefined, undefined, options)).rejects.toThrow("offline");
    f.setFail(false);
    expect((await traceEmoji("good", undefined, undefined, options)).matches[0]?.row.id).toBe(1);
    expect(f.queries.slice(before).every(query => query.pattern)).toBe(true);
    await expect(traceEmoji("good")).rejects.toThrow("Supabase client");
  });

  it("supports the client helper while keeping ordinary generation metadata-free", async () => {
    const f = fixture(), client = createLingoDataClient({ supabaseClient: f.client });
    await client.generateEmoji("good");
    await client.generateEmojis(["good", "good"]);
    expect(f.queries.some(query => query.columns === "id, emoji, en_gloss, created_at")).toBe(false);
    const result = await client.traceEmoji("good");
    expect(result.matches[0]?.row.id).toBe(1);
    expect(await client.generateEmoji("good")).toBe(result.emoji);
    expect((await client.traceEmoji("", "啊", "yue")).emoji).toBe("");
  });
});
