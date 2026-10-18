// 20250904: Elements of this FE emojify are shared with the BE API english-words-to-emoji. FE emojify (originally a port from CampLingo) here has been updated to use MorphologizeEnWords as opposed to the deprecated 'lemmatizeEnglishWord'. no_emoji_words/study_word/study_lang should be abstracted to a higher 'display-oriented' level.
// 20251015: NOTE: This version is the most up-to-date version of 'emoji.ts'. (BE API english-words-to-emoji - should be updated to this one)

import {
  getMorphemeStringsForEnWord,
  type MorphemeStringsByPos,
} from "./morphologize-en-word.js";
import { ilike } from "./misc.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike } from "./supabase.js";

export type EmojiRow = {
  // id: number;
  emoji: string;
  en_gloss: string;
  // created_at: string;
};

/** Metadata is optional so tracing also works with existing, lightweight row arrays. */
export type EmojiTraceRow = EmojiRow & {
  id?: number | string;
  created_at?: string;
};

export type EmojiMatchKind = "exact" | "plural" | "normalized" | "lemma" | "affix" | "annotation";

export type EmojiTraceMatch = {
  /** Input fragment handled by this match; suffix matches retain their parent word. */
  input: string;
  /** Actual lookup text (for example DOG when the input was dogs). */
  lookup: string;
  kind: EmojiMatchKind;
  /** Zero-based index in the supplied snapshot, preserving duplicate-row precedence. */
  rowIndex: number;
  row: EmojiTraceRow;
};

export type EmojiTrace = {
  en_gloss: string;
  emoji: string | null;
  /** Contributing entries in output order. Repeated uses remain separate. */
  matches: EmojiTraceMatch[];
};

export type EmojiTraceOptions = {
  supabaseClient?: SupabaseEmojiClient | undefined;
  cacheKey?: string | undefined;
  isNotCoreWord?: IsNotCoreWord | undefined;
};

type EmojiTraceSink = (input: string, lookup: string, row: EmojiRow, kind: EmojiMatchKind) => void;

export type EmojiDataRevision = {
  count: number;
  newestCreatedAt: string | null;
};

export type EmojiDataCacheEntry = {
  schemaVersion: 2;
  rows: EmojiRow[];
  revision: EmojiDataRevision;
  checkedAt: number;
  refreshedAt: number;
};

export type EmojiDataStorage = {
  get(cacheKey: string): Promise<EmojiDataCacheEntry | null>;
  set(cacheKey: string, entry: EmojiDataCacheEntry): Promise<void>;
};

export type LoadEmojiDataOptions = {
  supabaseClient?: SupabaseEmojiClient | undefined;
  forceRefresh?: boolean | undefined;
  /** Separates persistent caches when one origin uses more than one emoji dataset. */
  cacheKey?: string | undefined;
  /** Primarily useful for non-browser runtimes and tests. */
  storage?: EmojiDataStorage | null | undefined;
};

export type SupabaseEmojiClient = SupabaseClientLike;

export type IsNotCoreWord = (
  word_lang: string,
  word: string,
  gloss?: string,
) => Promise<boolean>;

const no_emoji_words: { [study_lang: string]: string[] /*study_words*/ } = {
  // - Note: no_emoji_words/study_word/study_lang should be moved higher upstream, in display-oriented code.
  yue: [
    "啊",
    "呀",
    "嘅",
    "過",
  ],
  ja: [
    "お",
    "は",
    "の",
    "を",
    "ます",
    "です",
    "て",
    "ござい",
    "ございます",
    "が",
    "います",
    "あります",
    "に",
    "で",
    "た",
  ],
  es: [
    "le",
  ],
  de: [
    "zu",
    "sein",
  ],
};

const EMOJI_BATCH_SIZE = 1000;
const EMOJI_RESULT_CACHE_SIZE = 2000;
const EMOJI_CACHE_SCHEMA_VERSION = 2;
const EMOJI_CACHE_DB_NAME = "lingop-cache";
const EMOJI_CACHE_STORE_NAME = "emoji-data";
const DEFAULT_EMOJI_CACHE_KEY = "default";
const EMOJI_REVISION_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const EMOJI_FETCH_TIMEOUT_MS = 15 * 1000;
const EMOJI_STORAGE_TIMEOUT_MS = 1_500;

type EmojiDataState = {
  rows?: EmojiRow[];
  cacheEntry?: EmojiDataCacheEntry;
  loadPromise: Promise<EmojiRow[]> | undefined;
  refreshPromise: Promise<void> | undefined;
};

const emojiDataStates = new WeakMap<object, Map<string, EmojiDataState>>();
const emojiRowIndexes = new WeakMap<EmojiRow[], ReadonlyMap<string, EmojiRow>>();
const emojiPhraseMaxWords = new WeakMap<EmojiRow[], number>();
const emojiResultCaches = new WeakMap<
  EmojiRow[],
  WeakMap<IsNotCoreWord, Map<string, Promise<string | null>>>
>();
const emojiTraceRowIndexes = new WeakMap<EmojiRow[], ReadonlyMap<EmojiRow, number>>();

// Derivations aren't regular inflections: arbitrary -y/-en stripping would turn
// many -> man, party -> part, etc. Keep these semantic families explicit.
const emojiAdjectiveBases: Readonly<Record<string, string>> = {
  CHEESY: "CHEESE", SAUCY: "SAUCE", SILKEN: "SILK", SILKY: "SILK",
  CREAMY: "CREAM", MILKY: "MILK", BUTTERY: "BUTTER", OILY: "OIL",
  SALTY: "SALT", SPICY: "SPICE", JUICY: "JUICE", MEATY: "MEAT",
  FRUITY: "FRUIT", FISHY: "FISH", NUTTY: "NUT", GREASY: "GREASE",
  SMOKY: "SMOKE", ICY: "ICE", WATERY: "WATER", SNOWY: "SNOW",
  RAINY: "RAIN", WINDY: "WIND", CLOUDY: "CLOUD", FOGGY: "FOG",
  MUDDY: "MUD", DUSTY: "DUST", WOODY: "WOOD", WOODEN: "WOOD",
  WOOLLY: "WOOL", WOOLY: "WOOL", WOOLLEN: "WOOL", WOOLEN: "WOOL",
  GOLDEN: "GOLD", EARTHEN: "EARTH", STONY: "STONE", BONY: "BONE",
};

type EmojiRowMatch = { row: EmojiRow; lookup: string; kind: EmojiMatchKind };

async function defaultIsNotCoreWord(): Promise<boolean> {
  return false;
}

export async function preloadEmojiData(
  options: LoadEmojiDataOptions = {},
): Promise<EmojiRow[]> {
  return loadEmojiData(options);
}

