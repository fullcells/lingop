import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Kage } from "@kurgm/kage-engine";

import {
  createReferenceLoader,
  deriveStrokeOrder,
} from "./cantonese-stroke-order.mjs";
import { formatCentreline } from "./stroke-centrelines.mjs";

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

// Re-running the update keeps the GlyphWiki versions recorded in the committed
// data, so only intentional changes alter the geometry. Set
// LINGOP_STROKE_GLYPHS=latest to move to the current GlyphWiki revisions.
function pinnedName(name, pins) {
  if (name.includes("@") || !pins?.[name]) return name;
  return `${name}@${pins[name]}`;
}

function referencedGlyphNames(data) {
  const names = [];
  for (const stroke of data.split("$")) {
    const columns = stroke.split(":");
    if (columns[0] === "99" && columns[7]) names.push(columns[7]);
  }
  return names;
}

async function loadGlyphTree(rootNames, pins) {
  const records = new Map();

  async function visit(name) {
    if (records.has(name)) return records.get(name);
    const record = await fetchGlyphRecord(pinnedName(name, pins));
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
    const record = await fetchGlyphRecord(pinnedName(candidate, pins));
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

const rimeOrders = parseRimeStrokeOrders(await fetchText(rimeStrokeUrl));
const references = createReferenceLoader(repositoryRoot);
let existingEntries = {};
try {
  existingEntries =
    JSON.parse(await readFile(outputPath, "utf8")).entries ?? {};
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const useLatestGlyphs = process.env.LINGOP_STROKE_GLYPHS === "latest";
const entries = process.env.LINGOP_MERGE_STROKE_DATA
  ? { ...existingEntries }
  : {};

async function buildEntry(character) {
  const orderCandidates = rimeOrders.get(character) ?? [];
  if (orderCandidates.length === 0) {
    throw new Error(`Rime has no stroke-order entry for ${character}.`);
  }
  const previous = useLatestGlyphs ? undefined : existingEntries[character];
  const rootNames = previous?.glyph
    ? [previous.glyph, ...glyphNames(character)]
    : glyphNames(character);
  const tree = await loadGlyphTree(rootNames, previous?.glyphWikiVersions);
  const derived = deriveStrokeOrder({
    character,
    rootName: tree.rootName,
    records: Object.fromEntries(
      [...tree.records].map(([name, record]) => [name, record.data]),
    ),
    sequences: orderCandidates,
    references,
    Kage,
  });
  const orderSource = (await isCnsValidated(character, derived.strokeOrder))
    ? "CNS11643"
    : "RIME";
  const componentVersions = Object.fromEntries(
    [...tree.records]
      .filter(([name, record]) => name === record.name)
      .map(([name, record]) => [name, Number(record.version)]),
  );
  process.stdout.write(
    `${character}: ${derived.strokes.length} strokes (${orderSource}, ${tree.rootName}; ${Object.entries(
      derived.references,
    )
      .map(([part, source]) => `${part} ${source}`)
      .join(", ")})${
      derived.typeMismatches
        ? `; ${derived.typeMismatches} stroke type(s) differ from ${derived.strokeOrder}: ${derived.derivedTypes}`
        : ""
    }\n`,
  );
  return {
    strokes: derived.strokes,
    centrelines: derived.centrelines.map((line) => formatCentreline(line, 200)),
    strokeOrder: derived.strokeOrder,
    orderSource,
    orderReferences: derived.references,
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
