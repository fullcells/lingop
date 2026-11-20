import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { simplifyName, sourceDescription, sceneFacts, reviseName, buildPreview } from "./preview-lingodex-image-names.mjs";

const rows = (await fs.readFile(new URL("../docs/image-names/audit.jsonl", import.meta.url), "utf8")).trim().split("\n").map(JSON.parse);
const fixture = (old_name, base_name) => ({ old_name, base_name, new_name: base_name });

test("removes articles, diversity/style filler and redundant phrasing while keeping useful attributes", () => {
  const cases = [
    ["a bird playing a blue piano", "bird playing blue piano"],
    ["a group of diverse men hiking", "men hiking"],
    ["a fantasy hero thinking and choosing which door to open", "fantasy hero choosing door"],
    ["man on left reading book to sleeping girl on right", "man left reading book to sleeping girl right"],
    ["girl reading book in bed late night book almost finished", "girl almost finished reading book in bed late night"],
    ["woman behind man reading", "woman behind man reading"],
    ["dog not in here", "dog not in here"],
    ["person doing exercise and also listening to music", "person exercising and listening to music"],
    ["twenty two players on soccer field during soccer match", "22 players on soccer field"],
    ["three hundred sixty five days in one year", "365 days in 1 year"],
  ];
  for (const [before, after] of cases) assert.equal(simplifyName(before), after);
});

test("extracts prose from descriptive filename wrappers without interpreting identifiers", () => {
  assert.equal(sourceDescription("m4-basics-DALL·E 2024-07-06 14.23.39 - A room with no lights on."), "A room with no lights on.");
  assert.equal(sourceDescription("m1-go-a_man_inside_a_hospital_1720506595_standard"), "a man inside a hospital");
  assert.equal(sourceDescription("m4-basics-_271b1555-8663-453c-9530-6902875ce064"), null);
  assert.equal(sourceDescription("h-week-days"), null);
  assert.equal(sourceDescription("a clown. comic book style"), "a clown. ");
});

test("retains all three requested scene details", () => {
  const proposed = buildPreview(rows);
  const get = line => proposed.find(r => r.original_tsv_line === line);
  assert.equal(get(21).proposed_name, "car passing cyclist plane flying");
  assert.equal(get(26).proposed_name, "white dog at street end green door");
  assert.equal(get(35).proposed_name, "farmer hoping for rain dry crops");
});

test("distinguishes compound nouns, synonyms, group subjects and alternate prompt objects", () => {
  const facts = sceneFacts("An empty train platform under a moonlit sky.");
  assert(facts.some(f => f.phrase === "empty train platform"));
  assert(!facts.some(f => f.phrase === "empty train"));
  assert.equal(reviseName(fixture("An empty train platform under a moonlit sky.", "platform empty at night")).base_name, "train platform empty at night");
  assert(!reviseName(fixture("A child pointing at an airplane flying overhead.", "child pointing at plane")).base_name.includes("plane airplane"));
  assert(reviseName(fixture("A boy and a girl in different school uniforms.", "people not wearing same clothes")).base_name.startsWith("people "));
  assert(reviseName(fixture("3 people; 1 person carrying a basket of strawberries.", "person on right has least fruit")).base_name.startsWith("person "));
  assert(!reviseName(fixture("A person holding a trophy or ribbon.", "person excited about winning")).base_name.includes("trophy"));
  assert(!reviseName(fixture("A clown wearing a red ball on their nose. comic book style", "red ball on person nose")).base_name.includes("book"));
});

test("retains explicit subjects and avoids appending duplicate objects/actions", () => {
  assert.equal(reviseName(fixture("A female superhero with a white costume, carrying a cat.", "woman saving cat")).base_name, "woman superhero saving cat white costume");
  assert.equal(reviseName(fixture("A doctor in a white coat.", "person works as doctor")).base_name, "doctor white coat");
  const ball = reviseName(fixture("A black and white soccer ball.", "ball black and white")).base_name;
  assert.equal(ball, "soccer ball black and white");
  assert.equal(reviseName(fixture("An artist with a paintbrush, painting a landscape.", "person using paintbrush to paint picture")).base_name, "artist using paintbrush to paint picture");
});

test("complete preview remains deterministic, unique and preserves exact old identifiers", async () => {
  const proposed = buildPreview(rows);
  assert.equal(proposed.length, rows.length);
  assert.equal(new Set(proposed.map(r => r.proposed_name)).size, rows.length);
  assert.deepEqual(new Set(proposed.map(r => r.old_name)), new Set(rows.map(r => r.old_name)));
  assert(proposed.every(r => r.base_name && r.proposed_words <= 10 && !/\b(?:a|an|the|diverse)\b/.test(r.base_name)));
  assert.deepEqual(buildPreview([...rows].reverse()), proposed);
  const saved = await fs.readFile(new URL("../docs/image-names/old-to-new.v2.tsv", import.meta.url), "utf8");
  assert(saved.startsWith("old_name\tnew_name\n"));
  assert.equal(saved.trim().split("\n").length, rows.length + 1);
});
