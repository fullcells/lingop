import { describe, expect, it, vi } from "vitest";
import { generateEmojiFromRows, traceEmojiFromRows, type EmojiRow } from "./emojify.js";

const rows = [
  { en_gloss: "dish", emoji: "🍽️" },
  { en_gloss: "slow-simmer", emoji: "♨️🫕" },
  { en_gloss: "cheese", emoji: "🧀" },
  { en_gloss: "blind man", emoji: "👨‍🦯" },
  { en_gloss: "biscuit", emoji: "🍪" },
  { en_gloss: "sauce", emoji: "🥫" },
  { en_gloss: "silk", emoji: "🧵" },
  { en_gloss: "stir-fry", emoji: "🍳" },
  { en_gloss: "rice", emoji: "🍚" },
] satisfies EmojiRow[];

describe("conservative emoji word forms", () => {
  it.each([
    ["dishes", "🍽️", "dishes", "dish"],
    ["slow-simmered", "♨️🫕", "slow-simmered", "slow-simmer"],
    ["cheesy", "🧀", "cheesy", "cheese"],
    ["blind man's biscuit", "👨‍🦯 🍪", "blind man's", "blind man"],
    ["blind man’s biscuit", "👨‍🦯 🍪", "blind man’s", "blind man"],
    ["saucy", "🥫", "saucy", "sauce"],
    ["silken", "🧵", "silken", "silk"],
    ["silky", "🧵", "silky", "silk"],
    ["stir-fried", "🍳", "stir-fried", "stir-fry"],
    ["stir-fried rice", "🍳 🍚", "stir-fried", "stir-fry"],
    ["slow-simmered dishes", "♨️🫕 🍽️", "slow-simmered", "slow-simmer"],
    ["bLiNd MaN’S biscuit", "👨‍🦯 🍪", "bLiNd MaN’S", "blind man"],
  ])("matches %s and keeps the original input in its trace", async (input, emoji, fragment, base) => {
    expect(await generateEmojiFromRows(input, rows)).toBe(emoji);
    const trace = await traceEmojiFromRows(input, rows);
    expect(trace.emoji).toBe(emoji);
    expect(trace.matches.find(match => match.input === fragment)?.row.en_gloss).toBe(base);
    expect(trace.matches.every(match => rows[match.rowIndex]?.en_gloss === match.row.en_gloss)).toBe(true);
  });

  it("retains exact spellings, longest phrases and duplicate precedence", async () => {
    const exact = [{ en_gloss: "cheesy", emoji: "✅" }, { en_gloss: "cheesy", emoji: "❌" }];
    expect(await generateEmojiFromRows("cheesy", [...rows, ...exact])).toBe("✅");
    expect(await generateEmojiFromRows("cheesy rice", [...rows, ...exact, { en_gloss: "cheesy rice", emoji: "🍲" }])).toBe("🍲");
    expect(await generateEmojiFromRows("blind man's biscuit", [...rows, { en_gloss: "blind man's", emoji: "✅" }])).toBe("✅ 🍪");
    expect(await generateEmojiFromRows("rice slow-simmered", [...rows, { en_gloss: "rice slow-simmered", emoji: "✅" }])).toBe("✅");
  });

  it("handles final-word inflections, hyphen/space variants and plural possessives", async () => {
    const variants = [{ en_gloss: "side dish", emoji: "🍽️" }, { en_gloss: "slow simmer", emoji: "🫕" }, { en_gloss: "stir fry", emoji: "🍳" }, { en_gloss: "dog", emoji: "🐕" }];
    expect(await generateEmojiFromRows("side dishes", variants)).toBe("🍽️");
    expect(await generateEmojiFromRows("slow-simmered", variants)).toBe("🫕");
    expect(await generateEmojiFromRows("stir-fried", variants)).toBe("🍳");
    expect(await generateEmojiFromRows("dogs'", variants)).toBe("🐕");
    expect(await generateEmojiFromRows("dogs’", variants)).toBe("🐕");
  });

  it.each([
    ["many", "man"], ["party", "part"], ["city", "cite"], ["belly", "bell"],
    ["dozen", "doz"], ["kitchen", "kitch"], ["bus", "bu"], ["gas", "ga"],
    ["singing", "singe"], ["coding", "coda"], ["thing", "the"], ["sing", "s"],
  ])("does not invent %s from %s", async (input, stored) => {
    // singe is a real, different verb: singing should use sing, not an arbitrary
    // one-character extension. Known lemmas take precedence over -ing repairs.
    expect(await generateEmojiFromRows(input, [{ en_gloss: stored, emoji: "❌" }])).not.toContain("❌");
  });

  it("does not combine candidates across boundaries or strip arbitrary adjective suffixes", async () => {
    expect(await generateEmojiFromRows("blind / man's biscuit", rows)).not.toContain("👨‍🦯");
    expect(await generateEmojiFromRows("blind; man's biscuit", rows)).not.toContain("👨‍🦯");
    expect(await generateEmojiFromRows("slowly-simmered", rows)).not.toContain("♨️🫕");
    expect(await generateEmojiFromRows("ice creamy", [{ en_gloss: "ice cream", emoji: "❌" }])).not.toContain("❌");
  });

  it("retains core-word filtering and annotation/alternative formatting", async () => {
    const isNotCoreWord = vi.fn(async (_lang: string, word: string) => word === "the");
    const trace = await traceEmojiFromRows("the cheesy dishes / rice (silky)", rows, { isNotCoreWord });
    expect(trace.emoji).toBe("\u2007 🧀 🍽️ / 🍚 (🧵)");
    expect(trace.matches.map(match => match.input)).toEqual(["cheesy", "dishes", "rice", "silky"]);
    expect((await traceEmojiFromRows("blind man's biscuit", rows)).matches[0]?.kind).toBe("affix");
    expect((await traceEmojiFromRows("stir-fried", rows)).matches[0]?.kind).toBe("lemma");
    expect((await traceEmojiFromRows("dishes", rows)).matches[0]?.kind).toBe("plural");
  });

  it("uses bounded index lookups after one dataset scan, including -ing forms", async () => {
    let rowReads = 0;
    const data = new Proxy([...Array.from({ length: 10_000 }, (_, i) => ({ en_gloss: `unused ${i}`, emoji: "" })), ...rows, { en_gloss: "run", emoji: "🏃" }], {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) rowReads++;
        return Reflect.get(target, key, receiver);
      },
    });
    await generateEmojiFromRows("rice", data);
    expect(rowReads).toBe(data.length);
    rowReads = 0;
    for (const input of ["slow-simmered", "stir-fried", "cheesy", "blind man's biscuit", "running"]) await generateEmojiFromRows(input, data);
    expect(rowReads).toBe(0);
  });
});
