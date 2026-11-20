import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Kage } from "@kurgm/kage-engine";

import {
  alignToSequence,
  createReferenceLoader,
  deriveStrokeOrder,
  hungarian,
  matchToReference,
} from "./cantonese-stroke-order.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "scripts/fixtures/cantonese-stroke-order-kage.json"),
    "utf8",
  ),
);
const references = createReferenceLoader(repositoryRoot);

function derive(character) {
  return deriveStrokeOrder({ character, ...fixture.characters[character], references, Kage });
}

// One straight stroke from `from` to `to`, as a single KAGE line primitive.
const line = (from, to) => ({ line: [from, to], kinds: [1], fragments: [] });

test("hungarian finds the cheapest one-to-one assignment", () => {
  assert.deepEqual(
    hungarian([
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]),
    [1, 0, 2],
  );
});

test("matchToReference orders strokes by the reference they resemble", () => {
  const horizontal = line([0, 0], [100, 0]);
  const vertical = line([50, 0], [50, 100]);
  const { order } = matchToReference([vertical, horizontal], {
    medians: [
      [[0, 0], [100, 0]],
      [[50, 0], [50, 100]],
    ],
  });
  assert.deepEqual(order, [horizontal, vertical]);
});

test("matchToReference flips a centreline drawn against writing direction", () => {
  const { order } = matchToReference(
    [line([100, 0], [0, 0]), line([50, 0], [50, 100])],
    { medians: [[[0, 0], [100, 0]], [[50, 0], [50, 100]]] },
  );
  assert.deepEqual(order[0].line, [[0, 0], [100, 0]]);
});

test("alignToSequence swaps neighbours that start at the same corner", () => {
  const vertical = line([0, 0], [0, 100]);
  const horizontal = line([0, 0], [100, 0]);
  const aligned = alignToSequence([vertical, horizontal], ["hs"]);
  assert.deepEqual(aligned.strokes, [horizontal, vertical]);
  assert.deepEqual(aligned.swaps, [1]);
  assert.equal(aligned.mismatches, 0);
});

test("alignToSequence refuses a stroke count no sequence allows", () => {
  assert.throws(() => alignToSequence([line([0, 0], [1, 0])], ["hs"]), /no stroke-type sequence/);
});

for (const character of ["嚟", "搵"]) {
  test(`${character} derives one stroke per sequence entry from references`, () => {
    const derived = derive(character);
    assert.equal(derived.strokes.length, derived.strokeOrder.length);
    assert.ok(Object.keys(derived.references).length > 1);
    // Every KAGE fragment is used exactly once.
    const fragments = derived.fragmentOrder.flat().sort((a, b) => a - b);
    assert.deepEqual(fragments, fragments.map((_, index) => index));
  });
}

test("冇 is matched against 有 and keeps only its own four strokes", () => {
  const derived = derive("冇");
  assert.deepEqual(derived.fragmentOrder.slice(0, 2), [[1], [0]]); // 一 before 丿
  assert.equal(derived.strokeOrder, "hppz");
  assert.equal(derived.references["冇"], "AnimCJK zh-Hant (有)");
});

test("佢 follows the Traditional order of 巨 (top 一 before the left 丨)", () => {
  const derived = derive("佢");
  assert.equal(derived.strokeOrder, "pshszhh");
  assert.deepEqual(derived.swaps, [3]);
  assert.deepEqual(derived.fragmentOrder.slice(2, 4), [[3], [2]]);
});

test("committed Cantonese entries carry a matching sequence and their references", async () => {
  const { entries } = JSON.parse(
    await readFile(path.join(repositoryRoot, "data/stroke-order/cantonese-glyphwiki.json"), "utf8"),
  );
  for (const [character, entry] of Object.entries(entries)) {
    assert.equal(entry.strokes.length, entry.strokeOrder.length, character);
    assert.ok(Object.keys(entry.orderReferences ?? {}).length > 0, character);
  }
});
