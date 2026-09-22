import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tify } from "chinese-conv";

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
        !entry.strokes.every((stroke) => typeof stroke === "string")
      ) {
        throw new Error(`Invalid prebuilt stroke data for ${character}.`);
      }
      entries.push([character, entry.strokes]);
    }
    return entries;
  }

  const filenames = (await readdir(source.directory)).sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const entries = [];

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
      if (strokes.length > 0) entries.push([character, strokes]);
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
      entries.push([character, parsed.strokes]);
    }
  }

  return entries;
}

function sourceDirectoryName(sourceId) {
  return sourceId.toLowerCase().replaceAll("_", "-");
}

async function writeSource(source, entries) {
  const buckets = new Map();
  for (const [character, strokes] of entries) {
    const bucket = bucketForCharacter(character);
    const bucketEntries = buckets.get(bucket) ?? [];
    bucketEntries.push([character, strokes]);
    buckets.set(bucket, bucketEntries);
  }

  const directoryName = sourceDirectoryName(source.id);
  const directory = path.join(outputRoot, directoryName);
  await mkdir(directory, { recursive: true });

  for (const [bucket, bucketEntries] of [...buckets].sort()) {
    bucketEntries.sort(([left], [right]) => left.localeCompare(right, "en"));
    const record = Object.fromEntries(bucketEntries);
    await writeFile(
      path.join(directory, `${bucket}.ts`),
      [
        'import type { StrokePathBucket } from "../../types.js";',
        "",
        `const data: StrokePathBucket = ${JSON.stringify(record)};`,
        "",
        "export default data;",
        "",
      ].join("\n"),
    );
  }

  return [...buckets.keys()].sort();
}

function loaderSource(generatedSources) {
  const lines = [
    'import type { StrokeBucketLoader, StrokeDataSource } from "./types.js";',
    "",
    "// Generated by scripts/generate-stroke-data.mjs. Do not edit.",
    "export const GENERATED_STROKE_BUCKET_LOADERS: Record<",
    "  StrokeDataSource,",
    "  Readonly<Record<string, StrokeBucketLoader>>",
    "> = {",
  ];

  for (const { source, buckets } of generatedSources) {
    const directoryName = sourceDirectoryName(source.id);
    lines.push(`  ${source.id}: {`);
    for (const bucket of buckets) {
      lines.push(
        `    ${JSON.stringify(bucket)}: () => import("./generated/${directoryName}/${bucket}.js"),`,
      );
    }
    lines.push("  },");
  }

  lines.push("};", "");
  return lines.join("\n");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const generatedSources = [];
for (const source of sources) {
  const entries = await readSourceEntries(source);
  const buckets = await writeSource(source, entries);
  generatedSources.push({ source, buckets });
  process.stdout.write(
    `${source.id}: ${entries.length.toLocaleString("en")} characters in ${buckets.length} buckets\n`,
  );
}

await writeFile(
  path.join(repositoryRoot, "src/stroke-order/generated-loaders.ts"),
  loaderSource(generatedSources),
);
