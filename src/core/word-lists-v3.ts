import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
  type SupabaseQueryLike,
  type SupabaseRuntimeClient,
} from "./supabase.js";

/** V3 IDs are database IDs, never titles. Unsafe JavaScript integers are rejected. */
export type WordListV3Id = number;

export type SBWordListV3Row = {
  id: WordListV3Id;
  lang: string;
  title: string;
  anchor_list_id: WordListV3Id | null;
  updated_at: string;
};

export type SBWordListWordRow = {
  id: number;
  list_id: WordListV3Id;
  text: string;
  position: number | null;
};

export type SBWordListSublistRow = {
  parent_list_id: WordListV3Id;
  child_list_id: WordListV3Id;
  position: number;
};

/** Each list owns its words and child relationships, including localized lists. */
export type WordListV3 = SBWordListV3Row & {
  words: SBWordListWordRow[];
  sublists: SBWordListSublistRow[];
};

export type WordListV3TreeNode = {
  list: WordListV3;
  children: WordListV3TreeNode[];
};

export type WordListsV3ReadOptions = {
  /** Invalidate this Supabase client's entire v3 cache before reading. */
  forceRefresh?: boolean;
  /** Maximum age of a successful read; defaults to five minutes. Zero bypasses settled entries. */
  maxAgeMs?: number;
};

export type WordListsV3Options = WordListsV3ReadOptions & {
  supabaseClient?: SupabaseClientLike;
};

export type WordListsV3TraversalOptions = {
  /** Cycles are skipped by default; shared children are valid. */
  throwOnCycle?: boolean;
};

export const WORD_LISTS_V3_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;
const ID_BATCH_SIZE = 250;
type CacheEntry = { promise: Promise<unknown>; completedAt?: number };
type Cache = Map<string, CacheEntry>;
let caches = new WeakMap<SupabaseRuntimeClient, Cache>();

/** Call after editing any of the three v3 tables. Omit the client to clear all v3 caches. */
export function clearWordListsV3Cache(supabaseClient?: SupabaseClientLike): void {
  if (supabaseClient === undefined) caches = new WeakMap();
  else {
    const client = asSupabaseRuntimeClient(supabaseClient);
    if (client) caches.delete(client);
  }
}

function context(options: WordListsV3Options) {
  const client = asSupabaseRuntimeClient(options.supabaseClient);
  if (!client || typeof client.from !== "function") {
    throw new Error("Word lists v3 require a Supabase client.");
  }
  const maxAgeMs = options.maxAgeMs ?? WORD_LISTS_V3_CACHE_MAX_AGE_MS;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new Error("Word lists v3 maxAgeMs must be a finite non-negative number.");
  }
  if (options.forceRefresh) caches.delete(client);
  let cache = caches.get(client);
  if (!cache) {
    cache = new Map();
    caches.set(client, cache);
  }
  return { client, cache, maxAgeMs };
}

type Context = ReturnType<typeof context>;