export async function loadEmojiData({
  supabaseClient,
  forceRefresh = false,
  cacheKey = DEFAULT_EMOJI_CACHE_KEY,
  storage = getDefaultEmojiDataStorage(),
}: LoadEmojiDataOptions = {}): Promise<EmojiRow[]> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load emojis.");
    return [];
  }

  const state = getEmojiDataState(runtimeSupabaseClient, cacheKey);
  if (!forceRefresh && state.rows) {
    scheduleEmojiDataRevalidation({
      cacheKey,
      state,
      storage,
      supabaseClient: runtimeSupabaseClient,
    });
    return state.rows;
  }
  if (!forceRefresh && state.loadPromise) return state.loadPromise;

  const loadPromise = forceRefresh
    ? refreshEmojiData({
        cacheKey,
        state,
        storage,
        supabaseClient: runtimeSupabaseClient,
      })
    : initializeEmojiData({
        cacheKey,
        state,
        storage,
        supabaseClient: runtimeSupabaseClient,
      });
  state.loadPromise = loadPromise;

  try {
    const rows = await loadPromise;
    if (rows.length > 0) state.rows = rows;
    return rows;
  } finally {
    if (state.loadPromise === loadPromise) state.loadPromise = undefined;
  }
}

function getEmojiDataState(
  supabaseClient: object,
  cacheKey: string,
): EmojiDataState {
  let statesByCacheKey = emojiDataStates.get(supabaseClient);
  if (!statesByCacheKey) {
    statesByCacheKey = new Map();
    emojiDataStates.set(supabaseClient, statesByCacheKey);
  }
  let state = statesByCacheKey.get(cacheKey);
  if (!state) {
    state = { loadPromise: undefined, refreshPromise: undefined };
    statesByCacheKey.set(cacheKey, state);
  }
  return state;
}

async function initializeEmojiData({
  cacheKey,
  state,
  storage,
  supabaseClient,
}: {
  cacheKey: string;
  state: EmojiDataState;
  storage: EmojiDataStorage | null;
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>;
}): Promise<EmojiRow[]> {
  const persistedEntry = storage
    ? await withTimeout(
        storage.get(cacheKey),
        EMOJI_STORAGE_TIMEOUT_MS,
        "persistent emoji cache read",
      ).catch((error: unknown) => {
        console.warn("Unable to read the persistent emoji cache:", error);
        return null;
      })
    : null;

  if (persistedEntry && isEmojiDataCacheEntry(persistedEntry)) {
    state.cacheEntry = persistedEntry;
    state.rows = persistedEntry.rows;
    scheduleEmojiDataRevalidation({
      cacheKey,
      state,
      storage,
      supabaseClient,
    });
    return persistedEntry.rows;
  }

  return refreshEmojiData({ cacheKey, state, storage, supabaseClient });
}

function scheduleEmojiDataRevalidation({
  cacheKey,
  state,
  storage,
  supabaseClient,
}: {
  cacheKey: string;
  state: EmojiDataState;
  storage: EmojiDataStorage | null;
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>;
}): void {
  const cacheEntry = state.cacheEntry;
  if (
    !cacheEntry ||
    Date.now() - cacheEntry.checkedAt < EMOJI_REVISION_CHECK_INTERVAL_MS ||
    state.refreshPromise
  ) {
    return;
  }

  const refreshPromise = revalidateEmojiData({
    cacheKey,
    state,
    storage,
    supabaseClient,
  })
    .catch((error: unknown) => {
      // Stale data remains useful; a future call will retry the validation.
      console.warn("Unable to refresh the emoji cache; using cached data:", error);
    })
    .finally(() => {
      if (state.refreshPromise === refreshPromise) {
        state.refreshPromise = undefined;
      }
    });
  state.refreshPromise = refreshPromise;
}

async function revalidateEmojiData({
  cacheKey,
  state,
  storage,
  supabaseClient,
}: {
  cacheKey: string;
  state: EmojiDataState;
  storage: EmojiDataStorage | null;
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>;
}): Promise<void> {
  const cacheEntry = state.cacheEntry;
  if (!cacheEntry) return;

  const revision = await fetchEmojiDataRevision(supabaseClient);
  const needsFullRefresh = !areEmojiDataRevisionsEqual(
    cacheEntry.revision,
    revision,
  );
  if (needsFullRefresh) {
    await refreshEmojiData({
      cacheKey,
      knownRevision: revision,
      state,
      storage,
      supabaseClient,
    });
    return;
  }

  const checkedEntry: EmojiDataCacheEntry = {
    ...cacheEntry,
    checkedAt: Date.now(),
  };
  state.cacheEntry = checkedEntry;
  if (storage) {
    await withTimeout(
      storage.set(cacheKey, checkedEntry),
      EMOJI_STORAGE_TIMEOUT_MS,
      "persistent emoji cache write",
    );
  }
}

async function refreshEmojiData({
  cacheKey,
  knownRevision,
  state,
  storage,
  supabaseClient,
}: {
  cacheKey: string;
  knownRevision?: EmojiDataRevision;
  state: EmojiDataState;
  storage: EmojiDataStorage | null;
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>;
}): Promise<EmojiRow[]> {
  try {
    const revision = knownRevision ?? (await fetchEmojiDataRevision(supabaseClient));
    const rows = await fetchEmojiData(supabaseClient, revision);
    const now = Date.now();
    const cacheEntry: EmojiDataCacheEntry = {
      schemaVersion: EMOJI_CACHE_SCHEMA_VERSION,
      rows,
      revision,
      checkedAt: now,
      refreshedAt: now,
    };
    state.rows = rows;
    state.cacheEntry = cacheEntry;
    if (storage) {
      await withTimeout(
        storage.set(cacheKey, cacheEntry),
        EMOJI_STORAGE_TIMEOUT_MS,
        "persistent emoji cache write",
      ).catch((error: unknown) => {
        console.warn("Unable to persist the emoji cache:", error);
      });
    }
    return rows;
  } catch (error) {
    if (state.rows) return state.rows;
    console.error("Unable to load emoji data:", error);
    return [];
  }
}

