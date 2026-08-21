import { asSupabaseRuntimeClient, type SupabaseClientLike } from "./supabase.js";

// Table: word_lists (i.e. source content data, no L10Ns)
export type SBWordListRow = {
  title: string;
  lang: string;
  sublists: string[] | null;
  words: string[] | null;
  type: "UNIVERSAL" | "LANG_SPECIFIC";
  updated_at: string;
};

export type WordListMeta = Omit<SBWordListRow, "words">;

// Table: cache_word_list_l10n_words (emphasis on "L10N")
export type SBCacheWordListL10nWordsRow = {
  lang: string;
  list_title: string;
  l10n_words: string[];
  updated_at: string;
  is_human_verified: boolean;
};

export type SupabaseWordListsClient = SupabaseClientLike;

export type PublicWordListsDataApiOptions = {
  supabaseUrl: string;
  /**
   * A publishable key (or legacy anon key). This identifies the public Data API
   * project; it is not a user session and grants only the database's `anon` role.
   */
  supabasePublicKey: string;
  fetchImpl?: typeof globalThis.fetch;
};

const WORD_LIST_COLUMNS = "title, sublists, words, lang, type, updated_at";
const CACHE_WORD_LIST_COLUMNS =
  "lang, list_title, l10n_words, updated_at, is_human_verified";
const WORD_LIST_BATCH_SIZE = 1000;

let wordListsPromise: Promise<SBWordListRow[]> | undefined;

// `lang` throughout the localized-cache loader refers to the localization language.
const cacheWordListsByLang = new Map<string, SBCacheWordListL10nWordsRow[]>();
const cacheWordListPromisesByLang = new Map<
  string,
  Promise<SBCacheWordListL10nWordsRow[]>
>();

export function clearWordListsCache(): void {
  wordListsPromise = undefined;
  cacheWordListsByLang.clear();
  cacheWordListPromisesByLang.clear();
}

export async function loadWordLists({
  supabaseClient,
}: {
  supabaseClient?: SupabaseWordListsClient | undefined;
} = {}): Promise<SBWordListRow[]> {
  if (wordListsPromise) return wordListsPromise;

  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load word lists.");
    return [];
  }

  wordListsPromise = (async () => {
    const entries: SBWordListRow[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await runtimeSupabaseClient
        .from("word_lists")
        .select(WORD_LIST_COLUMNS)
        .order("title", { ascending: true })
        .range(offset, offset + WORD_LIST_BATCH_SIZE - 1);
      if (error) {
        console.error("Error getting data for sb.word_lists", error);
        break;
      }

      const dataRows = data ?? [];
      entries.push(...dataRows.filter(isSBWordListRow)); // Add Entries
      if (dataRows.length < WORD_LIST_BATCH_SIZE) break; // Stop or Continue
      offset += WORD_LIST_BATCH_SIZE;
    }
    // console.log(`ℹ️ Ran: loadWordLists: (Should only happen once per runtime session.)`);
    return entries;
  })();

  return wordListsPromise;
}

// Full WordListMeta[] is ~12kb, Full SBWordListRow[] (with words) is ~23kb. They seem slim enough for now that we can just use function (i.e. loadWordListMetaData is just derived from loadWordLists) - 20260524 // Can reintroduce a slimmer 'meta'-load as word-lists-size increases, when needed.
export async function loadWordListMetaData(
  options: { supabaseClient?: SupabaseWordListsClient | undefined } = {},
): Promise<WordListMeta[]> {
  // Intentionally loads full word lists and strips words field.
  // Acceptable given current dataset size (~23kb). Revisit if data grows significantly.
  const rows = await loadWordLists(options);
  return rows.map(({ words: _words, ...meta }) => meta);
}

