import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Kage } from "@kurgm/kage-engine";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputPath = path.join(
  repositoryRoot,
  "data/stroke-order/cantonese-glyphwiki.json",
);

// A deliberately small, high-value supplement for colloquial Cantonese. The
// normal Make Me a Hanzi and AnimCJK sources remain preferred; these characters
// are included here because one or both of those sources commonly lack them.
const defaultCharacters = [
  "㗎",
  "佢",
  "冇",
  "冚",
  "咁",
  "咗",
  "咭",
  "哋",
  "啲",
  "啱",
  "喐",
  "喎",
  "喺",
  "嗰",
  "嗱",
  "嘞",
  "嘥",
  "啫",
  "啩",
  "嘜",
  "噃",
  "噉",
  "噏",
  "噚",
  "嚟",
  "嚿",
  "嬲",
  "慳",
  "揼",
  "搵",
  "攞",
  "曱",
  "甴",
  "踎",
  "餸",
  "黐",
  "𠵱",
  "𨋢",
];
const characters = process.env.LINGOP_STROKE_CHARACTERS
  ? [...process.env.LINGOP_STROKE_CHARACTERS]
  : defaultCharacters;

const rimeStrokeUrl =
  "https://raw.githubusercontent.com/rime/rime-stroke/1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48/stroke.dict.yaml";
const glyphWikiApi = "https://glyphwiki.org/api/glyph";
const cnsStrokeSearch = "https://www.cns11643.gov.tw/search.jsp";

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "lingop-stroke-data-builder" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

function parseRimeStrokeOrders(source) {
  const orders = new Map();
  for (const line of source.split(/\r?\n/u)) {
    if (!line || line.startsWith("#") || line.startsWith("---")) continue;
    const [character, order] = line.split("\t");
    if (!character || !/^[hspnz]+$/u.test(order ?? "")) continue;
    const existing = orders.get(character) ?? [];
    if (!existing.includes(order)) existing.push(order);
    orders.set(character, existing);
  }
  return orders;
}

function glyphNames(character) {
  const base = `u${character.codePointAt(0).toString(16)}`;
  return [`${base}-h`, `${base}-t`, base];
}

const glyphRecordCache = new Map();

async function fetchGlyphRecord(name) {
  if (!glyphRecordCache.has(name)) {
    glyphRecordCache.set(
      name,
      fetchText(`${glyphWikiApi}?name=${encodeURIComponent(name)}`).then(
        (text) => {
          const record = JSON.parse(text);
          return typeof record.data === "string" && record.data.length > 0
            ? record
            : null;
        },
      ),
    );
  }
  return glyphRecordCache.get(name);
}

function referencedGlyphNames(data) {
  const names = [];
  for (const stroke of data.split("$")) {
    const columns = stroke.split(":");
    if (columns[0] === "99" && columns[7]) names.push(columns[7]);
  }
  return names;
}

async function loadGlyphTree(rootNames) {
  const records = new Map();

  async function visit(name) {
    if (records.has(name)) return records.get(name);
    const record = await fetchGlyphRecord(name);
    if (!record) throw new Error(`GlyphWiki has no KAGE data for ${name}.`);
    records.set(name, record);
    records.set(record.name, record);
    for (const dependency of referencedGlyphNames(record.data)) {
      await visit(dependency);
    }
    return record;
  }

  let rootName = null;
  let rootRecord = null;
  for (const candidate of rootNames) {
    const record = await fetchGlyphRecord(candidate);
    if (!record) continue;
    rootName = candidate;
    rootRecord = record;
    records.set(candidate, record);
    records.set(record.name, record);
    for (const dependency of referencedGlyphNames(record.data)) {
      await visit(dependency);
    }
    break;
  }
  if (!rootName || !rootRecord) {
    throw new Error(`GlyphWiki has no usable glyph among ${rootNames.join(", ")}.`);
  }
  return { rootName, rootRecord, records };
}

function strokeFragmentsFromGlyphTree(tree) {
  const kage = new Kage();
  for (const [name, record] of tree.records) {
    kage.kBuhin.push(name, record.data);
  }
  const primitives = kage.getEachStrokes(tree.rootRecord.data);
  if (process.env.LINGOP_DEBUG_PRIMITIVES) console.dir(primitives, { depth: null });
  const renderedStrokes = kage.makeGlyph3(tree.rootRecord.data);
  const paths = renderedStrokes.map((polygons, index) => {
    polygons.normalizeWinding();
    const svg = polygons.generateSVG(true);
    const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/gu)].map(
      (match) => match[1],
    );
    if (paths.length === 0) {
      throw new Error(`KAGE produced an empty path for stroke ${index + 1}.`);
    }
    return paths.join(" ");
  });
  return { paths, primitives };
}

