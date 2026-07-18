import { ilike } from "./misc.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike } from "./supabase.js";

export type WordExplicitationsRow = {
  id: number;
  a_lang: string;
  b_lang: string;
  a_word_sense: string;
  a2b_explicitations: string[] | null;
  b2a_explicitations: string[] | null;
  b_word_sense: string;
};

export type OneWayWordExplicitations = {
  input: { source_lang: string; source_word: string; target_lang: string };
  rows: OneWayWordExplicitations_row[];
  targetLangIsA: boolean;
};

export type OneWayWordExplicitations_row = {
  id: number;
  word_sense: string;
  explicitations: string[] | null;
};

export type SupabaseWordExplicitationsClient = SupabaseClientLike;

const WORD_EXPLICITATIONS_BATCH_SIZE = 1000;

let wordExplicitationsRowsPromise: Promise<WordExplicitationsRow[]> | undefined;

export async function loadWordExplicitationsRows({
  supabaseClient,
  forceRefresh = false,
}: {
  supabaseClient?: SupabaseWordExplicitationsClient | undefined;
  forceRefresh?: boolean | undefined;
} = {}): Promise<WordExplicitationsRow[]> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load word explicitations.");
    return [];
  }

  if (!forceRefresh && wordExplicitationsRowsPromise) return wordExplicitationsRowsPromise;

  wordExplicitationsRowsPromise = fetchWordExplicitationsRows(runtimeSupabaseClient);
  return wordExplicitationsRowsPromise;
}

export async function getOneWayWordExplicitations(
  input: {
    source_lang: string;
    source_word: string;
    target_lang: string;
  },
  options: { supabaseClient?: SupabaseWordExplicitationsClient | undefined } = {},
): Promise<OneWayWordExplicitations> {
  const rows = await loadWordExplicitationsRows(options);
  return getOneWayWordExplicitationsFromRows(input, rows);
}

export function getOneWayWordExplicitationsFromRows(
  input: {
    source_lang: string;
    source_word: string;
    target_lang: string;
  },
  wordExplicitationsRows: WordExplicitationsRow[],
): OneWayWordExplicitations {
  const { source_lang, source_word, target_lang } = input;
  const targetLangIsA = target_lang < source_lang;
  const found = wordExplicitationsRows.filter(
    (row) =>
      (targetLangIsA
        ? ilike(row.a_lang, target_lang) && ilike(row.b_lang, source_lang)
        : ilike(row.b_lang, target_lang) && ilike(row.a_lang, source_lang)) &&
      ilike(targetLangIsA ? row.b_word_sense : row.a_word_sense, source_word),
  );

  return {
    input: { source_lang, source_word, target_lang },
    rows: found.map((row) => ({
      id: row.id,
      word_sense: targetLangIsA ? row.a_word_sense : row.b_word_sense,
      explicitations: targetLangIsA
        ? row.a2b_explicitations
        : row.b2a_explicitations,
    })),
    targetLangIsA,
  };
}

async function fetchWordExplicitationsRows(
  supabaseClient?: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>> | undefined,
): Promise<WordExplicitationsRow[]> {
  if (!supabaseClient) {
    console.error("A Supabase client is required to load word explicitations.");
    return [];
  }

  const { count, error: countError } = await supabaseClient
    .from("word_explicitations")
    .select("id", { count: "exact", head: true });

  if (countError || count == null) {
    console.error(countError);
    return [];
  }

  const entries: WordExplicitationsRow[] = [];
  for (let offset = 0; offset < count; offset += WORD_EXPLICITATIONS_BATCH_SIZE) {
    const { data, error } = await supabaseClient
      .from("word_explicitations")
      .select(
        "id, a_lang, b_lang, a_word_sense, a2b_explicitations, b2a_explicitations, b_word_sense",
      )
      .order("id", { ascending: true })
      .range(offset, offset + WORD_EXPLICITATIONS_BATCH_SIZE - 1);

    if (error) {
      console.error("Error getting data for sb.word_explicitations", error);
      return [];
    }

    entries.push(...((data ?? []).filter(isWordExplicitationsRow)));
  }

  return entries;
}

function isWordExplicitationsRow(row: unknown): row is WordExplicitationsRow {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Partial<WordExplicitationsRow>;

  return (
    typeof candidate.id === "number" &&
    typeof candidate.a_lang === "string" &&
    typeof candidate.b_lang === "string" &&
    typeof candidate.a_word_sense === "string" &&
    typeof candidate.b_word_sense === "string" &&
    isStringArrayOrNull(candidate.a2b_explicitations) &&
    isStringArrayOrNull(candidate.b2a_explicitations)
  );
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  return value === null || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}