export async function loadSBCacheWordListsForLang(
  lang: string,
  {
    supabaseClient,
  }: {
    supabaseClient?: SupabaseWordListsClient | undefined;
  } = {},
): Promise<SBCacheWordListL10nWordsRow[]> {
  // 1. Return Result Cache if it already exists
  const cachedRows = cacheWordListsByLang.get(lang);
  if (cachedRows) return cachedRows;

  // 2. Return Inflight Promise (dedupes concurrent loads)
  const inflightPromise = cacheWordListPromisesByLang.get(lang);
  if (inflightPromise) return inflightPromise;

  // 3. Request and Store
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load localized word lists.");
    return [];
  }

  const dataPromise = (async () => {
    const entries: SBCacheWordListL10nWordsRow[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await runtimeSupabaseClient
        .from("cache_word_list_l10n_words")
        .select(CACHE_WORD_LIST_COLUMNS)
        .eq("lang", lang)
        .order("list_title", { ascending: true })
        .range(offset, offset + WORD_LIST_BATCH_SIZE - 1);
      if (error) {
        console.error("Error getting data for sb.cache_word_list_l10n_words", error);
        break;
      }

      const dataRows = data ?? [];
      entries.push(...dataRows.filter(isSBCacheWordListL10nWordsRow)); // Add Entries
      if (dataRows.length < WORD_LIST_BATCH_SIZE) break; // Stop or Continue
      offset += WORD_LIST_BATCH_SIZE;
    }
    // console.log(`🧾 Raw: loadSBCacheWordListsForLang: for '${lang}'. (Should only happen once per runtime session.)`);
    // Update cache
    cacheWordListsByLang.set(lang, entries);
    return entries;
  })();

  cacheWordListPromisesByLang.set(lang, dataPromise);
  return dataPromise;
}

/**
 * Build scripts do not need a Supabase client or user authentication for these
 * public tables. Reading the Data API directly also keeps `@supabase/supabase-js`
 * out of Lingop and out of Prebake's consumer setup.
 */
export async function loadPublicWordListMetaData(
  options: PublicWordListsDataApiOptions,
): Promise<WordListMeta[]> {
  const rows = await loadPublicDataApiRows({
    ...options,
    table: "word_lists",
    columns: WORD_LIST_COLUMNS,
    orderColumn: "title",
    isRow: isSBWordListRow,
  });
  return rows.map(({ words: _words, ...meta }) => meta);
}

export async function loadPublicSBCacheWordListsForLang(
  lang: string,
  options: PublicWordListsDataApiOptions,
): Promise<SBCacheWordListL10nWordsRow[]> {
  return loadPublicDataApiRows({
    ...options,
    table: "cache_word_list_l10n_words",
    columns: CACHE_WORD_LIST_COLUMNS,
    orderColumn: "list_title",
    filters: { lang },
    isRow: isSBCacheWordListL10nWordsRow,
  });
}

async function loadPublicDataApiRows<T>({
  supabaseUrl,
  supabasePublicKey,
  fetchImpl = globalThis.fetch,
  table,
  columns,
  orderColumn,
  filters = {},
  isRow,
}: PublicWordListsDataApiOptions & {
  table: string;
  columns: string;
  orderColumn: string;
  filters?: Record<string, string>;
  isRow: (row: unknown) => row is T;
}): Promise<T[]> {
  if (!fetchImpl) throw new Error("Public word-list loading requires fetch.");

  const rows: T[] = [];
  for (let offset = 0; ; offset += WORD_LIST_BATCH_SIZE) {
    const url = new URL(
      `/rest/v1/${table}`,
      `${supabaseUrl.replace(/\/+$/, "")}/`,
    );
    url.searchParams.set("select", columns);
    url.searchParams.set("order", `${orderColumn}.asc`);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(WORD_LIST_BATCH_SIZE));
    for (const [column, value] of Object.entries(filters)) {
      url.searchParams.set(column, `eq.${value}`);
    }

    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", apikey: supabasePublicKey },
    });
    if (!response.ok) {
      throw new Error(
        `Public Supabase read failed for ${table}. HTTP ${response.status}.`,
      );
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(`Public Supabase read for ${table} returned non-array data.`);
    }
    rows.push(...data.filter(isRow));
    if (data.length < WORD_LIST_BATCH_SIZE) return rows;
  }
}

function isSBWordListRow(row: unknown): row is SBWordListRow {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Partial<SBWordListRow>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.lang === "string" &&
    isStringArrayOrNull(candidate.sublists) &&
    isStringArrayOrNull(candidate.words) &&
    (candidate.type === "UNIVERSAL" || candidate.type === "LANG_SPECIFIC") &&
    typeof candidate.updated_at === "string"
  );
}

function isSBCacheWordListL10nWordsRow(
  row: unknown,
): row is SBCacheWordListL10nWordsRow {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Partial<SBCacheWordListL10nWordsRow>;
  return (
    typeof candidate.lang === "string" &&
    typeof candidate.list_title === "string" &&
    isStringArray(candidate.l10n_words) &&
    typeof candidate.updated_at === "string" &&
    typeof candidate.is_human_verified === "boolean"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  return value === null || isStringArray(value);
}
