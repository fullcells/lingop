import assert from "node:assert/strict";
import test from "node:test";

import {
  flattenSvgPath,
  formatCentreline,
  simplifyPolyline,
} from "./stroke-centrelines.mjs";

test("flattenSvgPath follows absolute and relative curves", () => {
  const points = flattenSvgPath("M10,10c0,10,10,10,10,0s10-10,10,0", 4);
  assert.deepEqual(points[0], [10, 10]);
  assert.deepEqual(points.at(-1), [30, 10]);
  assert.equal(points.length, 9);
  assert.ok(points.slice(1, 4).every(([, y]) => y > 10)); // first arc bulges down
});

test("flattenSvgPath treats extra moveto pairs as line-tos", () => {
  assert.deepEqual(flattenSvgPath("M0 0 10 0 V5 h-10 z"), [
    [0, 0],
    [10, 0],
    [10, 5],
    [0, 5],
    [0, 0],
  ]);
});

test("simplifyPolyline drops points within tolerance", () => {
  assert.deepEqual(
    simplifyPolyline([[0, 0], [5, 0.1], [10, 0], [10, 10]], 0.5),
    [[0, 0], [10, 0], [10, 10]],
  );
});

test("formatCentreline rounds by canvas size", () => {
  assert.equal(formatCentreline([[1.26, 2.24], [50.04, 60.06]], 109), "1.3,2.2 50,60.1");
  assert.equal(formatCentreline([[1.4, 2.6], [500.5, 600.4]], 1024), "1,3 501,600");
});
