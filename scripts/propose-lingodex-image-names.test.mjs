import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { buildProposal, loadLegacySource, nameFromFilename, nameFromPair, toTsv } from "./propose-lingodex-image-names.mjs";

const { LingoDexData, lingoDexUniqueImages, numLingoDexEntryVariants } = await loadLegacySource();

function entry(fields) {
  return { devref: "#test", ostage: "test", ...Object.fromEntries(
    ["q", "a", "i"].flatMap(prefix => [1, 2, 3, 4, 5].map(n => [prefix + n, ""])),
  ), ...fields };
}

test("uses the display fallback to i1 and q1, never another preceding field", () => {
  const e = entry({ q1: "What is the person doing?", q2: "Who is here?", q3: "", a1: "reading", a2: "a cat", a3: "writing",
    i1: "opaque•one", i2: "opaque•two", i3: "", q4: "Who is here?", a4: "a bird", a5: "distractor" });
  const rows = buildProposal([e], numLingoDexEntryVariants);
  assert.equal(numLingoDexEntryVariants(e), 3); // counts nonempty q/i, not answers or highest field index
  assert.equal(rows.length, 2);
  const first = rows.find(r => r.old_name === e.i1);
  assert.deepEqual(first.associations.map(a => [a.variant, a.image_field, a.question_field, a.question, a.answer]), [
    [1, "i1", "q1", e.q1, "reading"], [3, "i1", "q1", e.q1, "writing"],
  ]);
  assert(!rows.some(r => r.associations.some(a => a.answer === "distractor" || a.answer === "a bird")));
});

test("keeps standalone descriptive filenames and rejects technical identifiers", () => {
  assert.equal(nameFromFilename("man-what-this-cat"), "man what this cat");
  assert.equal(nameFromFilename("dog•2"), "dog");
  assert.equal(nameFromFilename("shopping_center"), "shopping center");
  for (const name of ["m1-go-oig1", "m5-food-salad", "download-8", "h-week-days", "🐱", "DALL·E 2024-07-09", "aldrin-moon-1969-16685140", "_aef037c2-15b7-4357-ad10-74b942f3c682"]) {
    assert.equal(nameFromFilename(name), null, name);
  }
});

test("fills question slots without reversing subject/object, splitting dog into do + g, or repeating counts", () => {
  const cases = [
    ["What is next to the dog?", "a cat.", "cat next to dog"],
    ["Who is the woman saving?", "a man", "woman saving man"],
    ["Who is behind the man reading?", "a woman", "woman behind man reading"],
    ["What is the boy doing?", "he is reading a book", "boy reading book"],
    ["What color is the flower?", "the flower is orange", "flower orange"],
    ["How many birds are on the flag?", "one bird", "one bird on flag"],
    ["How many legs does an ant have?", "six legs", "ant six legs"],
    ["What is the man asking about?", "directions", "man asking about directions"],
    ["What is the person doing at the hotel?", "swimming in the hotel pool", "person swimming in hotel pool at hotel"],
    ["What flavor of ice-cream is the person eating?", "chocolate", "person eating chocolate ice cream"],
    ["What kind of video game is the person playing?", "sports game", "person playing sports video game"],
  ];
  for (const [q, a, expected] of cases) assert.equal(nameFromPair(q, a).name, expected, q);
});

test("preserves negation, comparisons, alternatives, math, and unknown age", () => {
  const cases = [
    ["Can dogs be in here?", "they can not", "dogs not in here"],
    ["Are they wearing the same clothes?", "No", "people not wearing same clothes"],
    ["Is there any food in the fridge?", "there is not", "no food in fridge"],
    ["Is the world flat?", "No", "world not flat"],
    ["Is the car expensive or cheap?", "cheap", "car cheap"],
    ["Which vehicle has less windows than a bus?", "a car", "car less windows than bus"],
    ["Which answer is wrong?", "2 + 2 = 5", "2 plus 2 equals 5 wrong"],
    ["", "She is reading a book.", "person reading book"],
  ];
  for (const [q, a, expected] of cases) assert.equal(nameFromPair(q, a).name, expected, q);
});

test("deduplicates old identifiers and numbers collisions independently of source ordering", () => {
  const a = entry({ devref: "#a", a1: "a cat", i1: "opaque•z" });
  const b = entry({ devref: "#b", a1: "a cat", i1: "opaque•a" });
  const c = entry({ devref: "#c", a1: "a cat", i1: "opaque•a" });
  const rows = buildProposal([a, b, c], numLingoDexEntryVariants);
  assert.deepEqual(rows.map(r => [r.old_name, r.new_name]), [["opaque•a", "cat"], ["opaque•z", "cat #2"]]);
  assert.equal(rows[0].associations.length, 2);
  assert.deepEqual(buildProposal([c, a, b], numLingoDexEntryVariants), rows);
});

test("names a multi-day chart as a collection", () => {
  const e = entry({ q1: "What is the man doing on Monday?", q2: "What is the man doing on Tuesday?",
    q3: "What is the man doing on Wednesday?", q4: "What is the man doing on Thursday?",
    a1: "planning", a2: "exercising", a3: "reading", a4: "farming", i1: "opaque•chart" });
  const [row] = buildProposal([e], numLingoDexEntryVariants);
  assert.equal(row.new_name, "man weekly activities");
  assert.equal(row.associations.length, 4);
  assert.equal(row.rule, "weekly-collection");
});

test("frozen proposal covers every legacy i* identifier with unique concise names and complete display provenance", async () => {
  const rows = buildProposal(LingoDexData, numLingoDexEntryVariants);
  assert.deepEqual(new Set(rows.map(r => r.old_name)), new Set(lingoDexUniqueImages));
  assert.equal(new Set(rows.map(r => r.new_name)).size, rows.length);
  assert(rows.every(r => r.base_name && r.base_name.split(" ").length <= 10 && !/[\t\r\n]/.test(r.new_name)));
  assert(rows.every(r => r.rule !== "keywords"));
  const source = new Map(LingoDexData.map(e => [e.devref, e]));
  const seen = new Set();
  for (const row of rows) for (const pair of row.associations) {
    const e = source.get(pair.devref);
    assert.equal(row.old_name, e[`i${pair.variant}`] || e.i1);
    assert.equal(pair.question, e[`q${pair.variant}`] || e.q1);
    assert.equal(pair.answer, e[`a${pair.variant}`]);
    const key = pair.devref + ":" + pair.variant;
    assert(!seen.has(key));
    seen.add(key);
  }
  const expectedCount = LingoDexData.reduce((count, e) => count + Array.from({ length: numLingoDexEntryVariants(e) }, (_, v) => Boolean(e[`i${v + 1}`] || e.i1)).filter(Boolean).length, 0);
  assert.equal(seen.size, expectedCount);
  assert.deepEqual(buildProposal([...LingoDexData].reverse(), numLingoDexEntryVariants), rows);
  const saved = await fs.readFile(new URL("../docs/image-names/old-to-new.tsv", import.meta.url), "utf8");
  assert.equal(saved, toTsv([["old_name", "new_name"], ...rows.map(r => [r.old_name, r.new_name])]));
});

test("TSV preserves exact identifiers containing quotes, tabs, or line breaks", () => {
  assert.equal(toTsv([["a\"b", "x\ty"], ["line\nbreak", "plain"]]), '"a""b"\t"x\ty"\n"line\nbreak"\tplain\n');
});
