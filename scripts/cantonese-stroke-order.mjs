// Derives writing order for KAGE (GlyphWiki) glyphs used by the Cantonese
// stroke-order supplement.
//
// KAGE lists strokes in the order a glyph was composed, not the order it is
// written, and it splits some pen strokes into several font fragments. This
// module rebuilds the writing order component by component:
//
// 1. Walk the KAGE component tree from the root. The largest component that
//    has a reference character with known order (AnimCJK zh-Hant, then Make Me
//    a Hanzi, then AnimCJK zh-Hans/ja) is matched stroke by stroke against the
//    reference centrelines, choosing the fragment joins that fit best.
// 2. Components without a usable reference are split into their parts, which
//    are ordered left-to-right or top-to-bottom.
// 3. The result is checked against the Rime/CNS11643 stroke-type sequences for
//    the character; the best-matching sequence is recorded with the strokes.
//
// Reference medians are only read at maintenance time; they are not copied into
// the committed data.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const TRADITIONAL_REFERENCE = "AnimCJK zh-Hant";

/**
 * Characters with no reference of their own, matched against a close relative
 * that has extra strokes (冇 is 有 without its two inner strokes).
 */
const ROOT_RELATIVES = { 冇: "有" };

/** Loose strokes inside a character, matched against the character they form. */
const LOOSE_STROKE_REFERENCES = { 𨋢: "立" };

/**
 * Components with no reference, described as reference characters built from
 * their parts. "loose" stands for the component's own (non-component) strokes.
 * 𥁕 (the Traditional form of 昷) is 囚 above 皿; 囚's frame is drawn as loose
 * strokes around a 人 component.
 */
const COMPOSED_COMPONENTS = {
  𥁕: [
    ["囚", ["loose", "人"]],
    ["皿", ["皿"]],
  ],
};

/** Joins between neighbouring KAGE fragments may leave a small design gap. */
const MAX_NEIGHBOUR_GAP = 24;
/** Fragments that are not neighbours in KAGE order must touch exactly. */
const MAX_DISTANT_GAP = 1.5;
const MAX_JOIN_CANDIDATES = 14;
const MAX_JOIN_COMBINATIONS = 600;
/** Mean normalised distance above which a reference match is rejected. */
const MAX_REFERENCE_COST = 0.36;

export function createReferenceLoader(repositoryRoot) {
  const root = path.join(repositoryRoot, "node_modules/hanzi-writer-data-acjk");
  const sets = [
    [TRADITIONAL_REFERENCE, path.join(root, "animCJK/ZhHant")],
    ["Make Me a Hanzi", path.join(root, "makemeahanzi")],
    ["AnimCJK zh-Hans", path.join(root, "animCJK/ZhHans")],
    ["AnimCJK ja", path.join(root, "animCJK/Ja")],
  ];
  const cache = new Map();
  return (character) => {
    if (!cache.has(character)) {
      const references = [];
      for (const [label, directory] of sets) {
        const file = path.join(directory, `${character}.json`);
        if (!existsSync(file)) continue;
        const { medians } = JSON.parse(readFileSync(file, "utf8"));
        references.push({
          label,
          character,
          // Hanzi Writer data is Y-up; flip it into the KAGE/SVG Y-down space.
          medians: medians.map((median) => median.map(([x, y]) => [x, 900 - y])),
        });
      }
      cache.set(character, references);
    }
    return cache.get(character);
  };
}

// ---------------------------------------------------------------- geometry

function bezier(points, steps) {
  const out = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    let level = points;
    while (level.length > 1) {
      level = level
        .slice(1)
        .map((point, index) => [
          level[index][0] + (point[0] - level[index][0]) * t,
          level[index][1] + (point[1] - level[index][1]) * t,
        ]);
    }
    out.push(level[0]);
  }
  return out;
}

/** Approximate centreline of one KAGE stroke primitive, in writing direction. */
export function primitiveCentreline(stroke) {
  const points = [
    [stroke.x1, stroke.y1],
    [stroke.x2, stroke.y2],
    [stroke.x3, stroke.y3],
    [stroke.x4, stroke.y4],
  ].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  switch (stroke.a1_100) {
    case 2: // curve
      return bezier(points.slice(0, 3), 12);
    case 6: // complex curve
      return bezier(points.slice(0, 4), 16);
    case 7: // vertical then slash
      return [points[0], ...bezier(points.slice(1, 4), 12)];
    case 3: // bend
      return [points[0], ...bezier([points[1], points[1], points[2]], 4)];
    default:
      return points;
  }
}