async function fetchEmojiDataRevision(
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>,
): Promise<EmojiDataRevision> {
  const result = await withTimeout(
    supabaseClient
      .from("emojis")
      .select("created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, 0),
    EMOJI_FETCH_TIMEOUT_MS,
    "emoji revision request",
  );
  if (result.error || result.count == null) {
    throw result.error ?? new Error("Emoji count was unavailable.");
  }

  const firstRow = Array.isArray(result.data) ? result.data[0] : undefined;
  const newestCreatedAt =
    firstRow &&
    typeof firstRow === "object" &&
    "created_at" in firstRow &&
    typeof firstRow.created_at === "string"
      ? firstRow.created_at
      : null;
  if (result.count > 0 && newestCreatedAt === null) {
    throw new Error("The newest emoji created_at value was unavailable.");
  }
  return { count: result.count, newestCreatedAt };
}

function areEmojiDataRevisionsEqual(
  left: EmojiDataRevision,
  right: EmojiDataRevision,
): boolean {
  return (
    left.count === right.count &&
    left.newestCreatedAt === right.newestCreatedAt
  );
}

async function fetchEmojiData(
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>,
  revision: EmojiDataRevision,
): Promise<EmojiRow[]> {
  const batchStarts = Array.from(
    { length: Math.ceil(revision.count / EMOJI_BATCH_SIZE) },
    (_, index) => index * EMOJI_BATCH_SIZE,
  );
  const batches = await Promise.all(
    batchStarts.map(async (start) => {
      const result = await withTimeout(
        supabaseClient
          .from("emojis")
          .select("emoji, en_gloss")
          .order("id", { ascending: true })
          .range(start, start + EMOJI_BATCH_SIZE - 1),
        EMOJI_FETCH_TIMEOUT_MS,
        `emoji batch request starting at ${start}`,
      );
      if (result.error) throw result.error;
      return (result.data ?? []).filter(isEmojiRow);
    }),
  );
  return batches.flat().map((row) => ({
    ...row,
    en_gloss: row.en_gloss.toUpperCase(),
  }));
}

async function withTimeout<T>(
  work: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

let emojiCacheDatabasePromise: Promise<IDBDatabase> | undefined;

function getDefaultEmojiDataStorage(): EmojiDataStorage | null {
  if (typeof indexedDB === "undefined") return null;
  return browserEmojiDataStorage;
}

const browserEmojiDataStorage: EmojiDataStorage = {
  async get(cacheKey) {
    const database = await openEmojiCacheDatabase();
    const transaction = database.transaction(EMOJI_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(EMOJI_CACHE_STORE_NAME).get(cacheKey);
    const storedValue = await requestToPromise<unknown>(request);
    return isStoredEmojiDataCacheEntry(storedValue) ? storedValue.entry : null;
  },
  async set(cacheKey, entry) {
    const database = await openEmojiCacheDatabase();
    const transaction = database.transaction(EMOJI_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(EMOJI_CACHE_STORE_NAME).put({ cacheKey, entry });
    await transactionToPromise(transaction);
  },
};

function openEmojiCacheDatabase(): Promise<IDBDatabase> {
  if (emojiCacheDatabasePromise) return emojiCacheDatabasePromise;
  const databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(EMOJI_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(EMOJI_CACHE_STORE_NAME)) {
        database.createObjectStore(EMOJI_CACHE_STORE_NAME, { keyPath: "cacheKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Unable to open the emoji cache database."),
      );
  }).catch((error: unknown) => {
    emojiCacheDatabasePromise = undefined;
    throw error;
  });
  emojiCacheDatabasePromise = databasePromise;
  return databasePromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Emoji cache request failed."));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Emoji cache transaction failed."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new Error("Emoji cache transaction was aborted."),
      );
  });
}

function isStoredEmojiDataCacheEntry(
  value: unknown,
): value is { cacheKey: string; entry: EmojiDataCacheEntry } {
  return (
    !!value &&
    typeof value === "object" &&
    "cacheKey" in value &&
    typeof value.cacheKey === "string" &&
    "entry" in value &&
    isEmojiDataCacheEntry(value.entry)
  );
}

function isEmojiDataCacheEntry(value: unknown): value is EmojiDataCacheEntry {
  return (
    !!value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === EMOJI_CACHE_SCHEMA_VERSION &&
    "rows" in value &&
    Array.isArray(value.rows) &&
    value.rows.every(isEmojiRow) &&
    "revision" in value &&
    !!value.revision &&
    typeof value.revision === "object" &&
    "count" in value.revision &&
    typeof value.revision.count === "number" &&
    "newestCreatedAt" in value.revision &&
    (typeof value.revision.newestCreatedAt === "string" ||
      value.revision.newestCreatedAt === null) &&
    "checkedAt" in value &&
    typeof value.checkedAt === "number" &&
    "refreshedAt" in value &&
    typeof value.refreshedAt === "number"
  );
}

/** Trace the shared generation snapshot, then fetch only the contributing entries.
 * Missing IDs mean the cached content no longer matches a current database entry.
 */
export async function traceEmoji(
  en_gloss: string,
  study_word?: string,
  study_lang?: string,
  { supabaseClient, cacheKey = DEFAULT_EMOJI_CACHE_KEY, isNotCoreWord }: EmojiTraceOptions = {},
): Promise<EmojiTrace> {
  const client = asSupabaseRuntimeClient(supabaseClient);
  if (!client) throw new Error("A Supabase client is required to inspect emoji entries.");
  const rows = await loadEmojiData({ supabaseClient, cacheKey });
  if (!getEmojiDataState(client, cacheKey).rows) throw new Error("Could not load emoji data for inspection.");
  if (!rows.length) return { en_gloss, emoji: null, matches: [] };
  if (!en_gloss.length) return { en_gloss, emoji: "", matches: [] };
  const result = await traceEmojiFromRows(en_gloss, rows, { study_word, study_lang, isNotCoreWord });
  const unique = new Map(result.matches.map(match => [match.rowIndex, match.row]));
  const entries = await Promise.all([...unique].map(async ([index, row]) => {
    // Literal, case-insensitive, whitespace-normalized matching, including
    // glosses containing LIKE wildcards or regex punctuation. First ID wins,
    // just as in the normal generator's ordered snapshot.
    const pattern = "^\\s*" + normalizeEmojiGloss(row.en_gloss).split(" ")
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+") + "\\s*$";
    const { data, error } = await withTimeout(client.from("emojis")
      .select("id, emoji, en_gloss, created_at")
      .filter("en_gloss", "imatch", pattern)
      .order("id", { ascending: true }).range(0, 0),
      EMOJI_FETCH_TIMEOUT_MS, "emoji entry inspection");
    if (error) throw error;
    const current = data?.[0];
    return [index, isEmojiRow(current) && current.emoji === row.emoji
      && normalizeEmojiGloss(current.en_gloss) === normalizeEmojiGloss(row.en_gloss)
      ? current as EmojiTraceRow : undefined] as const;
  }));
  const metadata = new Map(entries);
  result.matches.forEach(match => {
    const row = metadata.get(match.rowIndex);
    if (row) match.row = { ...row };
  });
  return result;
}

/** Trace the same renderer against a caller-owned snapshot, without network
 * requests or result-cache mutation. IDs are retained when supplied in rows.
 */
export async function traceEmojiFromRows(
  en_gloss: string,
  rows: EmojiTraceRow[],
  { study_word, study_lang, isNotCoreWord = defaultIsNotCoreWord }: {
    study_word?: string | undefined;
    study_lang?: string | undefined;
    isNotCoreWord?: IsNotCoreWord | undefined;
  } = {},
): Promise<EmojiTrace> {
  const matches: EmojiTraceMatch[] = [];
  let rowIndexes = emojiTraceRowIndexes.get(rows);
  if (!rowIndexes) {
    const index = new Map<EmojiRow, number>();
    rows.forEach((row, position) => { if (!index.has(row)) index.set(row, position); });
    emojiTraceRowIndexes.set(rows, index);
    rowIndexes = index;
  }
  const trace: EmojiTraceSink = (input, lookup, row, kind) => {
    const normalizedLookup = normalizeEmojiGloss(lookup);
    const resolvedKind = kind === "exact" && normalizedLookup !== normalizeEmojiGloss(row.en_gloss)
      && normalizedLookup.endsWith("S") ? "plural" : kind;
    matches.push({ input, lookup, kind: resolvedKind, rowIndex: rowIndexes.get(row)!, row: { ...row } });
  };
  const emoji = await generateEmojiFromRowsUncached(en_gloss, rows, { study_word, study_lang, isNotCoreWord, trace });
  return { en_gloss, emoji, matches };
}

