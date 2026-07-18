import {
  ilike,
  isSourceContentDefinitelyPublic,
  type Localization,
  type SourceContent,
} from "../misc.js";
import callTranslate_storeForOwner from "./api-client.js";
import callSBSelectTranslationsByRef from "./select-translations-by-ref.js";
import type {
  SupabaseTranslationClient,
  TranslationRow,
} from "./types.js";
import { isTranslationRow } from "./validators.js";
import { INTERNAL_API_BASE_URL } from "../backend-api.js";
import { asSupabaseRuntimeClient, type SupabaseRuntimeClient } from "../supabase.js";

const TRANSLATION_COLUMNS =
  "id, source_lang, source_text, target_lang, target_text, owner_id, created_at, translator, ref";

export type TranslationCache = TranslationRow[];

export type TranslationCacheRef = {
  current: TranslationRow[];
};

export type FetchLocalizationFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type FetchLocalizationFetch = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchLocalizationFetchResponse>;

export type FetchLocalizationInput = {
  l10n_lang: string;
  sourceContent: SourceContent;
  // FUTURE Cleanup: remove isPublic from fetchLocalization, similarly to fetchAnnotation.
  isPublic?: boolean;
  translationsCache: TranslationCacheRef;
  supabaseClient?: SupabaseTranslationClient;
  fetchImpl?: FetchLocalizationFetch;
  useStagingBackend?: boolean;
};

const inflightFetchLocalizationRequests = new Map<string, Promise<Localization | null>>();

export function getFetchLocalizationCacheKey({
  l10n_lang,
  sourceContent,
}: Pick<FetchLocalizationInput, "l10n_lang" | "sourceContent">): string {
  return [
    l10n_lang,
    sourceContent.lang,
    sourceContent.text,
    JSON.stringify(sourceContent.ref),
  ].join("|");
}

export function invalidateFetchLocalizationCache({
  l10n_lang,
  sourceContent,
}: Pick<FetchLocalizationInput, "l10n_lang" | "sourceContent">): void {
  inflightFetchLocalizationRequests.delete(
    getFetchLocalizationCacheKey({
      l10n_lang,
      sourceContent,
    }),
  );
}

function getFetch(fetchImpl: FetchLocalizationFetch | undefined): FetchLocalizationFetch {
  if (fetchImpl) return fetchImpl;

  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required to fetch public localizations.");
  }

  return globalThis.fetch.bind(globalThis) as FetchLocalizationFetch;
}

async function readFailedResponse(res: FetchLocalizationFetchResponse): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return "(could not read response body)";
    }
  }
}

function translationMatchesSource({
  translation,
  sourceContent,
  target_lang,
  isRefDbId,
  isRefFile,
}: {
  translation: TranslationRow;
  sourceContent: SourceContent;
  target_lang: string;
  isRefDbId: boolean;
  isRefFile: boolean;
}): boolean {
  const { lang: source_lang, text: source_text, ref, owner_id } = sourceContent;

  if (translation.source_lang !== source_lang) return false;
  if (translation.target_lang !== target_lang) return false;
  if (translation.owner_id !== owner_id) return false;
  if (translation.source_text !== source_text) return false;

  if (isRefFile && !translation.ref?.file) return false;

  if (isRefDbId) {
    const translationRef = translation.ref?.db;
    const sourceRef = "db" in ref ? ref.db : undefined;

    if (
      translationRef?.id !== sourceRef?.id ||
      translationRef?.column !== sourceRef?.column ||
      translationRef?.table !== sourceRef?.table
    ) {
      return false;
    }
  }

  return true;
}

function sortNewestTranslationsFirst(rows: TranslationRow[]): TranslationRow[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function fetchPublicTranslation({
  sourceContent,
  target_lang,
  fetchImpl,
}: {
  sourceContent: SourceContent;
  target_lang: string;
  fetchImpl?: FetchLocalizationFetch | undefined;
}): Promise<TranslationRow | null> {
  const requestFetch = getFetch(fetchImpl);
  const { lang: source_lang, text: source_text, ref } = sourceContent;

  const res = await requestFetch(
    `${INTERNAL_API_BASE_URL}/api/lingoprocessor/translate-get-public`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref,
        source_lang,
        target_lang,
        file_text: source_text,
      }),
    },
  );

  if (!res.ok) {
    console.error(
      `Internal /translate-get-public failed. HTTP ${res.status} - Data: ${JSON.stringify(
        await readFailedResponse(res),
      )}`,
    );
    return null;
  }

  // PENDING TODO: output translate-get-public as TranslationRow rather than {target_text}.
  const publicTranslation = await res.json();
  if (!isTranslationRow(publicTranslation)) {
    console.error("Invalid public translation row:", publicTranslation);
    return null;
  }

  return publicTranslation;
}

async function fetchFileRefTranslations({
  supabaseClient,
  sourceContent,
  target_lang,
}: {
  supabaseClient: SupabaseRuntimeClient;
  sourceContent: SourceContent;
  target_lang: string;
}): Promise<TranslationRow[] | null> {
  const { owner_id, lang: source_lang, text: source_text, ref } = sourceContent;
  const { data, error } = await supabaseClient
    .from("translations")
    .select(TRANSLATION_COLUMNS)
    .eq("owner_id", owner_id)
    .eq("source_lang", source_lang)
    .eq("target_lang", target_lang)
    .eq("ref", JSON.stringify(ref))
    .eq("source_text", source_text);

  if (error) {
    console.error("Error getting sb data where isRefFile:", error, "SourceContent:", sourceContent);
    return null;
  }

  return data?.filter(isTranslationRow) ?? [];
}