function cached<T>(ctx: Context, key: string, read: () => Promise<T>): Promise<T> {
  const existing = ctx.cache.get(key);
  if (existing && (existing.completedAt === undefined ||
    Date.now() - existing.completedAt < ctx.maxAgeMs)) {
    return existing.promise as Promise<T>;
  }
  const entry: CacheEntry = {
    promise: Promise.resolve().then(read).then((data) => {
      entry.completedAt = Date.now();
      return data;
    }).catch((error: unknown) => {
      if (ctx.cache.get(key) === entry) ctx.cache.delete(key);
      throw error;
    }),
  };
  ctx.cache.set(key, entry);
  return entry.promise as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isList(value: unknown): value is SBWordListV3Row {
  return isRecord(value) && isId(value.id) && isText(value.lang) &&
    isText(value.title) && (value.anchor_list_id === null || isId(value.anchor_list_id)) &&
    typeof value.updated_at === "string";
}

function isWord(value: unknown): value is SBWordListWordRow {
  return isRecord(value) && isId(value.id) && isId(value.list_id) &&
    isText(value.text) && (value.position === null || isId(value.position));
}

function isSublist(value: unknown): value is SBWordListSublistRow {
  return isRecord(value) && isId(value.parent_list_id) &&
    isId(value.child_list_id) && isId(value.position);
}

async function pages<T>(
  table: string,
  query: () => SupabaseQueryLike,
  validate: (row: unknown) => row is T,
): Promise<T[]> {
  const result: T[] = [];
  // Exact counts also support projects configured with a row cap below PAGE_SIZE.
  for (let offset = 0; ; ) {
    const { data, error, count } = await query().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load ${table}.`, { cause: error });
    if (!Array.isArray(data) || !data.every(validate)) {
      throw new Error(`Invalid rows returned by ${table}.`);
    }
    result.push(...data);
    offset += data.length;
    if (typeof count === "number") {
      if (offset >= count) return result;
      if (data.length === 0) throw new Error(`Incomplete page returned by ${table}.`);
    } else if (data.length < PAGE_SIZE) return result;
  }
}

function metadata(ctx: Context): Promise<SBWordListV3Row[]> {
  return cached(ctx, "metadata", () => pages("word_lists_v3", () =>
    ctx.client.from("word_lists_v3")
      .select("id,lang,title,anchor_list_id,updated_at", { count: "exact" })
      .order("id", { ascending: true }), isList));
}

async function children<T>(
  ctx: Context,
  ids: number[],
  table: string,
  columns: string,
  parentColumn: string,
  orderColumns: string[],
  validate: (row: unknown) => row is T,
): Promise<T[]> {
  const result: T[] = [];
  // Bounded IN filters avoid a query per list and unbounded URL lengths.
  for (let start = 0; start < ids.length; start += ID_BATCH_SIZE) {
    const batch = ids.slice(start, start + ID_BATCH_SIZE);
    result.push(...await pages(table, () => {
      let query = ctx.client.from(table).select(columns, { count: "exact" }).in(parentColumn, batch);
      for (const column of orderColumns) query = query.order(column, { ascending: true });
      return query;
    }, validate));
  }
  return result;
}

function listsForLang(ctx: Context, lang: string): Promise<WordListV3[]> {
  if (!isText(lang)) throw new Error("A non-empty word-list language is required.");
  return cached(ctx, `lang:${lang}`, async () => {
    const rows = (await metadata(ctx)).filter((row) => row.lang === lang);
    const ids = rows.map((row) => row.id);
    const [words, sublists] = await Promise.all([
      children(ctx, ids, "word_list_words", "id,list_id,text,position", "list_id", ["id"], isWord),
      children(ctx, ids, "word_list_sublists", "parent_list_id,child_list_id,position",
        "parent_list_id", ["parent_list_id", "position"], isSublist),
    ]);
    const lists = new Map<number, WordListV3>(rows.map((row) => [row.id, { ...row, words: [], sublists: [] }]));
    for (const word of words) lists.get(word.list_id)?.words.push(word);
    for (const sublist of sublists) lists.get(sublist.parent_list_id)?.sublists.push(sublist);
    for (const list of lists.values()) {
      list.words.sort((a, b) =>
        (a.position ?? Infinity) - (b.position ?? Infinity) || a.id - b.id);
      list.sublists.sort((a, b) => a.position - b.position || a.child_list_id - b.child_list_id);
    }
    return [...lists.values()];
  });
}

function cloneList(list: WordListV3): WordListV3 {
  return { ...list, words: list.words.map((word) => ({ ...word })), sublists: list.sublists.map((edge) => ({ ...edge })) };
}

/** Loads metadata for all languages, without loading words or child edges. */
export async function loadWordListMetaDataV3(options: WordListsV3Options = {}): Promise<SBWordListV3Row[]> {
  return (await metadata(context(options))).map((row) => ({ ...row }));
}

/** Loads one language's lists with their own ordered word rows and child edges. */
export async function loadWordListsV3(lang: string, options: WordListsV3Options = {}): Promise<WordListV3[]> {
  return (await listsForLang(context(options), lang)).map(cloneList);
}

function resolver(rows: readonly SBWordListV3Row[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const families = new Map<number, Map<string, SBWordListV3Row[]>>();
  for (const row of rows) {
    const anchor = row.anchor_list_id ?? row.id;
    let languages = families.get(anchor);
    if (!languages) families.set(anchor, languages = new Map());
    const matches = languages.get(row.lang) ?? [];
    matches.push(row);
    languages.set(row.lang, matches);
  }
  return (id: number, lang: string): SBWordListV3Row | null => {
    if (!isId(id)) throw new Error("A positive, safe integer word-list ID is required.");
    const selected = byId.get(id);
    if (!selected) return null;
    if (selected.lang === lang) return selected;
    const matches = families.get(selected.anchor_list_id ?? selected.id)?.get(lang) ?? [];
    if (matches.length > 1) throw new Error(`Ambiguous word-list family ${selected.anchor_list_id ?? selected.id} for ${lang}.`);
    return matches[0] ?? null;
  };
}

/** Resolves within a direct anchor family. Missing languages return null; no English fallback. */
export function resolveWordListL10nV3(
  rows: readonly SBWordListV3Row[], listId: WordListV3Id, lang: string,
): SBWordListV3Row | null {
  return resolver(rows)(listId, lang);
}

export async function getWordListL10nV3(
  listId: WordListV3Id, lang: string, options: WordListsV3Options = {},
): Promise<WordListV3 | null> {
  const ctx = context(options);
  const row = resolver(await metadata(ctx))(listId, lang);
  if (!row) return null;
  const list = (await listsForLang(ctx, lang)).find((candidate) => candidate.id === row.id);
  return list ? cloneList(list) : null;
}

/** Builds the exact stored hierarchy from supplied lists; missing children are omitted. */
export function buildWordListTreeV3(
  lists: readonly WordListV3[], listId: WordListV3Id,
  options: WordListsV3TraversalOptions = {},
): WordListV3TreeNode | null {
  const byId = new Map(lists.map((list) => [list.id, list]));
  const path = new Set<number>();
  const visit = (id: number): WordListV3TreeNode | null => {
    if (path.has(id)) {
      if (options.throwOnCycle) throw new Error(`Word-list cycle at ${id}.`);
      return null;
    }
    const list = byId.get(id);
    if (!list) return null;
    path.add(id);
    const children = list.sublists.flatMap((edge) => {
      const child = visit(edge.child_list_id);
      return child ? [child] : [];
    });
    path.delete(id);
    return { list, children };
  };
  return visit(listId);
}

/**
 * Resolves selected IDs to the target language and walks that language's own hierarchy.
 * Cross-language children are resolved within their own families, or skipped if absent.
 * Returns exact-text-unique words, parents before children, preserving stored positions.
 * Stored explicitations are already final; no translation or explicitation is generated here.
 */
export async function getDescendantL10nsOfWordListsV3(
  listIds: readonly WordListV3Id[], lang: string,
  options: WordListsV3Options & WordListsV3TraversalOptions = {},
): Promise<string[]> {
  if (listIds.length === 0) return [];
  const ctx = context(options);
  const [rows, lists] = await Promise.all([metadata(ctx), listsForLang(ctx, lang)]);
  const resolve = resolver(rows);
  const byId = new Map(lists.map((list) => [list.id, list]));
  const visited = new Set<number>();
  const path = new Set<number>();
  const words = new Set<string>();
  const visit = (id: number): void => {
    const row = resolve(id, lang);
    if (!row) return;
    if (path.has(row.id)) {
      if (options.throwOnCycle) throw new Error(`Word-list cycle at ${row.id}.`);
      return;
    }
    if (visited.has(row.id)) return;
    visited.add(row.id);
    const list = byId.get(row.id);
    if (!list) return;
    path.add(row.id);
    list.words.forEach((word) => words.add(word.text));
    list.sublists.forEach((edge) => visit(edge.child_list_id));
    path.delete(row.id);
  };
  listIds.forEach(visit);
  return [...words];
}