// 1. `generateEmoji` is the main call root-level call for generating Emojis.
export async function generateEmoji(
  en_gloss: string,
  study_word?: string,
  study_lang?: string,
  {
    supabaseClient,
    isNotCoreWord = defaultIsNotCoreWord,
    cacheKey,
  }: {
    supabaseClient?: SupabaseEmojiClient | undefined;
    isNotCoreWord?: IsNotCoreWord | undefined;
    cacheKey?: string | undefined;
  } = {},
): Promise<string | null> { // might be better renamed 'determineEmoji' (since 'generate' implies we're actually doing an API call to generate new emoji atm - which we're not)
  const cachedEmojisData: EmojiRow[] = await loadEmojiData({
    supabaseClient,
    ...(cacheKey ? { cacheKey } : {}),
  });
  if (!cachedEmojisData || cachedEmojisData.length == 0) {
    console.error("cachedEmojisData was nonexistent");
    return null;
  }
  if (en_gloss.length == 0) return "";

  return generateEmojiFromRows(en_gloss, cachedEmojisData, {
    study_word,
    study_lang,
    isNotCoreWord,
  });
}

export async function generateEmojiFromRows(
  en_gloss: string,
  cachedEmojisData: EmojiRow[],
  {
    study_word,
    study_lang,
    isNotCoreWord = defaultIsNotCoreWord,
  }: {
    study_word?: string | undefined;
    study_lang?: string | undefined;
    isNotCoreWord?: IsNotCoreWord | undefined;
  } = {},
): Promise<string | null> {
  const resultCache = getEmojiResultCache(cachedEmojisData, isNotCoreWord);
  const resultCacheKey = JSON.stringify([
    en_gloss,
    study_word ?? null,
    study_lang ?? null,
  ]);
  const cachedResult = resultCache.get(resultCacheKey);
  if (cachedResult) {
    // Refresh recency so frequently used glosses survive bounded-cache eviction.
    resultCache.delete(resultCacheKey);
    resultCache.set(resultCacheKey, cachedResult);
    return cachedResult;
  }

  const resultPromise = generateEmojiFromRowsUncached(
    en_gloss,
    cachedEmojisData,
    { study_word, study_lang, isNotCoreWord },
  );
  resultCache.set(resultCacheKey, resultPromise);
  trimOldestMapEntries(resultCache, EMOJI_RESULT_CACHE_SIZE);

  try {
    return await resultPromise;
  } catch (error) {
    if (resultCache.get(resultCacheKey) === resultPromise) {
      resultCache.delete(resultCacheKey);
    }
    throw error;
  }
}

async function generateEmojiFromRowsUncached(
  en_gloss: string,
  cachedEmojisData: EmojiRow[],
  {
    study_word,
    study_lang,
    isNotCoreWord,
    trace,
  }: {
    study_word?: string | undefined;
    study_lang?: string | undefined;
    isNotCoreWord: IsNotCoreWord;
    trace?: EmojiTraceSink;
  },
): Promise<string | null> {
  // 0. IF FOUND IN NO_EMOJI_WORDS LIST, RETURN STUDY_WORD AS IS (e.g. "ja":"は")
  // - Note: no_emoji_words/study_word/study_lang should be moved higher upstream, in display-oriented code.
  if (study_word !== undefined && study_lang !== undefined) {
    if (no_emoji_words[study_lang] && no_emoji_words[study_lang].includes(study_word)) {
      return "\u00A0"; // return an empty space, so it's still editable, and differentiated from "no gloss found / lemmatizedOutput"
    }
  }

  // 1. EXACT-MATCH SEARCH
  const exact_match = findCaseInsensitiveEmojiRowMatch(en_gloss, cachedEmojisData);
  if (exact_match) {
    // console.log('generateEmoji: exact match:', en_gloss, exact_match.emoji);
    trace?.(en_gloss, en_gloss, exact_match, "exact");
    return exact_match.emoji;
  }

  // 2. Split alternatives at top-level slashes, then separate bracketed notes.
  const slashGroups = splitTopLevelSlashGroups(en_gloss);
  const slashGroupsEmoji: string[] = [];
  for (const slashGroup of slashGroups) {
    // 0. EXACT MATCH CHECK FIRST
    const exact_match = findCaseInsensitiveEmojiRowMatch(slashGroup, cachedEmojisData);
    if (exact_match) {
      trace?.(slashGroup, slashGroup, exact_match, "exact");
      slashGroupsEmoji.push(exact_match.emoji);
      continue;
    }

    // 1. Keep the phrase together before emojifying notes such as
    // "older brother (honorific)" or "brother [honorific,older]".
    const { wordSense, annotations } = splitTrailingGlossAnnotations(slashGroup);

    // 2. STANDARD GENERATE EMOJI ON WORD_SENSE
    const wordSenseEmoji = await generateEmoji_standard2(
      wordSense,
      cachedEmojisData,
      isNotCoreWord,
      trace,
    );

    // 3. Emojis for bracketed notes.
    const annotationPrints: string[] = [];
    for (const { bracket, text } of annotations) {
      const emojis: string[] = [];
      for (const part of text.split(",").map((item) => item.trim())) {
        const exactMatch = findCaseInsensitiveEmojiRowMatch(
          `${bracket}${part}${bracket === "[" ? "]" : ")"}`,
          cachedEmojisData,
        );
        if (exactMatch) trace?.(part, `${bracket}${part}${bracket === "[" ? "]" : ")"}`, exactMatch, "annotation");
        emojis.push(exactMatch?.emoji ??
          (await generateEmoji_standard2(part, cachedEmojisData, isNotCoreWord, trace)));
      }
      annotationPrints.push(
        `${bracket}${emojis.join(",")}${bracket === "[" ? "]" : ")"}`,
      );
    }

    // 4. Altogether
    const slashGroupEmoji = [wordSenseEmoji, ...annotationPrints].join(" ");
    slashGroupsEmoji.push(slashGroupEmoji);
  }

  const output = slashGroupsEmoji.join(" / ");

  return output;
}

