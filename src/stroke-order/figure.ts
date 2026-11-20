// Platform-neutral geometry for single-image stroke views: numbered labels,
// direction arrows, order colours, and the animation timeline. Web and React
// Native renderers draw the same model, so this file has no DOM or React code.

import { getPenStrokes } from "./provider.js";
import type {
  StrokeCentreline,
  StrokeCharacterData,
  StrokeDataSource,
  StrokePoint,
} from "./types.js";

/**
 * Ways to show a character's stroke order. `STEPS` is the original
 * one-image-per-stroke diagram; the others draw the whole character once.
 */
export type StrokeView = "STEPS" | "NUMBERS" | "ARROWS" | "COLORS" | "ANIMATED";

export const STROKE_VIEWS: readonly StrokeView[] = [
  "STEPS",
  "NUMBERS",
  "ARROWS",
  "COLORS",
  "ANIMATED",
];

export const DEFAULT_STROKE_VIEW: StrokeView = "STEPS";

export function isStrokeView(value: unknown): value is StrokeView {
  return STROKE_VIEWS.includes(value as StrokeView);
}

/** Every view except `STEPS` draws from stroke centrelines. */
export function strokeViewNeedsCentrelines(view: StrokeView): boolean {
  return view !== "STEPS";
}

/**
 * Half the visible width of a stroke, as a fraction of the viewBox width. Used
 * to keep labels off the ink and to size the animated brush.
 */
const INK_RADIUS: Record<StrokeDataSource, number> = {
  KANJIVG: 0.028, // drawn as 5-unit lines on a 109-unit canvas
  ANIMCJK_JA: 0.045,
  ANIMCJK_ZH_HANT: 0.045,
  MAKEMEAHANZI: 0.045,
  CANTONESE_GLYPHWIKI: 0.032,
};

/** Stroke width used when drawing centreline-style (`STROKE`) paths. */
export const CENTRELINE_STROKE_WIDTH = 5;

/** Order colours: cool for early strokes, warm for late ones. All pass 4.5:1 with white text. */
const ORDER_COLOR_STOPS = [
  [0x25, 0x63, 0xeb],
  [0x0e, 0x74, 0x90],
  [0x15, 0x80, 0x3d],
  [0xa1, 0x62, 0x07],
  [0xc2, 0x41, 0x0c],
  [0xb9, 0x1c, 0x1c],
] as const;

export function strokeOrderColor(index: number, count: number): string {
  const t = count > 1 ? index / (count - 1) : 0;
  const scaled = t * (ORDER_COLOR_STOPS.length - 1);
  const lower = Math.min(Math.floor(scaled), ORDER_COLOR_STOPS.length - 2);
  const mix = scaled - lower;
  const a = ORDER_COLOR_STOPS[lower]!;
  const b = ORDER_COLOR_STOPS[lower + 1]!;
  return `#${[0, 1, 2]
    .map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * mix).toString(16).padStart(2, "0"))
    .join("")}`;
}

// ------------------------------------------------------------------ geometry

// Math.sqrt is markedly faster than Math.hypot in hot loops.
const distance = (a: StrokePoint, b: StrokePoint) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
};
const distanceSquared = (a: StrokePoint, b: StrokePoint) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};

export function centrelineLength(line: StrokeCentreline): number {
  let total = 0;
  for (let k = 1; k < line.length; k += 1) total += distance(line[k - 1]!, line[k]!);
  return total;
}

const round = (value: number) => Math.round(value * 10) / 10;
const point = ([x, y]: StrokePoint) => `${round(x)},${round(y)}`;

/** Drops consecutive points closer than `minimum`. */
function distinct(line: StrokeCentreline, minimum: number): StrokePoint[] {
  const out: StrokePoint[] = [];
  for (const p of line) {
    const last = out[out.length - 1];
    if (!last || distance(last, p) > minimum) out.push(p);
  }
  return out;
}

/**
 * A smooth SVG path through the points (centripetal Catmull-Rom as cubic
 * Béziers), which avoids the kinks of drawing sparse medians as polylines.
 */
