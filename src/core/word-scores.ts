import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
  type SupabaseQueryLike,
  type SupabaseRuntimeClient,
} from "./supabase.js";

export type WordScoreSortDirection = "asc" | "desc";
export type WordScoreKey = {
  id: number;
  title: string;
  sort_direction: WordScoreSortDirection;
  updated_at: string;
};
/** Exact language/word match; zero is a score, null means no stored score. */
export type WordScoresByWord = Map<string, number | null>;
export type ScoredWord = { word: string; value: number | null };
export type WordScoresReadOptions = {
  /** Clear this Supabase client's score-key and score caches before reading. */
  forceRefresh?: boolean;
  /** Five minutes by default. Zero bypasses settled values, but shares in-flight reads. */
  maxAgeMs?: number;
};
export type WordScoresOptions = WordScoresReadOptions & { supabaseClient?: SupabaseClientLike };

export const WORD_SCORES_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
export const WORD_SCORES_CACHE_MAX_ENTRIES = 20_000;
const PAGE_SIZE = 1000;
const BATCH_SIZE = 100;
const FILTER_BUDGET = 3000;
const CONCURRENCY = 4;
type Entry<T> = { promise: Promise<T>; completedAt?: number };
type Cache = {
  keys?: Entry<WordScoreKey[]>;
  words: Map<string, Entry<number | null>>;
  active: number;
  queue: (() => void)[];
};
let caches = new WeakMap<SupabaseRuntimeClient, Cache>();

/** Clear after writes to either scoring table. Omit the client to clear all score caches. */
export function clearWordScoresCache(supabaseClient?: SupabaseClientLike): void {
  if (supabaseClient === undefined) caches = new WeakMap();
  else {
    const client = asSupabaseRuntimeClient(supabaseClient);
    if (client) caches.delete(client);
  }
}

function context(options: WordScoresOptions) {
  const client = asSupabaseRuntimeClient(options.supabaseClient);
  if (!client || typeof client.from !== "function") throw new Error("Word scores require a Supabase client.");
  const maxAgeMs = options.maxAgeMs ?? WORD_SCORES_CACHE_MAX_AGE_MS;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new Error("Word-score cache maxAgeMs must be finite and non-negative.");
  if (options.forceRefresh) caches.delete(client);
  let cache = caches.get(client);
  if (!cache) {
    cache = { words: new Map(), active: 0, queue: [] };
    caches.set(client, cache);
  }
  return { client, cache, maxAgeMs };
}
function fresh<T>(entry: Entry<T> | undefined, maxAgeMs: number): entry is Entry<T> {
  return !!entry && (entry.completedAt === undefined || Date.now() - entry.completedAt < maxAgeMs);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function id(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function scoreKey(value: unknown): value is WordScoreKey {
  return record(value) && id(value.id) && text(value.title) &&
    (value.sort_direction === "asc" || value.sort_direction === "desc") && typeof value.updated_at === "string";
}
function scoreValue(value: unknown): value is number {
  // PostgREST decodes numeric as a JS number. Don't silently rank unsafe integers or NaN/Infinity.
  return typeof value === "number" && Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value));
}

async function pages(table: string, query: () => SupabaseQueryLike): Promise<unknown[]> {
  const rows: unknown[] = [];
  let expected: number | undefined;
  for (let offset = 0; ; ) {
    const { data, error, count } = await query().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load ${table}.`, { cause: error });
    if (!Array.isArray(data)) throw new Error(`Invalid rows returned by ${table}.`);
    if (count != null) {
      if (!Number.isSafeInteger(count) || count < 0 || (expected !== undefined && count !== expected)) {
        throw new Error(`Inconsistent count returned by ${table}; retry the read.`);
      }
      expected = count;
    }
    rows.push(...data);
    offset += data.length;
    if (expected !== undefined) {
      if (offset > expected || (data.length === 0 && offset < expected)) throw new Error(`Incomplete page returned by ${table}.`);
      if (offset === expected) return rows;
    } else if (!data.length) return rows;
    // Advance by actual rows, even when the server's cap is lower than PAGE_SIZE.
  }
}

/** All scoring methods, ordered by stable ID. Titles can change without changing references. */
export async function loadWordScoreKeys(options: WordScoresOptions = {}): Promise<WordScoreKey[]> {
  const { client, cache, maxAgeMs } = context(options);
  if (!fresh(cache.keys, maxAgeMs)) {
    const entry: Entry<WordScoreKey[]> = {
      promise: Promise.resolve().then(async () => {
        const rows = await pages("word_score_keys", () => client.from("word_score_keys")
          .select("id,title,sort_direction,updated_at", { count: "exact" }).order("id", { ascending: true }));
        if (!rows.every(scoreKey) || new Set(rows.map(row => row.id)).size !== rows.length) {
          throw new Error("Invalid or duplicate word_score_keys rows.");
        }
        entry.completedAt = Date.now();
        return rows;
      }).catch((error: unknown) => {
        if (cache.keys === entry) delete cache.keys;
        throw error;
      }),
    };
    cache.keys = entry;
  }
  return (await cache.keys!.promise).map(row => ({ ...row }));
}

// Quote every PostgREST IN literal explicitly, including embedded quotes/backslashes.
// Supabase's ordinary .in() quoting does not escape all of these cases in older clients.
function literal(word: string): string {
  return `"${word.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
function batches(words: string[]): string[][] {
  const result: string[][] = [];
  let batch: string[] = [], size = 0;
  for (const word of words) {
    const length = encodeURIComponent(literal(word)).length + 3;
    if (length > FILTER_BUDGET) throw new Error("A word is too long for a word-score lookup filter.");
    if (batch.length && (batch.length >= BATCH_SIZE || size + length > FILTER_BUDGET)) {
      result.push(batch); batch = []; size = 0;
    }
    batch.push(word); size += length;
  }
  if (batch.length) result.push(batch);
  return result;
}
function schedule<T>(cache: Cache, read: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      cache.active++;
      void Promise.resolve().then(read).then(resolve, reject).finally(() => {
        cache.active--;
        cache.queue.shift()?.();
      });
    };
    if (cache.active < CONCURRENCY) run();
    else cache.queue.push(run);
  });
}