function splitTopLevelSlashGroups(gloss: string): string[] {
  const groups: string[] = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  for (let index = 0; index < gloss.length; index += 1) {
    const char = gloss[index];
    if (char === "[") squareDepth += 1;
    else if (char === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (char === "(") roundDepth += 1;
    else if (char === ")") roundDepth = Math.max(0, roundDepth - 1);
    else if (char === "/" && squareDepth === 0 && roundDepth === 0) {
      groups.push(gloss.slice(start, index).trim());
      start = index + 1;
    }
  }
  groups.push(gloss.slice(start).trim());
  return groups;
}

function splitTrailingGlossAnnotations(gloss: string): {
  wordSense: string;
  annotations: { bracket: "[" | "("; text: string }[];
} {
  let wordSense = gloss.trim();
  const annotations: { bracket: "[" | "("; text: string }[] = [];
  while (wordSense) {
    const match = wordSense.match(/(\[[^\[\]]*\]|\([^()]*\))$/);
    if (!match || match.index === undefined || match.index === 0) break;
    const bracket = match[0][0] as "[" | "(";
    annotations.unshift({ bracket, text: match[0].slice(1, -1) });
    wordSense = wordSense.slice(0, match.index).trimEnd();
  }
  return { wordSense, annotations };
}

// 2. `generateEmoji_standard` is typically Run after splitting gloss by " / " and "[explicitations]"
// - "generateEmoji_standard" can be deprecated shortly after generateEmoji_standard2 (LLM code) has proven itself - 20260413 // generateEmoji_standard2 is same as generateEmoji_standard - except it prioritizes splits in a recursive traversal to find exactMatches. (e.g. to better handle "dad's older-brother")
async function generateEmoji_standard(
  en_gloss: string,
  cachedEmojisData: EmojiRow[],
  isNotCoreWord: IsNotCoreWord,
): Promise<string> {
  // 1. EXACT-MATCH SEARCH FOR GLOSS (e.g. "thank you")
  // - (this is actually also checked in Lemma search below, but we're bringing it up here in case it's faster)
  const exact_match = findCaseInsensitiveEmojiRowMatch(en_gloss, cachedEmojisData);
  if (exact_match) return exact_match.emoji;

  // 2. REPLACE FANCY DELIMS (like -,:,.,+,etc.) AND FIND EXACT MATCHES
  const en_gloss_normDelims: string = en_gloss.replace(/[\-:.+_]+/g, " ");
  const matchOnNormDelims = findCaseInsensitiveEmojiRowMatch(
    en_gloss_normDelims,
    cachedEmojisData,
  );
  if (matchOnNormDelims) return matchOnNormDelims.emoji;

  // 3. BREAK DOWN EN_GLOSS_PHRASE INTO EN_GLOSS_WORDS - EMOJIFY EACH
  const en_gloss_words: string[] = en_gloss.split(/[\s\-:.+_;]+/); // TODO: UPDATE THIS so that the split is done without "-" first, before trying again with a split based on "-"
  const en_gloss_words_emojis: (string | null)[] = [];
  // - First pass: check if ANY word is a core word
  let has_any_core_word = false;
  for (const en_word of en_gloss_words) {
    if (!(await isNotCoreWord("en", en_word))) {
      has_any_core_word = true;
      break;
    }
  }
  // - Second pass: generate emojis with appropriate logic
  for (const en_word of en_gloss_words) {
    const is_core_word = !(await isNotCoreWord("en", en_word));
    if (has_any_core_word && !is_core_word) {
      // If phrase has core words and this word is NOT core, use blank space - e.g. "on A plate", "A game", "on THE",
      en_gloss_words_emojis.push("\u2007"); // An explicit white-space so that it occupies space and is not compressed in html (as normal spaces are) // x. \u3164 (Hangul Filler - also shows depending on font)  x. \u2800 (Braille White Space - will still display something depending on font)
    } else {
      // Otherwise, generate emoji normally
      const word_emoji: string | null = generateEmoji_fromWord(en_word, cachedEmojisData);
      en_gloss_words_emojis.push(word_emoji);
    }
  }

  const en_gloss_phrase_emojified: string = en_gloss_words_emojis
    .filter(Boolean)
    .join(" ");
  return en_gloss_phrase_emojified;
}

async function generateEmoji_standard2(
  en_gloss: string,
  rows: EmojiRow[],
  isNotCoreWord: IsNotCoreWord,
  trace?: EmojiTraceSink,
): Promise<string> {
  /**
   * - Progress through levels of splits: Nothing, then: space -> [:.+_;] -> '-' (hyphen last)
   * - Always try exact match (raw + normalized-delims) at each level
   * - Before splitting spaces, consume the longest stored phrase at each position
   * - When a piece can’t split further: fall back to generateEmoji_fromWord
   */

  // Exact-match (raw + "fancy delim" normalization)
  const exactRow = (s: string): EmojiRowMatch | undefined => {
    const a = findCaseInsensitiveEmojiRowMatch(s, rows);
    if (a) return { row: a, lookup: s, kind: "exact" };

    const norm = s.replace(/[\-:.+_]+/g, " ");
    const b = findCaseInsensitiveEmojiRowMatch(norm, rows);
    if (b) return { row: b, lookup: norm, kind: "normalized" };
    return findInflectedEmojiPhraseMatch(s, rows);
  };

  // We build "atoms" so we can do core-word logic after we know all leaf-words.
  type Atom = { emoji?: string; word?: string; match?: EmojiRowMatch; input?: string };

  // Split order (spaces first, hyphen last)
  const splitters: RegExp[] = [/\s+/, /[.:+_;]+/, /-+/];

  // Recursively: exact-match first; else split in required order; else leaf word
  const recursiveSplitToAtomsWithExactMatchSearch = (raw: string): Atom[] => {
    const s = raw.trim();
    if (!s) return [];

    const exactMatch = exactRow(s);
    if (exactMatch?.row.emoji) return [{ emoji: exactMatch.row.emoji, ...(trace ? { match: exactMatch, input: s } : {}) }];

    for (const re of splitters) {
      if (!re.test(s)) continue; // Only try splitting if delimiter exists (avoids useless split to [s])
      const parts = s.split(re).map((p) => p.trim()).filter(Boolean);
      if (parts.length <= 1) continue;
      if (re !== splitters[0]) return parts.flatMap(recursiveSplitToAtomsWithExactMatchSearch);

      // Keep contiguous stored phrases intact before falling back to individual
      // words: e.g. "Cola [ice cream] float" and "[sweet and sour] pork".
      // Bound lookahead by the dataset's longest phrase, not the input length.
      const maxWords = emojiPhraseMaxWords.get(rows) ?? 1;
      const atoms: Atom[] = [];
      for (let start = 0; start < parts.length;) {
        let matchedEnd = start;
        for (let end = Math.min(parts.length, start + maxWords); end > start + 1; end -= 1) {
          const input = parts.slice(start, end).join(" ");
          const match = exactRow(input);
          if (!match?.row.emoji) continue;
          atoms.push({ emoji: match.row.emoji, ...(trace ? { match, input } : {}) });
          matchedEnd = end;
          break;
        }
        if (matchedEnd > start) {
          start = matchedEnd;
        } else {
          atoms.push(...recursiveSplitToAtomsWithExactMatchSearch(parts[start]!));
          start += 1;
        }
      }
      return atoms;
    }

    return [{ word: s }];
  };

  const atoms = recursiveSplitToAtomsWithExactMatchSearch(en_gloss);

  // Cache isNotCoreWord (async + repeated tokens), expose a simple isCore(word)
  const notCoreCache = new Map<string, boolean>();
  const isCore = async (word: string): Promise<boolean> => {
    const key = word.toLowerCase();
    // Use cached value if present; otherwise compute + cache it
    const notCore = notCoreCache.get(key) ?? (await isNotCoreWord("en", word));
    notCoreCache.set(key, notCore);
    return !notCore;
  };

  // 1) Determine if ANY leaf-word is core (done in parallel)
  const hasCore = (
    await Promise.all(atoms.flatMap((a) => (a.word ? [isCore(a.word)] : [])))
  ).some(Boolean);

  // 2) Render atoms (also in parallel; order preserved by Promise.all)
  // Parallel rendering must not put trace entries in promise-completion order.
  const atomMatches = trace ? atoms.map(() => [] as Parameters<EmojiTraceSink>[]) : undefined;
  const prints: string[] = await Promise.all(
    atoms.map(async (a, index) => {
      const atomTrace: EmojiTraceSink | undefined = trace
        ? (...match) => { atomMatches![index]!.push(match); } : undefined;
      if (a.emoji) {
        if (a.match && a.input) {
          atomTrace?.(a.input, a.match.lookup, a.match.row, a.match.kind);
        }
        return a.emoji;
      }
      if (!a.word) return ""; // safety (shouldn't happen much)
      // If phrase has core words, hide non-core words via visible whitespace
      if (hasCore && !(await isCore(a.word))) return "\u2007";
      // Otherwise generate emoji from word (or empty string if null)
      return generateEmoji_fromWord(a.word, rows, atomTrace) ?? "";
    }),
  );
  if (trace) atomMatches!.forEach(matches => matches.forEach(match => trace(...match)));

  let output: string = prints.filter(Boolean).join(" ");
  output = output.replaceAll("  ", " ");
  output = output.replaceAll("» →", "→"); // Condense "to {verb}" e.g. "to ask"'s emoji should just show as "ask", since "ask" is a verb (i.e. emojifies as "→💬❓").

  return output;
}

// 3. `generateEmoji_fromWord` is run after splitting gloss by 'spaces'.
function generateEmoji_fromWord(
  enWord: string,
  cachedEmojisData: EmojiRow[],
  trace?: EmojiTraceSink,
): string | null {
  // 1. EXACT-MATCH SEARCH
  const exact_match = findCaseInsensitiveEmojiRowMatch(enWord, cachedEmojisData);
  if (exact_match) { trace?.(enWord, enWord, exact_match, "exact"); return exact_match.emoji; }

  // 20251218: NOTE: Compared to the BE version of 'emojify.ts'. `generateEmoji_fromWord` has now been drastically updated so that AFFIX Catching is up in generateEmoji_fromWord, and Morpheme lemmatization is drastically simplified.

  // 2A. ["…ING"] AFFIX CATCHING
  if (enWord.toUpperCase().endsWith("ING")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/ING$/, ""); // HIDING→HID, SWIMMING→SWIMM
    const ingRow = findCaseInsensitiveEmojiRowMatch("-ING", cachedEmojisData);
    const _ingEmoji = ingRow?.emoji ?? "";
    // A. Check for exact match with split 'prefix -suffix'
    const word__ing: string = enWordPrefix + " -ing";
    const exact_match = findCaseInsensitiveEmojiRowMatch(word__ing, cachedEmojisData);
    if (exact_match) { trace?.(enWord, word__ing, exact_match, "affix"); return exact_match.emoji; }

    // B. Split up so we emojify {baseWord} + "-ing" separately.
    const hasDouble = /([A-Z])\1$/.test(enWordPrefix); // True for e.g. SWIMM, RUNN
    const dedup = hasDouble ? enWordPrefix.slice(0, -1) : ""; // SWIMM→SWIM, RUNN→RUN
    const index = getEmojiRowIndex(cachedEmojisData);
    const verb = getMorphemeStringsForEnWord(enWord.toLowerCase()).verb.toUpperCase();
    // Known verbs handle short stems (going -> go). Don't guess thing -> the.
    const row = verb !== enWord.toUpperCase() ? index.get(verb)
      : enWordPrefix.length < 3 ? undefined
      : index.get(enWordPrefix) ?? index.get(enWordPrefix + "E") ?? (hasDouble ? index.get(dedup) : undefined);
    if (row) {
      trace?.(enWord, row.en_gloss, row, "affix");
      if (ingRow && _ingEmoji) trace?.(enWord, "-ING", ingRow, "affix");
      return row.emoji + _ingEmoji;
    }
  }
  // 2B. ["…'S"] AFFIX CATCHING
  if (enWord.toUpperCase().endsWith("'S")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/\'S$/, ""); // ~
    const __sEmoji: string =
      findCaseInsensitiveEmojiRowMatch("'S", cachedEmojisData)?.emoji ?? "";
    void __sEmoji;
    // A. Check for exact base match of prefix
    const exact_match = findCaseInsensitiveEmojiRowMatch(enWordPrefix, cachedEmojisData);
    if (exact_match) { trace?.(enWord, enWordPrefix, exact_match, "affix"); return exact_match.emoji; } // Possessive suffix is intentionally not emitted.
  }
  // 2C. ["…SIDE"]
  if (enWord.toUpperCase().endsWith("SIDE")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/SIDE$/, "");
    const suffixRow = findCaseInsensitiveEmojiRowMatch("-SIDE", cachedEmojisData);
    const _suffixEmoji = suffixRow?.emoji ?? "";
    // A. Check for exact match with split 'prefix -suffix'
    const exact_split_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix + " -SIDE",
      cachedEmojisData,
    );
    if (exact_split_match) { trace?.(enWord, enWordPrefix + " -SIDE", exact_split_match, "affix"); return exact_split_match.emoji; }
    // B. Search for exact prefix match
    const exact_prefix_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix,
      cachedEmojisData,
    );
    if (exact_prefix_match) {
      trace?.(enWord, enWordPrefix, exact_prefix_match, "affix");
      if (suffixRow && _suffixEmoji) trace?.(enWord, "-SIDE", suffixRow, "affix");
      return exact_prefix_match.emoji + _suffixEmoji;
    }
  }
  // 2D. ["…?"]
  if (enWord.endsWith("?")) {
    const enWordPrefix: string = enWord.slice(0, -1); // Remove the "?"
    const suffixRow = findCaseInsensitiveEmojiRowMatch("-?", cachedEmojisData);
    const _suffixEmoji = suffixRow?.emoji ?? "";
    // A. Check for exact match with split 'prefix -suffix'
    const exact_split_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix + " ?",
      cachedEmojisData,
    );
    if (exact_split_match) { trace?.(enWord, enWordPrefix + " ?", exact_split_match, "affix"); return exact_split_match.emoji; }
    // B. Search for exact prefix match
    const exact_prefix_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix,
      cachedEmojisData,
    );
    if (exact_prefix_match) {
      trace?.(enWord, enWordPrefix, exact_prefix_match, "affix");
      if (suffixRow && _suffixEmoji) trace?.(enWord, "-?", suffixRow, "affix");
      return exact_prefix_match.emoji + _suffixEmoji;
    }
  }
  // 2E. ["…LY"]
  if (enWord.toUpperCase().endsWith("LY")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/LY$/, "");
    // B. Search for exact prefix match
    const exact_prefix_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix,
      cachedEmojisData,
    );
    if (exact_prefix_match) { trace?.(enWord, enWordPrefix, exact_prefix_match, "affix"); return `【${exact_prefix_match.emoji}】`; }
  }
  // 2E. ["-…"] (e.g. ["fly","-over"])
  if (enWord.startsWith("-")) {
    const enWordMain: string = enWord.slice(1);
    // A. Check for exact base match
    const exact_match = findCaseInsensitiveEmojiRowMatch(enWordMain, cachedEmojisData);
    if (exact_match) { trace?.(enWord, enWordMain, exact_match, "affix"); return exact_match.emoji; }
  }
  // 2F. ["(…)"]
  if (enWord.startsWith("(") && enWord.endsWith(")")) {
    const enWordMain: string = enWord.slice(1, -1);
    // A. Check for exact base match
    const exact_match = findCaseInsensitiveEmojiRowMatch(enWordMain, cachedEmojisData);
    if (exact_match) { trace?.(enWord, enWordMain, exact_match, "affix"); return `(${exact_match.emoji})`; }
  }

  // 3. Fallback on Matches on LEMMAS.
  // Extract possible lemma forms for a given word (that aren't the same as enWord)
  const posKeys: (keyof MorphemeStringsByPos)[] = ["noun", "verb", "adjective"];
  let morphemes: MorphemeStringsByPos = getMorphemeStringsForEnWord(enWord);
  // - Try LowerCase if no lemmaCandidates found
  if (
    enWord !== enWord.toLowerCase() &&
    posKeys.every((key) => ilike(morphemes[key], enWord))
  ) {
    morphemes = getMorphemeStringsForEnWord(enWord.toLowerCase());
  }
  // - Filter out if it's the same word
  const lemmaCandidates: string[] = posKeys
    .map((p) => morphemes[p])
    .filter((lemma) => lemma && !ilike(lemma, enWord))
    .sort((a, b) => a.length - b.length); // - Sort, so the shortest lemma comes first (for priority)

  // Tries to find a lemma or morpheme-string match in the emoji cache. Returns joined emoji string or null.
  for (const lemma of lemmaCandidates) {
    const match: EmojiRow | undefined = findCaseInsensitiveEmojiRowMatch(
      lemma.toUpperCase(),
      cachedEmojisData,
    );
    if (match) { trace?.(enWord, lemma.toUpperCase(), match, "lemma"); return match.emoji; }
  }
  const base = emojiAdjectiveBases[enWord.toUpperCase()];
  const derived = base ? getEmojiRowIndex(cachedEmojisData).get(base) : undefined;
  if (derived) { trace?.(enWord, base!, derived, "lemma"); return derived.emoji; }
  return null;
}