function primitiveEnd(stroke) {
  for (const suffix of ["4", "3", "2"]) {
    const x = stroke[`x${suffix}`];
    const y = stroke[`y${suffix}`];
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  }
  throw new Error("KAGE primitive has no finite endpoint.");
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polylineLength = (line) =>
  line.slice(1).reduce((sum, point, index) => sum + distance(point, line[index]), 0);

function resample(line, count = 10) {
  const total = polylineLength(line) || 1;
  const out = [];
  for (let k = 0; k < count; k += 1) {
    let remaining = (k / (count - 1)) * total;
    let index = 0;
    while (
      index < line.length - 2 &&
      remaining > distance(line[index + 1], line[index])
    ) {
      remaining -= distance(line[index + 1], line[index]);
      index += 1;
    }
    const a = line[index];
    const b = line[Math.min(index + 1, line.length - 1)];
    const t = Math.min(1, remaining / (distance(a, b) || 1));
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function bounds(lines) {
  const points = lines.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function unitSquare(lines) {
  const [left, top, right, bottom] = bounds(lines);
  const width = Math.max(right - left, 1);
  const height = Math.max(bottom - top, 1);
  return ([x, y]) => [(x - left) / width, (y - top) / height];
}

function curveCost(a, b) {
  const A = resample(a);
  const B = resample(b);
  let sum = 0;
  for (let index = 0; index < A.length; index += 1) sum += distance(A[index], B[index]);
  return (
    sum / A.length +
    0.5 * distance(A[0], B[0]) +
    0.25 * Math.abs(polylineLength(a) - polylineLength(b))
  );
}

/** Minimum-cost assignment for rows <= columns; returns row -> column. */
export function hungarian(costs) {
  const rows = costs.length;
  const columns = costs[0].length;
  const u = new Array(rows + 1).fill(0);
  const v = new Array(columns + 1).fill(0);
  const owner = new Array(columns + 1).fill(0);
  const way = new Array(columns + 1).fill(0);
  for (let row = 1; row <= rows; row += 1) {
    owner[0] = row;
    let column0 = 0;
    const minimum = new Array(columns + 1).fill(Infinity);
    const used = new Array(columns + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = owner[column0];
      let delta = Infinity;
      let column1 = 0;
      for (let column = 1; column <= columns; column += 1) {
        if (used[column]) continue;
        const reduced = costs[row0 - 1][column - 1] - u[row0] - v[column];
        if (reduced < minimum[column]) {
          minimum[column] = reduced;
          way[column] = column0;
        }
        if (minimum[column] < delta) {
          delta = minimum[column];
          column1 = column;
        }
      }
      for (let column = 0; column <= columns; column += 1) {
        if (used[column]) {
          u[owner[column]] += delta;
          v[column] -= delta;
        } else {
          minimum[column] -= delta;
        }
      }
      column0 = column1;
    } while (owner[column0] !== 0);
    do {
      const column1 = way[column0];
      owner[column0] = owner[column1];
      column0 = column1;
    } while (column0);
  }
  const assignment = new Array(rows);
  for (let column = 1; column <= columns; column += 1) {
    if (owner[column]) assignment[owner[column] - 1] = column - 1;
  }
  return assignment;
}

/**
 * Orders strokes by the reference stroke each one matches. Both sides are
 * normalised to their own bounds, so a squeezed component still matches its
 * standalone reference. A centreline that fits better reversed is flipped to
 * the reference's writing direction.
 */
export function matchToReference(strokes, reference) {
  const toStrokeUnit = unitSquare(strokes.map((stroke) => stroke.line));
  const toReferenceUnit = unitSquare(reference.medians);
  const K = strokes.map((stroke) => stroke.line.map(toStrokeUnit));
  const R = reference.medians.map((median) => median.map(toReferenceUnit));
  const costs = K.map((k) => R.map((r) => curveCost(k, r)));
  const assignment = hungarian(costs);
  const cost =
    assignment.reduce((sum, column, row) => sum + costs[row][column], 0) /
    strokes.length;
  const ordered = strokes.map((stroke, row) => {
    const column = assignment[row];
    const reversed = curveCost([...K[row]].reverse(), R[column]) < costs[row][column] * 0.6;
    return {
      column,
      stroke: reversed ? { ...stroke, line: [...stroke.line].reverse() } : stroke,
    };
  });
  ordered.sort((a, b) => a.column - b.column);
  return { order: ordered.map(({ stroke }) => stroke), cost };
}

// ------------------------------------------------------- stroke-type sequence

/** Rough Rime/CNS stroke type: h 橫, s 豎, p 撇, n 點/捺, z 折. */
export function classifyStroke(stroke) {
  const line = stroke.line;
  const [x0, y0] = line[0];
  const [x1, y1] = line[line.length - 1];
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (stroke.kinds.length > 1 || [3, 4, 6].includes(stroke.kinds[0])) return "z";
  if (stroke.kinds[0] === 7) return "p";
  if (Math.abs(dx) >= Math.abs(dy) * 1.2) {
    if (dy > Math.abs(dx) * 0.45) return dx < 0 ? "p" : "n";
    return "h";
  }
  if (Math.abs(dx) < Math.abs(dy) * 0.25) return "s";
  return dx < 0 ? "p" : "n";
}

/** Stroke-type pairs that geometry alone cannot reliably tell apart. */
const similarTypes = (a, b) => a === b || /^(pn|np|sz|zs|hz|zh)$/u.test(a + b);
const clearMismatches = (types, sequence) =>
  [...sequence].filter((type, index) => !similarTypes(type, types[index])).length;

/**
 * Picks the stroke-type sequence that best fits the derived order, then swaps
 * neighbouring strokes when doing so turns two mismatches into exact matches
 * (for example 巨, whose 一 and 丨 start at the same corner).
 */
export function alignToSequence(strokes, sequences) {
  const ordered = [...strokes];
  let types = ordered.map(classifyStroke).join("");
  const candidates = sequences.filter((sequence) => sequence.length === ordered.length);
  if (candidates.length === 0) {
    throw new Error(
      `derived ${ordered.length} strokes, but no stroke-type sequence has that count (${sequences.join(", ")})`,
    );
  }
  const sequence = [...candidates].sort(
    (a, b) => clearMismatches(types, a) - clearMismatches(types, b),
  )[0];
  const swaps = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    if (
      types[index] !== sequence[index] &&
      types[index + 1] !== sequence[index + 1] &&
      types[index] === sequence[index + 1] &&
      types[index + 1] === sequence[index]
    ) {
      [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
      swaps.push(index + 1);
      types = ordered.map(classifyStroke).join("");
    }
  }
  return {
    strokes: ordered,
    sequence,
    types,
    swaps,
    mismatches: clearMismatches(types, sequence),
  };
}

// ----------------------------------------------------------------- KAGE tree

const characterOfGlyph = (name) => {
  const match = /^u([0-9a-f]{4,5})(?![0-9a-f])/u.exec(name);
  return match ? String.fromCodePoint(Number.parseInt(match[1], 16)) : null;
};
const range = (start, end) => Array.from({ length: end - start }, (_, k) => start + k);
const bare = (name) => name.split("@")[0];

function prepareGlyph({ Kage, rootName, records }) {
  const kage = new Kage();
  for (const [name, data] of Object.entries(records)) kage.kBuhin.push(name, data);
  const recordOf = (name) => {
    const data = records[name] ?? records[bare(name)];
    if (data === undefined) throw new Error(`Missing KAGE record ${name}.`);
    return data;
  };
  const rootData = recordOf(rootName);
  const primitives = kage.getEachStrokes(rootData);
  const outlines = kage.makeGlyph3(rootData).map((polygons) => {
    polygons.normalizeWinding();
    return [...polygons.generateSVG(true).matchAll(/\bd="([^"]+)"/gu)]
      .map((match) => match[1])
      .join(" ");
  });
  if (outlines.length !== primitives.length) {
    throw new Error(`${outlines.length} KAGE outlines for ${primitives.length} primitives.`);
  }

  // Component tree; getEachStrokes expands components depth-first, so each
  // component owns a contiguous range of primitives.
  let cursor = 0;
  const visit = (name) => {
    const node = { name, character: characterOfGlyph(name), start: cursor, children: [] };
    for (const line of recordOf(name).split("$")) {
      const columns = line.split(":");
      if (columns[0] === "99") {
        node.children.push(visit(columns[7]));
      } else if (columns[0] !== "0" && line.trim()) {
        const count = kage.getEachStrokes(line).length;
        for (let k = 0; k < count; k += 1) node.children.push({ loose: cursor + k });
        cursor += count;
      }
    }
    node.end = cursor;
    return node;
  };
  const tree = visit(rootName);
  if (tree.end !== primitives.length) {
    throw new Error(`KAGE tree covers ${tree.end} of ${primitives.length} primitives.`);
  }

  const gap = (from, to) => distance(primitiveEnd(primitives[from]), [primitives[to].x1, primitives[to].y1]);
  const makeStroke = (fragments) => ({
    fragments,
    path: fragments.map((index) => outlines[index]).join(" "),
    line: fragments.flatMap((index, k) =>
      primitiveCentreline(primitives[index]).slice(k ? 1 : 0),
    ),
    kinds: fragments.map((index) => primitives[index].a1_100),
  });

  // Every way of joining fragments into `target` pen strokes, where each join
  // links a fragment's end to another's start.
  const joinings = (indexes, target) => {
    const sorted = [...indexes].sort((a, b) => a - b);
    const needed = sorted.length - target;
    if (needed < 0) return [];
    const candidates = [];
    for (const from of sorted) {
      for (const to of sorted) {
        if (from === to) continue;
        const size = gap(from, to);
        if (size < (to === from + 1 ? MAX_NEIGHBOUR_GAP : MAX_DISTANT_GAP)) {
          candidates.push({ from, to, size });
        }
      }
    }
    candidates.sort((a, b) => a.size - b.size).splice(MAX_JOIN_CANDIDATES);
    const results = [];
    const next = new Map();
    const previous = new Map();
    const choose = (start, chosen) => {
      if (results.length >= MAX_JOIN_COMBINATIONS) return;
      if (chosen === needed) {
        results.push(new Map(next));
        return;
      }
      for (let k = start; k < candidates.length; k += 1) {
        const { from, to } = candidates[k];
        if (next.has(from) || previous.has(to)) continue;
        let head = from;
        while (previous.has(head)) head = previous.get(head);
        let tail = to;
        while (next.has(tail)) tail = next.get(tail);
        if (head === tail) continue; // would close a loop
        next.set(from, to);
        previous.set(to, from);
        choose(k + 1, chosen + 1);
        next.delete(from);
        previous.delete(to);
      }
    };
    choose(0, 0);
    return results.map((links) => {
      const linked = new Set(links.values());
      return sorted
        .filter((index) => !linked.has(index))
        .map((head) => {
          const chain = [head];
          while (links.has(chain.at(-1))) chain.push(links.get(chain.at(-1)));
          return makeStroke(chain);
        });
    });
  };

  const bestMatch = (indexes, target, reference) => {
    let best = null;
    for (const strokes of joinings(indexes, target)) {
      const match = matchToReference(strokes, reference);
      if (!best || match.cost < best.cost) best = match;
    }
    return best;
  };

  return { tree, bestMatch };
}

function layoutOrder(units) {
  const box = (unit) => bounds(unit.strokes.map((stroke) => stroke.line));
  return [...units].sort((a, b) => {
    const A = box(a);
    const B = box(b);
    const overlap =
      Math.max(0, Math.min(A[2], B[2]) - Math.max(A[0], B[0])) /
      Math.min(A[2] - A[0] || 1, B[2] - B[0] || 1);
    // Side by side: left to right. Otherwise: top to bottom.
    return overlap < 0.35
      ? A[0] + A[2] - (B[0] + B[2])
      : A[1] + A[3] - (B[1] + B[3]);
  });
}

/**
 * @param {object} input
 * @param {string} input.character
 * @param {string} input.rootName KAGE glyph name of the character.
 * @param {Record<string, string>} input.records KAGE data by glyph name.
 * @param {string[]} input.sequences Rime/CNS stroke-type sequences.
 * @param {(character: string) => Array<{label: string, character: string, medians: number[][][]}>} input.references
 * @param {typeof import("@kurgm/kage-engine").Kage} input.Kage
 */
export function deriveStrokeOrder({ character, rootName, records, sequences, references, Kage }) {
  const glyph = prepareGlyph({ Kage, rootName, records });
  const used = [];
  const loose = (node) => node.children.filter((child) => "loose" in child).map((child) => child.loose);

  const split = (node) => {
    const units = [];
    for (const child of node.children) if (!("loose" in child)) units.push(...order(child, false));
    const looseIndexes = loose(node);
    if (looseIndexes.length) {
      const relative = LOOSE_STROKE_REFERENCES[character];
      const reference = relative && references(relative)[0];
      const match =
        reference && glyph.bestMatch(looseIndexes, reference.medians.length, reference);
      if (!match) {
        throw new Error(
          `${looseIndexes.length} loose KAGE fragments in ${node.name} have no reference; add one to LOOSE_STROKE_REFERENCES.`,
        );
      }
      used.push([relative, reference.label]);
      units.push({ strokes: match.order, label: reference.label });
    }
    return layoutOrder(units);
  };

  const order = (node, isRoot) => {
    const indexes = range(node.start, node.end);

    const composition = COMPOSED_COMPONENTS[node.character];
    if (composition) {
      return composition.map(([part, members]) => {
        const partIndexes = members.flatMap((member) => {
          if (member === "loose") return loose(node);
          const child = node.children.find((candidate) => candidate.character === member);
          if (!child) throw new Error(`${node.name} has no ${member} component.`);
          return range(child.start, child.end);
        });
        const reference = references(part)[0];
        const match =
          reference && glyph.bestMatch(partIndexes, reference.medians.length, reference);
        if (!match) throw new Error(`Could not match ${part} inside ${node.name}.`);
        used.push([part, reference.label]);
        return { strokes: match.order, label: reference.label };
      });
    }

    const relative = isRoot ? ROOT_RELATIVES[character] : undefined;
    const candidates = [
      ...(node.character ? references(node.character) : []),
      ...(relative
        ? references(relative).map((reference) => ({ ...reference, relative: true }))
        : []),
    ];
    const options = [];
    for (const [priority, reference] of candidates.entries()) {
      const count = reference.medians.length;
      // A relative may have extra strokes; a component may differ by one or
      // two (for example a left-side variant that merges strokes).
      const targets = reference.relative
        ? [...new Set(sequences.map((sequence) => sequence.length))]
        : [count, count - 1, count - 2];
      for (const target of targets) {
        if (target <= 0 || target > count) continue;
        const match = glyph.bestMatch(indexes, target, reference);
        if (!match || match.cost > MAX_REFERENCE_COST) continue;
        options.push({ reference, match, exact: target === count, priority });
      }
    }
    const traditional = (option) => (option.reference.label === TRADITIONAL_REFERENCE ? 1 : 0);
    options.sort(
      (a, b) =>
        b.exact - a.exact ||
        traditional(b) - traditional(a) ||
        b.match.order.length - a.match.order.length ||
        a.priority - b.priority,
    );

    // Prefer zh-Hant parts over a whole-component match from another standard
    // (Make Me a Hanzi follows mainland order, e.g. 忄 as 丶丶丨 not 丶丨丶).
    const hasComponents = node.children.some((child) => !("loose" in child));
    if (options.length && !traditional(options[0]) && hasComponents) {
      const usedBefore = used.length;
      try {
        const parts = split(node);
        if (parts.every((unit) => unit.label === TRADITIONAL_REFERENCE)) return parts;
      } catch {
        // fall back to the whole-component match below
      }
      used.length = usedBefore;
    }

    if (options.length) {
      const { reference, match } = options[0];
      used.push([
        node.character,
        reference.relative ? `${reference.label} (${reference.character})` : reference.label,
      ]);
      return [{ strokes: match.order, label: reference.label }];
    }
    if (!hasComponents && loose(node).length === 0) {
      throw new Error(`No reference for ${node.name}.`);
    }
    return split(node);
  };

  const derived = order(glyph.tree, true).flatMap((unit) => unit.strokes);
  const aligned = alignToSequence(derived, sequences);
  return {
    character,
    strokes: aligned.strokes.map((stroke) => stroke.path),
    centrelines: aligned.strokes.map((stroke) => stroke.line),
    fragmentOrder: aligned.strokes.map((stroke) => stroke.fragments),
    strokeOrder: aligned.sequence,
    derivedTypes: aligned.types,
    typeMismatches: aligned.mismatches,
    swaps: aligned.swaps,
    references: Object.fromEntries(used),
  };
}