/**
 * Batched, exact lang + word lookups for one scoring method; no whole-corpus download.
 * Returns a fresh Map in first-input order, including null for every unscored word.
 * Reuses individual cached words across overlapping lists. Does not normalize text,
 * strip explicitations, generate data, or fall back to another language.
 */
export async function getWordScores(
  words: readonly string[], lang: string, scoreKeyId: number, options: WordScoresOptions = {},
): Promise<WordScoresByWord> {
  if (!text(lang)) throw new Error("A non-empty word-score language is required.");
  if (!id(scoreKeyId)) throw new Error("A positive, safe integer score-key ID is required.");
  if (!words.every(text)) throw new Error("Word-score lookups require non-empty words.");
  const { client, cache, maxAgeMs } = context(options);
  const unique = [...new Set(words)];
  const pending = new Map<string, Entry<number | null>>();
  const missing: string[] = [];
  const key = (word: string) => JSON.stringify([lang, scoreKeyId, word]);
  for (const word of unique) {
    const entry = cache.words.get(key(word));
    if (fresh(entry, maxAgeMs)) {
      cache.words.delete(key(word)); cache.words.set(key(word), entry); // LRU
      pending.set(word, entry);
    } else missing.push(word);
  }
  // Validate all filter sizes before starting any work or installing promises.
  for (const batch of batches(missing)) {
    const batchResult = schedule(cache, async () => {
      const rows = await pages("word_scores", () => client.from("word_scores")
        .select("lang,word,score_key_id,value", { count: "exact" })
        .eq("lang", lang).eq("score_key_id", scoreKeyId)
        .filter("word", "in", `(${batch.map(literal).join(",")})`)
        .order("word", { ascending: true }));
      const requested = new Set(batch);
      const found = new Map<string, number>();
      for (const row of rows) {
        if (!record(row) || row.lang !== lang || row.score_key_id !== scoreKeyId ||
          typeof row.word !== "string" || !requested.has(row.word) || !scoreValue(row.value) || found.has(row.word)) {
          throw new Error("Invalid, duplicate, or mismatched word_scores rows.");
        }
        found.set(row.word, row.value);
      }
      return found;
    });
    for (const word of batch) {
      const cacheKey = key(word);
      const entry: Entry<number | null> = {
        promise: batchResult.then(found => {
          entry.completedAt = Date.now();
          return found.get(word) ?? null;
        }).catch((error: unknown) => {
          if (cache.words.get(cacheKey) === entry) cache.words.delete(cacheKey);
          throw error;
        }),
      };
      pending.set(word, entry);
      cache.words.delete(cacheKey); cache.words.set(cacheKey, entry);
      while (cache.words.size > WORD_SCORES_CACHE_MAX_ENTRIES) cache.words.delete(cache.words.keys().next().value!);
    }
  }
  const values = await Promise.all(unique.map(word => pending.get(word)!.promise));
  return new Map(unique.map((word, index) => [word, values[index]!]));
}

/** Non-mutating, stable sort. Missing scores always last; ties retain input order. */
export function sortWordsByScore(
  words: readonly string[], scores: ReadonlyMap<string, number | null>, direction: WordScoreSortDirection,
): ScoredWord[] {
  if (direction !== "asc" && direction !== "desc") throw new Error("Score sort direction must be asc or desc.");
  const rows = words.map(word => {
    const value = scores.get(word) ?? null;
    if (value !== null && !scoreValue(value)) throw new Error(`Invalid score for ${word}.`);
    return { word, value };
  });
  return rows.sort((a, b) => {
    if (a.value === null) return b.value === null ? 0 : 1;
    if (b.value === null) return -1;
    return direction === "asc" ? a.value - b.value : b.value - a.value;
  });
}