/** Change only a phrase/compound's final word; never search substrings or
 * expand combinations across all of its words. Exact spellings win above. */
function findInflectedEmojiPhraseMatch(text: string, rows: EmojiRow[]): EmojiRowMatch | undefined {
  const parts = text.match(/^(.*[\s\-:.+_])?([a-z]+)(['’]s|['’])?$/i);
  if (!parts || !parts[1] && !parts[3]) return;
  const prefix = parts[1] ?? "";
  const word = parts[2]!.toLowerCase();
  const lemmas = getMorphemeStringsForEnWord(word);
  const candidates = new Set([
    ...(parts[3] ? [word] : []),
    ...Object.values(lemmas).filter(lemma => lemma !== word),
  ]);
  const index = getEmojiRowIndex(rows);
  for (const candidate of candidates) {
    const lookup = normalizeEmojiGloss(prefix + candidate);
    const normalized = normalizeEmojiGloss(lookup.replace(/[\-:.+_]+/g, " "));
    const row = index.get(lookup) ?? index.get(normalized);
    if (row) return { row, lookup: index.has(lookup) ? lookup : normalized, kind: parts[3] ? "affix" : "lemma" };
  }
}

function findCaseInsensitiveEmojiRowMatch(
  enGlossText: string,
  cachedEmojisData: EmojiRow[],
): EmojiRow | undefined {
  const index = getEmojiRowIndex(cachedEmojisData);
  const normalizedGloss = normalizeEmojiGloss(enGlossText);
  // 1. Exact Match
  let match = index.get(normalizedGloss);
  // 2. A dictionary-backed plural of the final word (dishES, ice creamS).
  // Blindly dropping S also matches unrelated singulars such as bus -> bu.
  if (!match && normalizedGloss.endsWith("S")) {
    const word = normalizedGloss.match(/[A-Z]+$/)?.[0];
    if (word) {
      const noun = getMorphemeStringsForEnWord(word.toLowerCase()).noun.toUpperCase();
      if (noun !== word) match = index.get(normalizedGloss.slice(0, -word.length) + noun);
    }
  }
  return match;
}

