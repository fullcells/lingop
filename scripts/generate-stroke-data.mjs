import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tify } from "chinese-conv";

import { flattenSvgPath, formatCentreline } from "./stroke-centrelines.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputRoot = path.join(repositoryRoot, "src/stroke-order/generated");
const hanPattern = /^\p{Script=Han}$/u;
const japaneseCharacterPattern =
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u;

const sources = [
  {
    id: "KANJIVG",
    directory: path.join(repositoryRoot, "node_modules/kanjivg-js/kanji"),
    kind: "kanjivg",
    characterPattern: hanPattern,
  },
  {
    id: "ANIMCJK_JA",
    directory: path.join(
      repositoryRoot,
      "node_modules/@k1low/hanzi-writer-data-jp",
    ),
    kind: "hanzi-writer",
    characterPattern: japaneseCharacterPattern,
  },
  {
    id: "ANIMCJK_ZH_HANT",
    directory: path.join(
      repositoryRoot,
      "node_modules/hanzi-writer-data-acjk/animCJK/ZhHant",
    ),
    kind: "hanzi-writer",
    characterPattern: hanPattern,
  },
  {
    id: "MAKEMEAHANZI",
    directory: path.join(
      repositoryRoot,
      "node_modules/hanzi-writer-data-acjk/makemeahanzi",
    ),
    kind: "hanzi-writer",
    characterPattern: hanPattern,
    traditionalOnly: true,
  },
  {
    id: "CANTONESE_GLYPHWIKI",
    file: path.join(
      repositoryRoot,
      "data/stroke-order/cantonese-glyphwiki.json",
    ),
    kind: "prebuilt-json",
    characterPattern: hanPattern,
  },
];

function bucketForCharacter(character) {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) throw new Error("Cannot bucket an empty character.");
  return Math.floor(codePoint / 256).toString(16).padStart(2, "0");
}

function characterFromKanjiVGFilename(filename) {
  const match = /^([0-9a-f]{5})\.svg$/i.exec(filename);
  if (!match) return null;
  return String.fromCodePoint(Number.parseInt(match[1], 16));
}

function pathsFromKanjiVG(svg) {
  const paths = [];
  for (const match of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)) {
    paths.push(match[1]);
  }
  return paths;
}

// Hanzi Writer data is Y-up; centrelines are stored in display coordinates
// (after the "translate(0 900) scale(1 -1)" presentation transform).
const hanziWriterCentrelines = (medians) =>
  medians.map((median) =>
    formatCentreline(median.map(([x, y]) => [x, 900 - y]), 1024),
  );

async function readSourceEntries(source) {
  if (source.kind === "prebuilt-json") {
    const parsed = JSON.parse(await readFile(source.file, "utf8"));
    const entries = [];
    for (const [character, entry] of Object.entries(parsed.entries ?? {})) {
      if (
        !source.characterPattern.test(character) ||
        !Array.isArray(entry.strokes) ||
        entry.strokes.length === 0 ||
        entry.strokeOrder?.length !== entry.strokes.length ||
        entry.centrelines?.length !== entry.strokes.length ||
        ![...entry.strokes, ...entry.centrelines].every(
          (value) => typeof value === "string",
        )
      ) {
        throw new Error(`Invalid prebuilt stroke data for ${character}.`);
      }
      entries.push([character, entry.strokes, entry.centrelines]);
    }
    return { entries, continuations: [] };
  }

  const filenames = (await readdir(source.directory)).sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const entries = [];
  const continuations = [];

  for (const filename of filenames) {
    if (source.kind === "kanjivg") {
      const character = characterFromKanjiVGFilename(filename);
      if (
        !character ||
        !source.characterPattern.test(character) ||
        (source.traditionalOnly && tify(character) !== character)
      ) {
        continue; // Ignore variants and characters this adapter never serves.
      }
      const svg = await readFile(path.join(source.directory, filename), "utf8");
      const strokes = pathsFromKanjiVG(svg);
      if (strokes.length > 0) {
        // KanjiVG paths are centrelines already (drawn with a stroke width).
        const centrelines = strokes.map((d) =>
          formatCentreline(flattenSvgPath(d), 109),
        );
        entries.push([character, strokes, centrelines]);
      }
      continue;
    }

    if (!filename.endsWith(".json")) continue;
    const character = filename.slice(0, -5);
    if (
      [...character].length !== 1 ||
      !source.characterPattern.test(character) ||
      (source.traditionalOnly && tify(character) !== character)
    ) {
      continue;
    }
    const parsed = JSON.parse(
      await readFile(path.join(source.directory, filename), "utf8"),
    );
    if (
      Array.isArray(parsed.strokes) &&
      parsed.strokes.length > 0 &&
      parsed.strokes.every((stroke) => typeof stroke === "string")
    ) {
      // Without one median per stroke, views needing centrelines fall back
      // to the step-by-step diagram.
      const centrelines =
        parsed.medians?.length === parsed.strokes.length
          ? hanziWriterCentrelines(parsed.medians)
          : [];
      entries.push([character, parsed.strokes, centrelines]);
      const indexes = continuationIndexes(parsed.medians);
      if (indexes.length > 0) continuations.push([character, indexes]);
    }
  }

  return { entries, continuations };
}

const pointKey = ([x, y]) => `${x},${y}`;