export function smoothStrokePath(line: StrokeCentreline): string {
  const pts = distinct(line, 0.01);
  if (pts.length === 0) return "";
  if (pts.length < 3) return `M${pts.map(point).join(" L")}`;
  let d = `M${point(pts[0]!)}`;
  for (let k = 0; k < pts.length - 1; k += 1) {
    const p0 = pts[k - 1] ?? pts[k]!;
    const p1 = pts[k]!;
    const p2 = pts[k + 1]!;
    const p3 = pts[k + 2] ?? p2;
    const t01 = Math.sqrt(distance(p0, p1)) || 1e-6;
    const t12 = Math.sqrt(distance(p1, p2)) || 1e-6;
    const t23 = Math.sqrt(distance(p2, p3)) || 1e-6;
    const tangent = (a: StrokePoint, b: StrokePoint, c: StrokePoint, ta: number, tb: number) =>
      [0, 1].map((i) => c[i]! - b[i]! + t12 * ((b[i]! - a[i]!) / ta - (c[i]! - a[i]!) / (ta + tb)));
    const m1 = tangent(p0, p1, p2, t01, t12);
    const m2 = [0, 1].map(
      (i) => p2[i]! - p1[i]! + t12 * ((p3[i]! - p2[i]!) / t23 - (p3[i]! - p1[i]!) / (t12 + t23)),
    );
    const c1: StrokePoint = [p1[0] + m1[0]! / 3, p1[1] + m1[1]! / 3];
    const c2: StrokePoint = [p2[0] - m2[0]! / 3, p2[1] - m2[1]! / 3];
    d += ` C${point(c1)} ${point(c2)} ${point(p2)}`;
  }
  return d;
}

/** SVG path for a polyline (used for the animated brush). */
export function polylinePath(line: StrokeCentreline): string {
  return line.length ? `M${line.map(point).join(" L")}` : "";
}

function unit(dx: number, dy: number): StrokePoint {
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}

/** Start point and initial direction, measured a little way along the line. */
function startOf(line: StrokeCentreline, reach: number) {
  const start = line[0] ?? [0, 0];
  const ahead = line.find((p) => distance(p, start) >= reach) ?? line[line.length - 1] ?? start;
  return {
    point: start,
    direction: ahead === start ? ([0, 1] as StrokePoint) : unit(ahead[0] - start[0], ahead[1] - start[1]),
  };
}

/** Arrow body (trimmed so it does not poke through the tip) and head triangle. */
function arrowFor(line: StrokeCentreline, headLength: number) {
  const pts = distinct(line, 0.01);
  const end = pts[pts.length - 1];
  if (!end) return { body: "", head: "" };
  let back = pts.length - 2;
  while (back > 0 && distance(pts[back]!, end) < headLength) back -= 1;
  const from = pts[Math.max(back, 0)] ?? end;
  const [ux, uy] = from === end ? [0, 1] : unit(end[0] - from[0], end[1] - from[1]);
  const base: StrokePoint = [end[0] - ux * headLength, end[1] - uy * headLength];
  const wing = headLength * 0.55;
  const head = `M${point(end)} L${point([base[0] - uy * wing, base[1] + ux * wing])} L${point([
    base[0] + uy * wing,
    base[1] - ux * wing,
  ])} Z`;
  const trimmed = [...pts.slice(0, -1), [end[0] - ux * headLength * 0.7, end[1] - uy * headLength * 0.7] as StrokePoint];
  return { body: smoothStrokePath(trimmed), head };
}

// --------------------------------------------------------------- label layout