function normalizeEmojiGloss(gloss: string): string {
  return gloss.trim().replace(/\s+/g, " ").toUpperCase();
}

function getEmojiRowIndex(
  cachedEmojisData: EmojiRow[],
): ReadonlyMap<string, EmojiRow> {
  const cachedIndex = emojiRowIndexes.get(cachedEmojisData);
  if (cachedIndex) return cachedIndex;

  const index = new Map<string, EmojiRow>();
  let maxWords = 1;
  for (const row of cachedEmojisData) {
    const key = normalizeEmojiGloss(row.en_gloss);
    maxWords = Math.max(maxWords, key.split(" ").length);
    // Match Array.find semantics when duplicate gloss rows exist.
    if (!index.has(key)) index.set(key, row);
  }
  emojiRowIndexes.set(cachedEmojisData, index);
  emojiPhraseMaxWords.set(cachedEmojisData, maxWords);
  return index;
}

function getEmojiResultCache(
  cachedEmojisData: EmojiRow[],
  isNotCoreWord: IsNotCoreWord,
): Map<string, Promise<string | null>> {
  let cachesByCoreWordResolver = emojiResultCaches.get(cachedEmojisData);
  if (!cachesByCoreWordResolver) {
    cachesByCoreWordResolver = new WeakMap();
    emojiResultCaches.set(cachedEmojisData, cachesByCoreWordResolver);
  }

  let resultCache = cachesByCoreWordResolver.get(isNotCoreWord);
  if (!resultCache) {
    resultCache = new Map();
    cachesByCoreWordResolver.set(isNotCoreWord, resultCache);
  }
  return resultCache;
}

function trimOldestMapEntries<Key, Value>(
  map: Map<Key, Value>,
  maximumSize: number,
): void {
  while (map.size > maximumSize) {
    const oldestKey = map.keys().next().value as Key | undefined;
    if (oldestKey === undefined) return;
    map.delete(oldestKey);
  }
}

// -------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------