// AnimCJK splits some looped kana strokes (あ, ぬ, ね, の, る…) into two shapes so
// the overlapping parts can be animated in order. The second shape reuses most
// of the previous stroke's median and often starts off-canvas. It is one pen
// stroke with the previous one, so renderers should show them as one step.
// (Identical consecutive medians, as in 隗 and 霆, are separate strokes.)
function continuationIndexes(medians) {
  if (!Array.isArray(medians)) return [];
  const indexes = [];
  medians.forEach((median, index) => {
    if (index === 0 || !Array.isArray(median) || median.length === 0) return;
    const [x, y] = median[0];
    const offCanvas = x < -50 || x > 1074 || y < -174 || y > 1074;
    const previous = medians[index - 1];
    const previousPoints = new Set(previous.map(pointKey));
    const shared = median.filter((point) => previousPoints.has(pointKey(point))).length;
    const identical = shared === median.length && median.length === previous.length;
    if (offCanvas || (shared >= 4 && !identical)) indexes.push(index);
  });
  return indexes;
}

function sourceDirectoryName(sourceId) {
  return sourceId.toLowerCase().replaceAll("_", "-");
}

async function writeBuckets(directory, buckets, column, typeName) {
  await mkdir(directory, { recursive: true });
  for (const [bucket, bucketEntries] of buckets) {
    const record = Object.fromEntries(
      bucketEntries.map((entry) => [entry[0], entry[column]]),
    );
    await writeFile(
      path.join(directory, `${bucket}.ts`),
      [
        `import type { ${typeName} } from "../../types.js";`,
        "",
        `const data: ${typeName} = ${JSON.stringify(record)};`,
        "",
        "export default data;",
        "",
      ].join("\n"),
    );
  }
}

// Outline paths and centrelines share bucket keys but load separately, so the
// default step-by-step view never downloads centrelines.
async function writeSource(source, entries) {
  const buckets = new Map();
  for (const entry of entries) {
    const bucket = bucketForCharacter(entry[0]);
    const bucketEntries = buckets.get(bucket) ?? [];
    bucketEntries.push(entry);
    buckets.set(bucket, bucketEntries);
  }
  const sorted = [...buckets]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([bucket, bucketEntries]) => [
      bucket,
      bucketEntries.sort(([left], [right]) => left.localeCompare(right, "en")),
    ]);

  const directoryName = sourceDirectoryName(source.id);
  await writeBuckets(path.join(outputRoot, directoryName), sorted, 1, "StrokePathBucket");
  await writeBuckets(
    path.join(outputRoot, `${directoryName}-centrelines`),
    sorted,
    2,
    "StrokeCentrelineBucket",
  );
  return sorted.map(([bucket]) => bucket);
}

function loaderSource(generatedSources, browserAssets = false) {
  const lines = [
    "import type {",
    "  StrokeBucketLoader,",
    "  StrokeCentrelineBucketLoader,",
    "  StrokeDataSource,",
    '} from "./types.js";',
    "",
    "// Generated by scripts/generate-stroke-data.mjs. Do not edit.",
    "export const GENERATED_STROKE_BUCKET_LOADERS: Record<",
    "  StrokeDataSource,",
    "  Readonly<Record<string, StrokeBucketLoader>>",
    "> = {",
  ];

  const loaderMap = (suffix) => {
    for (const { source, buckets } of generatedSources) {
      const directoryName = `${sourceDirectoryName(source.id)}${suffix}`;
      lines.push(`  ${source.id}: {`);
      for (const bucket of buckets) {
        const file = JSON.stringify(`./generated/${directoryName}/${bucket}.js`);
        // A literal URL lets the bundler emit the existing ESM file as an asset.
        // The browser then imports it directly when a character needs this bucket.
        const load = browserAssets
          ? `import(/* webpackIgnore: true */ /* @vite-ignore */ new URL(${file}, import.meta.url).href)`
          : `import(${file})`;
        lines.push(`    ${JSON.stringify(bucket)}: () => ${load},`);
      }
      lines.push("  },");
    }
  };
  loaderMap("");
  lines.push(
    "};",
    "",
    "// Pen-path centrelines (SVG polyline points in viewBox coordinates).",
    "export const GENERATED_STROKE_CENTRELINE_LOADERS: Record<",
    "  StrokeDataSource,",
    "  Readonly<Record<string, StrokeCentrelineBucketLoader>>",
    "> = {",
  );
  loaderMap("-centrelines");
  lines.push(
    "};",
    "",
    "// Strokes that continue the previous pen stroke, by source and character.",
    "export const GENERATED_STROKE_CONTINUATIONS: Partial<",
    "  Record<StrokeDataSource, Readonly<Record<string, readonly number[]>>>",
    "> = {",
  );
  for (const { source, continuations } of generatedSources) {
    if (continuations.length === 0) continue;
    lines.push(
      `  ${source.id}: ${JSON.stringify(Object.fromEntries(continuations))},`,
    );
  }
  lines.push("};", "");
  return lines.join("\n");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const generatedSources = [];
for (const source of sources) {
  const { entries, continuations } = await readSourceEntries(source);
  const buckets = await writeSource(source, entries);
  generatedSources.push({ source, buckets, continuations });
  process.stdout.write(
    `${source.id}: ${entries.length.toLocaleString("en")} characters in ${buckets.length} buckets${
      continuations.length ? `, ${continuations.length} with continuation strokes` : ""
    }\n`,
  );
}

await writeFile(
  path.join(repositoryRoot, "src/stroke-order/generated-loaders.ts"),
  loaderSource(generatedSources),
);
await writeFile(
  path.join(repositoryRoot, "src/stroke-order/generated-browser-loaders.ts"),
  loaderSource(generatedSources, true),
);