function segmentDistance(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function crosses(a: StrokePoint, b: StrokePoint, c: StrokePoint, d: StrokePoint): boolean {
  const side = (p: StrokePoint, q: StrokePoint, r: StrokePoint) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function seededRandom(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RING_COS = Array.from({ length: 8 }, (_, k) => Math.cos((k * Math.PI) / 4));
const RING_SIN = Array.from({ length: 8 }, (_, k) => Math.sin((k * Math.PI) / 4));
const CANDIDATES_PER_LABEL = 28;
const INK_GRID_CELLS = 96;

/**
 * Rasterises "within `radius` of a centreline" into a coarse grid over the
 * label bounds, so ink tests during layout are constant time.
 */
function inkGrid(
  centrelines: readonly StrokeCentreline[],
  radius: number,
  bounds: readonly [number, number, number, number],
): (p: StrokePoint) => boolean {
  const [minX, minY, maxX, maxY] = bounds;
  const cell = Math.max(maxX - minX, maxY - minY) / INK_GRID_CELLS;
  const columns = Math.ceil((maxX - minX) / cell) + 1;
  const rows = Math.ceil((maxY - minY) / cell) + 1;
  const grid = new Uint8Array(columns * rows);
  const mark = (a: StrokePoint, b: StrokePoint) => {
    const fromX = Math.max(0, Math.floor((Math.min(a[0], b[0]) - radius - minX) / cell));
    const toX = Math.min(columns - 1, Math.ceil((Math.max(a[0], b[0]) + radius - minX) / cell));
    const fromY = Math.max(0, Math.floor((Math.min(a[1], b[1]) - radius - minY) / cell));
    const toY = Math.min(rows - 1, Math.ceil((Math.max(a[1], b[1]) + radius - minY) / cell));
    for (let row = fromY; row <= toY; row += 1) {
      for (let column = fromX; column <= toX; column += 1) {
        const centre: StrokePoint = [minX + (column + 0.5) * cell, minY + (row + 0.5) * cell];
        if (segmentDistance(centre, a, b) < radius) grid[row * columns + column] = 1;
      }
    }
  };
  for (const line of centrelines) {
    if (line.length === 1) mark(line[0]!, line[0]!);
    for (let k = 1; k < line.length; k += 1) mark(line[k - 1]!, line[k]!);
  }
  return ([x, y]) => {
    const column = Math.floor((x - minX) / cell);
    const row = Math.floor((y - minY) / cell);
    return column >= 0 && row >= 0 && column < columns && row < rows && grid[row * columns + column] === 1;
  };
}

type LayoutInput = {
  anchors: readonly { point: StrokePoint; direction: StrokePoint }[];
  centrelines: readonly StrokeCentreline[];
  inkRadius: number;
  labelRadius: number;
  /** Area label centres must stay inside: [minX, minY, maxX, maxY]. */
  bounds: readonly [number, number, number, number];
};

/**
 * Places one label per stroke start. Labels prefer to sit just before the
 * stroke begins, may move into the margin with a leader line, and avoid ink,
 * each other, other stroke starts, and crossing leaders. A greedy placement is
 * refined by deterministic simulated annealing.
 */
export function layoutStrokeLabels({ anchors, centrelines, inkRadius, labelRadius: r, bounds }: LayoutInput): StrokePoint[] {
  const onInk = inkGrid(centrelines, inkRadius, bounds);
  const clamp = ([x, y]: StrokePoint): StrokePoint => [
    Math.min(bounds[2], Math.max(bounds[0], x)),
    Math.min(bounds[3], Math.max(bounds[1], y)),
  ];

  const rings = [1.35, 1.9, 2.6, 3.4, 4.4, 5.6, 7];
  const candidates = anchors.map(({ point: p, direction: d }) => {
    const preferred = clamp([p[0] - d[0] * r * 1.5, p[1] - d[1] * r * 1.5]);
    const spots: StrokePoint[] = [preferred];
    for (const ring of rings) {
      for (let k = 0; k < 16; k += 1) {
        const angle = (k * Math.PI) / 8;
        spots.push(clamp([p[0] + Math.cos(angle) * r * ring, p[1] + Math.sin(angle) * r * ring]));
      }
    }
    return spots
      .map((q) => {
        let ink = onInk(q) ? 2 : 0;
        for (let k = 0; k < 8; k += 1) {
          if (onInk([q[0] + RING_COS[k]! * r * 0.95, q[1] + RING_SIN[k]! * r * 0.95])) ink += 1;
        }
        return {
          q,
          cost: ink * 1.6 + (distance(q, p) / r) * 0.55 + (distance(q, preferred) / r) * 0.25,
        };
      })
      // Only the cheapest spots are worth exploring; this keeps annealing short.
      .sort((a, b) => a.cost - b.cost)
      .slice(0, CANDIDATES_PER_LABEL);
  });

  const n = anchors.length;
  const near = (r * 2.2) ** 2;
  const touching = (r * 1.25) ** 2;
  const pair = (i: number, qi: StrokePoint, j: number, qj: StrokePoint) => {
    let cost = 0;
    const gapSquared = distanceSquared(qi, qj);
    if (gapSquared < near) cost += 80 + ((r * 2.2 - Math.sqrt(gapSquared)) / r) * 30;
    const ai = anchors[i]!.point;
    const aj = anchors[j]!.point;
    if (distanceSquared(qi, aj) < touching) cost += 6;
    if (distanceSquared(qj, ai) < touching) cost += 6;
    if (crosses(ai, qi, aj, qj)) cost += 7;
    return cost;
  };
  const pick = new Array<number>(n).fill(-1);
  // Cost change of moving label i from its current spot to candidate k.
  const delta = (i: number, k: number) => {
    const next = candidates[i]![k]!;
    const current = candidates[i]![pick[i]!]!;
    let change = next.cost - current.cost;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const other = candidates[j]![pick[j]!]!.q;
      change += pair(i, next.q, j, other) - pair(i, current.q, j, other);
    }
    return change;
  };
  for (let i = 0; i < n; i += 1) {
    let best = 0;
    let bestCost = Infinity;
    for (let k = 0; k < candidates[i]!.length; k += 1) {
      const q = candidates[i]![k]!.q;
      let cost = candidates[i]![k]!.cost;
      for (let j = 0; j < i; j += 1) cost += pair(i, q, j, candidates[j]![pick[j]!]!.q);
      if (cost < bestCost) {
        bestCost = cost;
        best = k;
      }
    }
    pick[i] = best;
  }
  const random = seededRandom(n * 7919 + Math.round(r * 13));
  const iterations = 1200 + n * 120;
  for (let step = 0; step < iterations && n > 1; step += 1) {
    const temperature = 6 * Math.pow(0.02 / 6, step / iterations);
    const i = Math.floor(random() * n);
    const k = Math.floor(random() * candidates[i]!.length);
    if (k === pick[i]) continue;
    const change = delta(i, k);
    if (change < 0 || random() < Math.exp(-change / temperature)) pick[i] = k;
  }
  return pick.map((k, i) => candidates[i]![k]!.q);
}

// -------------------------------------------------------------------- figure

export type StrokeFigureLabel = {
  number: number;
  /** Where the stroke starts. */
  anchor: StrokePoint;
  /** Label centre. */
  center: StrokePoint;
  /** Leader from the stroke start to the label edge, when the label is away from it. */
  leader: readonly [StrokePoint, StrokePoint] | null;
};

export type StrokeFigureShape = {
  /** Index into `data.strokes`. */
  index: number;
  /** Brush path that reveals the shape when animating. */
  brush: string;
  brushLength: number;
  delayMs: number;
  durationMs: number;
};

export type StrokeFigurePenStroke = {
  number: number;
  color: string;
  label: StrokeFigureLabel;
  arrow: { body: string; head: string };
  shapes: readonly StrokeFigureShape[];
};

export type StrokeFigure = {
  /** Expanded viewBox with a margin for labels. */
  viewBox: string;
  /** The character's own canvas inside the margin. */
  frame: { x: number; y: number; width: number; height: number };
  labelRadius: number;
  labelFontSize: number;
  arrowWidth: number;
  /** Width of the animated brush for outline shapes. */
  brushWidth: number;
  /** Line width for centreline-style (`STROKE`) shapes. */
  strokeWidth: number;
  penStrokes: readonly StrokeFigurePenStroke[];
  animationMs: number;
};

export type StrokeFigureOptions = {
  /** Size the figure is designed for, in CSS pixels / points. */
  sizePx?: number;
  /** Label radius in CSS pixels / points; constant regardless of character size. */
  labelRadiusPx?: number;
};

const figureCache = new Map<string, StrokeFigure | null>();
const FIGURE_CACHE_LIMIT = 64;

/**
 * Builds the single-image model for a character, or `null` when its
 * centrelines were not loaded. Results are cached per character and size.
 */
export function getStrokeFigure(
  data: StrokeCharacterData,
  { sizePx = 208, labelRadiusPx = sizePx < 150 ? 6.5 : 8 }: StrokeFigureOptions = {},
): StrokeFigure | null {
  const centrelines = data.centrelines;
  if (!centrelines || centrelines.length !== data.strokes.length) return null;
  const key = `${data.source}:${data.character}:${data.strokes.length}:${sizePx}:${labelRadiusPx}`;
  const cached = figureCache.get(key);
  if (cached !== undefined) return cached;

  const [vx = 0, vy = 0, vw = 100, vh = 100] = data.viewBox.split(/\s+/u).map(Number);
  // Label radius in viewBox units such that it stays `labelRadiusPx` on screen
  // after the margin (2.3 radii on each side) is added around the canvas.
  const labelRadius = (labelRadiusPx * vw) / (sizePx - 4.6 * labelRadiusPx);
  const margin = 2.3 * labelRadius;
  const inkRadius = INK_RADIUS[data.source] * vw;
  const penStrokes = getPenStrokes(data);
  const anchors = penStrokes.map(([first]) => startOf(centrelines[first!]!, vw * 0.03));
  const centres = layoutStrokeLabels({
    anchors,
    centrelines,
    inkRadius,
    labelRadius,
    bounds: [
      vx - margin + labelRadius * 1.05,
      vy - margin + labelRadius * 1.05,
      vx + vw + margin - labelRadius * 1.05,
      vy + vh + margin - labelRadius * 1.05,
    ],
  });

  const arrowWidth = vw * 0.013;
  const pace = vw / 900; // viewBox units per millisecond while drawing
  let clock = 0;
  const figure: StrokeFigure = {
    viewBox: [vx - margin, vy - margin, vw + 2 * margin, vh + 2 * margin].map(round).join(" "),
    frame: { x: vx, y: vy, width: vw, height: vh },
    labelRadius,
    labelFontSize: labelRadius * 1.3,
    arrowWidth,
    brushWidth: inkRadius * 3.2,
    strokeWidth: CENTRELINE_STROKE_WIDTH,
    penStrokes: penStrokes.map((indexes, k) => {
      const anchor = anchors[k]!.point;
      const center = centres[k]!;
      const gap = distance(anchor, center);
      const shapes = indexes.map((index) => {
        const line = centrelines[index]!;
        const brushLength = centrelineLength(line);
        const durationMs = Math.round(Math.min(1100, Math.max(260, brushLength / pace)));
        const shape = { index, brush: polylinePath(line), brushLength: round(brushLength), delayMs: clock, durationMs };
        clock += durationMs;
        return shape;
      });
      clock += 160; // pen lift between strokes
      return {
        number: k + 1,
        color: strokeOrderColor(k, penStrokes.length),
        label: {
          number: k + 1,
          anchor,
          center,
          leader:
            gap > labelRadius * 1.05
              ? [anchor, [anchor[0] + ((center[0] - anchor[0]) * (gap - labelRadius)) / gap, anchor[1] + ((center[1] - anchor[1]) * (gap - labelRadius)) / gap]]
              : null,
        },
        arrow: arrowFor(centrelines[indexes[0]!]!, arrowWidth * 3.4),
        shapes,
      };
    }),
    animationMs: Math.max(0, clock - 160),
  };

  if (figureCache.size >= FIGURE_CACHE_LIMIT) {
    figureCache.delete(figureCache.keys().next().value!);
  }
  figureCache.set(key, figure);
  return figure;
}