/* 20250925: Color Emoji Replacements
	Replacing Emoji rather than Gloss - since Emojis can exist in other words:
	replacements:
		red - 🔴->[🎨🍓] - used by "Mars"=🪐🔴, "Red Light"=🔴🚦.
		yellow - 🟡->[🎨🧀] - used by "🟡$" (gold coins).
		green - 🟢->[🎨🌳] - used by "🟢🚦" (green light).
		blue - 🔵->[🎨🌊] - used by none. // 🫐 = alt
		black - ⚫️->[🎨♟] - used by none. // 🕶️ not found in bw-notoemoji // alts = 🐦‍⬛(black bird) 🐈‍⬛(black cat) ♟🐈‍⬛🦨🎬♣🏴
		white - ⚪️->[🎨🦷] - used by none.
		purple - 🟣->[🎨🍆] - used by none.
		brown - 🟤->[🎨🦌] - used by none. // in bw-notoemoji 🥔 isn't clear enough
		orange (color) 🟠->[🎨🥕] - used by "🪐🟠✨" (Venus). // in bw-notoemoji 🍊 isn't clear enough
		//orange 🍊
	pre-existing:
		⟦🎨⟧ color
		🎨💕 pink

		// 20251019 - note if replacing '🩸' with '🩸(🆎)' it needs to be a strict replacement, since '🩸' is used in many places.
*/
export function convertEmojiTextToBlackWhiteCompatibleEmojiText(
  emojiText: string,
): string {
  const replacements: { [original_emoji: string]: string } = {
    "🔴": "🎨🍓",
    "🟡": "🎨🧀",
    "🟢": "🎨🌲",
    "🔵": "🎨🌊",
    "⚫️": "🎨🐈‍⬛",
    "⚪️": "🎨🦷",
    "🟣": "🎨🍆",
    "🟤": "🎨🦌",
    "🟠": "🎨🥕",
    "☀️": "☀",
    "0️⃣": "⓪",
    "1️⃣": "①",
    "2️⃣": "②",
    "3️⃣": "③",
    "4️⃣": "④",
    "5️⃣": "⑤",
    "6️⃣": "⑥",
    "7️⃣": "⑦",
    "8️⃣": "⑧",
    "9️⃣": "⑨",
    "🔟": "⑩",
    "🍎": "🍏",
    "🎨🩵": "🎨🧊",
    "🔵▓": "🎨🌊",
    // --- Below Has been left as Color Emoji originals with `shouldBlackWhiteEmojiUseColorEmojiFont`
    // "👩‍🍼":"🧑‍🍼♀",
    // "👨‍🍼":"🧑‍🍼♂",
    // "👨‍🍼↰":"🧑‍🍼↰♂",
    // "👩‍🍼↰":"🧑‍🍼↰♀",
    // "👬":"🧑‍🤝‍🧑♂",
    // "👭":"🧑‍🤝‍🧑♀",
  };
  // Get all the emojis as a regex alternation
  const emojiKeys = Object.keys(replacements)
    .sort((a, b) => b.length - a.length) // sorted by longest key first
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(emojiKeys, "g");

  let output = emojiText.replace(regex, (match) => {
    // Surround Multi-Grapheme Replacements with [], if it isn't a direct replacement.
    let replacement = replacements[match] || match;
    // Check if the match isn't a direct match & replacement is >1 visual char
    // (Visual char: count code points, not just string length)
    // If replacement is not the same and has more than 1 code point
    if (match !== emojiText && numGraphemeClusters(replacement) > 1) {
      // if (!replacement.startsWith('[') && !replacement.endsWith(']')) { // // Only surround if not already surrounded by []
      replacement = `[${replacement}]`;
      // }
    }
    return replacement;
  });

  // Remove "U+FE0F (VARIATION SELECTOR-16) (base character)" (which can cause NotoMoji to not render the Emoji)
  output = cleanEmojiForNoto(output);

  // Replace " " (spaces) - since Noto Emoji (issue with BW-Font only, Color-Font is fine), makes the spaces ridiculously large
  output = output.replaceAll(" ", "\u2009");

  return output;
}

// shouldBlackWhiteEmojiUseColorEmojiFont was introduced because some NotoEmoji(BW) renders/replacements are just better off as a grayscaled NotoColorEmoji.
export function shouldBlackWhiteEmojiUseColorEmojiFont(emojiText: string): boolean {
  const emojiList = ["👩‍🍼", "👨‍🍼", "👬", "👭", "👯"];
  return emojiList.some((emoji) => (emojiText ?? "").includes(emoji));
}

export function cleanEmojiForNoto(emojiString: string): string {
  if (["ȯ", "Ȯ"].includes(emojiString)) return emojiString;
  // NOTE: This should not be used if the intent is to display Apple Emojis as it can remove certain renderings like the KeyCap Emojis 5️⃣,➡️.
  // Remove "U+FE0F (VARIATION SELECTOR-16) (base character)" (which can cause "Noto EMoji" and "Noto Color Emoji" to not render the Emoji)
  return emojiString.replace(/\uFE0F/g, "");
}

function numGraphemeClusters(str: string): number { // i.e. visual length with emojis // :|| from "crossword.tsx"
  // If Intl.Segmenter is available
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments = Array.from(segmenter.segment(str));
    return segments.length;
  } else {
    // Fallback: counts code points, not graphemes (not perfect for emojis!). It's better than length but still sometimes wrong
    return Array.from(str).length;
  }
}

export function shouldFlipEmoji(grapheme: string): "IF_NOTO" | "YES" | "NO" {
  const TO_FLIP_NOTO_EMOJIS = new Set(["🤰", "🫄", "🫃", "🤾", "🦋"]);
  const TO_FLIP_GENERAL_EMOJIS = new Set([
    "🚗",
    "🚙",
    "🚕",
    "🚓",
    "🚑",
    "🚒",
    "🚌",
    "🚐",
    "🚚",
    "🚛",
    "🛻",
    "🚜",
    "🏍️",
    "🛵",
    "🛴",
    "🚲",
    "🛺",
    "🚤",
    "🚣",
    "🏇",
    "🐎",
    "🐢",
    "🐇",
    "🕊️",
    "🦅",
    "🦆",
    "🦜",
    "🪿",
    "🐛",
    "🐝",
    "🐜",
    "🐳",
    "🐋",
    "🦈",
    "🦐",
    "⛹",
    "⛹️‍♀️",
    "⛹️‍♂️",
    "🦗",
    "🐟",
    "🐬",
    "🐠",
    "🐡",
    "🦄",
    "🐴",
    "🐕",
    "🐩",
    "🦮",
    "🐕‍🦺",
    "🐈",
    "🐈‍⬛",
    "🪽",
    "🐦‍🔥",
    "🐉",
    "🦖",
    "🦕",
    "🐘",
    "🚴",
    "🚶",
    "🏃",
    "🏊",
    "🤔",
    "🧐",
    "👀",
    "✍️",
    "📣",
    "📢",
  ]);

  if (TO_FLIP_GENERAL_EMOJIS.has(grapheme)) return "YES";
  if (TO_FLIP_NOTO_EMOJIS.has(grapheme)) return "IF_NOTO";
  return "NO";
}

function isEmojiRow(row: unknown): row is EmojiRow {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Partial<EmojiRow>;
  return typeof candidate.emoji === "string" && typeof candidate.en_gloss === "string";
}

void generateEmoji_standard;