function primitiveEnd(primitive) {
  for (const suffix of ["4", "3", "2"]) {
    const x = primitive[`x${suffix}`];
    const y = primitive[`y${suffix}`];
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error("KAGE primitive has no finite endpoint.");
}

function mergeStrokeFragments(fragments, strokeCount) {
  const { paths, primitives } = fragments;
  const mergesNeeded = paths.length - strokeCount;
  if (mergesNeeded < 0) return null;

  // KAGE sometimes splits a single pen stroke at a corner or intersection so
  // the typeface engine can shape each segment independently. Those fragments
  // remain next to each other and either meet or leave a small design gap.
  // Rejoin only as many boundaries as the Rime/CNS sequence requires.
  const gaps = primitives.slice(0, -1).map((primitive, index) => {
    const end = primitiveEnd(primitive);
    return Math.hypot(
      end.x - primitives[index + 1].x1,
      end.y - primitives[index + 1].y1,
    );
  });
  if (process.env.LINGOP_DEBUG_KAGE) {
    console.log("fragment gaps", gaps);
  }
  const joinIndexes = gaps
    .map((gap, index) => ({ gap, index }))
    // Some KAGE strokes are split around an intersection and leave a small
    // font-design gap. Larger gaps represent a real pen lift.
    .filter(({ gap }) => gap < 24)
    .sort((left, right) => left.gap - right.gap)
    .map(({ index }) => index);
  if (joinIndexes.length < mergesNeeded) return null;
  const selectedJoins = new Set(joinIndexes.slice(0, mergesNeeded));

  const merged = [];
  let current = paths[0] ?? "";
  for (let index = 0; index < paths.length - 1; index += 1) {
    if (selectedJoins.has(index)) current += ` ${paths[index + 1]}`;
    else {
      merged.push(current);
      current = paths[index + 1];
    }
  }
  if (current) merged.push(current);
  return merged.length === strokeCount ? merged : null;
}

function cnsOrder(order) {
  const strokeNumbers = { h: "1", s: "2", p: "3", n: "4", z: "5" };
  return [...order].map((stroke) => strokeNumbers[stroke]).join("");
}

async function isCnsValidated(character, order) {
  const url = new URL(cnsStrokeSearch);
  url.searchParams.set("ID", "8");
  url.searchParams.set("WR", cnsOrder(order));
  const page = await fetchText(url);
  return page.includes(`[${character}]`) || page.includes(`>${character}<`);
}

async function chooseStrokeOrder(character, candidates, fragments) {
  const compatible = candidates
    .map((order) => ({
      order,
      strokes: mergeStrokeFragments(fragments, order.length),
    }))
    .filter(({ strokes }) => strokes !== null);
  if (compatible.length === 0) {
    throw new Error(
      `${character}: could not align ${fragments.paths.length} KAGE fragments with ${candidates.join(", ")}.`,
    );
  }
  for (const candidate of compatible) {
    const { order, strokes } = candidate;
    if (await isCnsValidated(character, order)) {
      return { order, source: "CNS11643", strokes };
    }
  }
  return { ...compatible[0], source: "RIME" };
}

const rimeOrders = parseRimeStrokeOrders(await fetchText(rimeStrokeUrl));
let entries = {};
if (process.env.LINGOP_MERGE_STROKE_DATA) {
  try {
    const existing = JSON.parse(await readFile(outputPath, "utf8"));
    entries = existing.entries ?? {};
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function buildEntry(character) {
  const orderCandidates = rimeOrders.get(character) ?? [];
  if (orderCandidates.length === 0) {
    throw new Error(`Rime has no stroke-order entry for ${character}.`);
  }
  const tree = await loadGlyphTree(glyphNames(character));
  const fragments = strokeFragmentsFromGlyphTree(tree);
  const strokeOrder = await chooseStrokeOrder(
    character,
    orderCandidates,
    fragments,
  );
  const componentVersions = Object.fromEntries(
    [...tree.records]
      .filter(([name, record]) => name === record.name)
      .map(([name, record]) => [name, record.version]),
  );
  process.stdout.write(
    `${character}: ${strokeOrder.strokes.length} strokes (${strokeOrder.source}, ${tree.rootName})\n`,
  );
  return {
    strokes: strokeOrder.strokes,
    strokeOrder: strokeOrder.order,
    orderSource: strokeOrder.source,
    glyph: tree.rootName,
    glyphWikiVersions: componentVersions,
  };
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

const generatedEntries = await mapWithConcurrency(characters, 4, buildEntry);
for (const [index, character] of characters.entries()) {
  entries[character] = generatedEntries[index];
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      metadata: {
        generatedAt: new Date().toISOString(),
        rimeStrokeUrl,
        glyphWikiApi,
        cnsStrokeSearch,
      },
      entries,
    },
    null,
    2,
  )}\n`,
);