async function getAccessToken({
  supabaseClient,
}: {
  supabaseClient?: SupabaseTranslationClient | undefined;
}): Promise<string | null> {
  const session = await asSupabaseRuntimeClient(supabaseClient)?.auth?.getSession?.();
  return session?.data.session?.access_token ?? null;
}

async function _fetchLocalization2({
  l10n_lang,
  sourceContent,
  isPublic = false,
  translationsCache,
  supabaseClient,
  fetchImpl,
  useStagingBackend,
}: FetchLocalizationInput): Promise<Localization | null> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  const { lang: source_lang, text: source_text, ref, owner_id } = sourceContent;
  const target_lang = l10n_lang;
  const sourceContentIsPublic = isPublic || isSourceContentDefinitelyPublic(sourceContent);

  // 0. If target language matches source language, no translation is needed.
  if (ilike(sourceContent.lang, l10n_lang)) {
    return { text: sourceContent.text, l10n_lang, sourceContent };
  }

  // 1. Check ref validity.
  const isRefDbId = "db" in ref && !!(ref.db.id && ref.db.table && ref.db.column);
  const isRefFile = "file" in ref && !!ref.file;

  if (!isRefDbId && !isRefFile) {
    console.warn("No valid ref found in sourceContent", sourceContent);
    return null;
  }

  // A. Check caller-owned translation cache.
  let translations = translationsCache.current.filter((translation) =>
    translationMatchesSource({
      translation,
      sourceContent,
      target_lang,
      isRefDbId,
      isRefFile,
    }),
  );

  // B. Generate public translation if this is known public content.
  if (translations.length === 0 && sourceContentIsPublic) {
    const publicTranslation = await fetchPublicTranslation({
      sourceContent,
      target_lang,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
    if (publicTranslation) translations.push(publicTranslation);
  }

  // C. Check Supabase. This currently covers RefDbId and RefFile lookups.
  if (translations.length === 0) {
    if (!runtimeSupabaseClient) {
      console.error("utilsFetchLocalization requires a Supabase client for translation lookup.");
      return null;
    }

    // TODO: merge db and file approaches, using public-data-host for owner_id where isRefFile.
    if (isRefDbId) {
      const { db } = ref;
      const { data, error } = await callSBSelectTranslationsByRef({
        supabaseClient: runtimeSupabaseClient,
        owner_id,
        source_lang,
        target_lang,
        db_table: db.table,
        db_column: db.column,
        dbIds: [db.id],
      });

      if (error) {
        console.error("Error getting sb data via callSBSelectTranslationsByRef:", error);
        return null;
      }

      translations = data ?? [];
    }

    if (isRefFile) {
      const fileRefTranslations = await fetchFileRefTranslations({
        supabaseClient: runtimeSupabaseClient,
        sourceContent,
        target_lang,
      });

      if (!fileRefTranslations) return null;
      translations = fileRefTranslations;
    }
  }

  // D. If owner_id is provided and content is not public, call the backend to
  // generate translation. The backend call should automatically debit user
  // credits and fail if the user does not have enough credits.
  if (translations.length === 0 && owner_id && !sourceContentIsPublic) {
    const accessToken = await getAccessToken({ supabaseClient });
    if (!accessToken) {
      console.error("utilsFetchLocalization requires an access token to generate owner translations.");
      return null;
    }

    try {
      translations = await callTranslate_storeForOwner({
        source_lang,
        source_text,
        target_lang,
        ref,
        accessToken,
        ...(fetchImpl ? { fetchImpl } : {}),
        ...(useStagingBackend === undefined ? {} : { useStagingBackend }),
      });
    } catch (error) {
      console.error("callTranslate_storeForOwner failed", error);
      return null;
    }
  }

  // 2. Output and cache newest translation.
  if (translations.length === 0) return null;

  translations = sortNewestTranslationsFirst(translations);
  translationsCache.current = sortNewestTranslationsFirst([
    ...translationsCache.current,
    ...translations.filter(
      (row) => !translationsCache.current.some((cached) => cached.id === row.id),
    ),
  ]);

  const newestTranslation = translations[0];
  if (!newestTranslation) return null;

  return {
    text: newestTranslation.target_text,
    l10n_lang,
    sourceContent,
    translationRow: newestTranslation,
  };
}

export default async function utilsFetchLocalization(
  input: FetchLocalizationInput,
): Promise<Localization | null> {
  // TEMP in-flight requests wrapper, until translations/localizations can be
  // properly abstracted to utils.
  const key = getFetchLocalizationCacheKey(input);

  const inflightRequest = inflightFetchLocalizationRequests.get(key);
  if (inflightRequest) return inflightRequest;

  const fetchPromise = _fetchLocalization2(input);
  inflightFetchLocalizationRequests.set(key, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    // Keep this promise cached for the tab/runtime lifetime, matching legacy behavior.
    // Delete this map entry here if fetchLocalization should refetch after resolution.
  }
}
