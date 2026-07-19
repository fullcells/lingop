import { getBEApiBaseUrl } from "./backend-api.js";
import {
  contentRefFromLocalization,
  isJsonDeepEqual,
  type Localization,
  type SourceContent,
} from "./misc.js";
import callAnnotate_storedForOwner from "./annotation/api-client.js";
import { convertAnnotatedEntryToAText } from "./annotation/converters.js";
import {
  utilsFetchAnnotation,
  type AnnotationCacheRef,
  type FetchAnnotationFetch,
  type FetchAnnotationFetchResponse,
} from "./annotation/fetch-annotation.js";
import type { AnnotatedText, AnnotationEntry } from "./annotation/types.js";
import utilsFetchLocalization, {
  invalidateFetchLocalizationCache,
  type TranslationCacheRef,
} from "./translation/fetch-localization.js";
import { callTranslateCreateLimitedAnon } from "./translation/api-client.js";
import type { TranslationRow } from "./translation/types.js";
import { isTranslationRow } from "./translation/validators.js";
import {
  getOneWayWordExplicitations,
  loadWordExplicitationsRows,
  type OneWayWordExplicitations,
  type WordExplicitationsRow,
} from "./word-explicitations.js";
import {
  generateEmoji,
  loadEmojiData,
  type EmojiRow,
} from "./emojify.js";
import {
  fetchAndGenGloss,
  getSBWordsForLangDir,
  isNotCoreWord,
  refreshCoreSBWordsCache,
  type GlossOutputData,
  type SBWordRow2,
} from "./sb-words.js";
import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
  type SupabaseQueryLike,
} from "./supabase.js";

export type { AnnotationCache, AnnotationCacheRef } from "./annotation/fetch-annotation.js";
export type {
  TranslationCache,
  TranslationCacheRef,
} from "./translation/fetch-localization.js";

export type AnnotationRow = AnnotationEntry & {
  id?: number;
  created_at?: string;
  [key: string]: unknown;
};

export type APIInputReAnnotate = {
  [key: string]: unknown;
};

export type SupabaseLingoDataClient = SupabaseClientLike;

export type CreateLingoDataClientOptions = {
  supabaseClient?: SupabaseLingoDataClient;
  useStagingBackend?: boolean;
};

export type LingoDataClientAuthState = {
  supabaseUserID: string | null;
  userEmail: string | null;
  signedInStatus: boolean | null;
  enabledSubProd: string | null | undefined;
};

export type LingoDataClient = {
  /** Current authenticated Supabase user id, or null while loading/signed out. */
  readonly supabaseUserID: string | null;
  /** Current authenticated Supabase user email, or null while loading/signed out. */
  readonly userEmail: string | null;
  /** True when signed in, false when signed out, null while auth is loading. */
  readonly signedInStatus: boolean | null;
  /** Current users_info.enabled_sub_prod value; undefined until first lookup completes. */
  readonly enabledSubProd: string | null | undefined;
  /** Reloads users_info.enabled_sub_prod for the current Supabase user. */
  refreshEnabledSubProd(): Promise<string | null>;
  translationsCache: TranslationCacheRef;
  t9nCacheDatesBySC: Record<string, string>;
  /** Reads or generates the newest localization for a source/target language pair. */
  fetchLocalization(input: {
    l10n_lang: string;
    sourceContent: SourceContent;
    isPublic?: boolean;
  }): Promise<Localization | null>;
  /** Merges translation rows into the owned cache and keeps newest rows first. */
  updateTranslationsCaches(sbTranslationRows: TranslationRow[]): void;
  /** Returns the last cache timestamp recorded for the given source content. */
  getT9nCacheDateBySC(sourceContent: SourceContent): string | null;
  /** Updates cache timestamps for one or more source content entries. */
  _updateT9nCacheDatesBySCs(sourceContents: SourceContent[]): void;
  /** Re-runs translation generation for an existing translation row id. */
  retranslate(input: { id: number }): Promise<TranslationRow | null>;
  /**
   * Persists a human-edited translation, updates its cache entry, and marks the
   * translator as USER.
   */
  updateTranslationWithHumanEdit(
    input: { id: number; targetText: string },
  ): Promise<TranslationRow | null>;
  annotationsByLangNTextCache: AnnotationCacheRef;
  /** Reads or generates annotation data for a localization. */
  fetchAnnotation(input: { localization: Localization }): Promise<AnnotatedText | null>;
  /** Rebuilds owner-scoped annotation data and refreshes the annotation cache. */
  reGenOwnerAnnotation(
    input: { localization: Localization; skipDeletionOfExisting?: boolean },
  ): Promise<AnnotatedText | null>;
  /** Re-runs backend annotation generation using existing stored annotation data. */
  reAnnotateWithExistingData(
    input: APIInputReAnnotate,
  ): Promise<AnnotationRow[] | null>;
  /** Loads and caches Supabase word_explicitations rows. */
  loadWordExplicitationsRows(): Promise<WordExplicitationsRow[]>;
  /** Returns source-to-target word explicitations using the shared row cache. */
  getOneWayWordExplicitations(input: {
    source_lang: string;
    source_word: string;
    target_lang: string;
  }): Promise<OneWayWordExplicitations>;
  /** Loads and caches Supabase emoji rows. */
  loadEmojiData(): Promise<EmojiRow[]>;
  /** Generates emoji text for an English gloss using the shared emoji row cache. */
  generateEmoji(
    en_gloss: string,
    study_word?: string,
    study_lang?: string,
  ): Promise<string | null>;
  /** Checks whether a word should be treated as non-core using the shared SBWords cache. */
  isNotCoreWord(word_lang: string, word: string, gloss?: string): Promise<boolean>;
  /** Loads cached SBWords for a word/gloss language direction. */
  getSBWordsForLangDir(word_lang: string, gloss_lang: string): Promise<SBWordRow2[]>;
  /** Clears and reloads cached core SBWords for a word/gloss language direction. */
  refreshCoreSBWordsCache(word_lang: string, gloss_lang: string): Promise<void>;
  /** Fetches or generates a one-word translation/gloss using explicitations and SBWords. */
  fetchAndGenGloss(input: {
    source_lang: string;
    source_word: string;
    target_lang: string;
  }): Promise<GlossOutputData | null>;
};

function createAnnotationCacheRef(): AnnotationCacheRef {
  return { current: {} };
}

function createTranslationCacheRef(): TranslationCacheRef {
  return { current: [] };
}

function createAuthState(): LingoDataClientAuthState {
  return {
    supabaseUserID: null,
    userEmail: null,
    signedInStatus: null,
    enabledSubProd: undefined,
  };
}

function hasDbRefId(ref: Localization["sourceContent"]["ref"]): boolean {
  return "db" in ref && ref.db.id != null;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return JSON.stringify(error);
}

function getFetch(): FetchAnnotationFetch {
  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required to call Lingo data APIs.");
  }

  return globalThis.fetch.bind(globalThis) as FetchAnnotationFetch;
}

async function resolveAccessToken({
  supabaseClient,
}: {
  supabaseClient?: SupabaseLingoDataClient | undefined;
}): Promise<string | null> {
  const session = await asSupabaseRuntimeClient(supabaseClient)?.auth?.getSession?.();
  return session?.data.session?.access_token ?? null;
}

async function resolveSupabaseUserID({
  supabaseClient,
}: {
  supabaseClient?: SupabaseLingoDataClient | undefined;
}): Promise<string | null> {
  const userResult = await asSupabaseRuntimeClient(supabaseClient)?.auth?.getUser?.();
  return userResult?.data.user?.id ?? null;
}

function sourceContentFromTranslationRow(translation: TranslationRow): SourceContent {
  return {
    owner_id: translation.owner_id,
    lang: translation.source_lang,
    text: translation.source_text,
    ref: translation.ref,
  };
}

function invalidateLocalizationForTranslationRow(translation: TranslationRow): void {
  invalidateFetchLocalizationCache({
    l10n_lang: translation.target_lang,
    sourceContent: sourceContentFromTranslationRow(translation),
  });
}

function upsertAnnotationCache({
  cacheRef,
  annotation,
  insertAtFront,
}: {
  cacheRef: AnnotationCacheRef;
  annotation: AnnotatedText;
  insertAtFront: boolean;
}): void {
  const { lang, lang_text: text, ref } = annotation;
  cacheRef.current[lang] ??= {};
  cacheRef.current[lang]![text] ??= [];

  const cachedTexts = cacheRef.current[lang]![text]!;
  const existingIndex = cachedTexts.findIndex((cachedAnnotation) =>
    isJsonDeepEqual(cachedAnnotation.ref ?? {}, ref ?? {}),
  );

  if (existingIndex >= 0) {
    cachedTexts.splice(existingIndex, 1);
  }

  if (insertAtFront) {
    cachedTexts.unshift(annotation);
  } else {
    cachedTexts.push(annotation);
  }
}

async function readFailedResponse(
  res: FetchAnnotationFetchResponse,
): Promise<unknown> {
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

function isTranslationRowArray(data: unknown): data is TranslationRow[] {
  return Array.isArray(data) && data.every(isTranslationRow);
}

export function createLingoDataClient({
  supabaseClient,
  useStagingBackend,
}: CreateLingoDataClientOptions = {}): LingoDataClient {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  const annotationsByLangNTextCache = createAnnotationCacheRef();
  const translationsCache = createTranslationCacheRef();
  const t9nCacheDatesBySC: Record<string, string> = {};
  const authState = createAuthState();

  function setAuthUser(
    user: { id: string; email?: string | null } | null | undefined,
  ): void {
    authState.supabaseUserID = user?.id ?? null;
    authState.userEmail = user?.email ?? null;
    authState.signedInStatus = !!user;
    if (!user) authState.enabledSubProd = null;
  }

  async function refreshEnabledSubProd(): Promise<string | null> {
    if (!runtimeSupabaseClient || !authState.supabaseUserID) {
      authState.enabledSubProd = null;
      return null;
    }

    const { data, error } = await runtimeSupabaseClient
      .from("users_info")
      .select("user_id, stripe_id, enabled_sub_prod")
      .eq("user_id", authState.supabaseUserID);

    if (error) {
      console.error("Supabase users_info select error:", errorMessage(error));
      return authState.enabledSubProd ?? null;
    }

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0];
    const enabledSubProd =
      row &&
      typeof row === "object" &&
      "enabled_sub_prod" in row &&
      (typeof row.enabled_sub_prod === "string" || row.enabled_sub_prod === null)
        ? row.enabled_sub_prod
        : null;

    authState.enabledSubProd = enabledSubProd;
    return enabledSubProd;
  }

  async function loadAuthState(): Promise<void> {
    if (!runtimeSupabaseClient) {
      setAuthUser(null);
      return;
    }

    try {
      const result = await runtimeSupabaseClient.auth?.getUser?.();
      setAuthUser(result?.data.user ?? null);
      if (authState.signedInStatus) await refreshEnabledSubProd();
    } catch (error) {
      console.error("Error getting Supabase user:", error);
      setAuthUser(null);
    }
  }

  void loadAuthState();

  runtimeSupabaseClient?.auth?.onAuthStateChange?.((_event, session) => {
    setAuthUser(session?.user ?? null);
    if (authState.signedInStatus) {
      void refreshEnabledSubProd();
    }
  });

  function getSourceContentKey(sourceContent: SourceContent): string {
    const { owner_id, lang, text, ref } = sourceContent;
    return [lang, text, JSON.stringify(ref), owner_id]
      .filter((value) => value != null)
      .join("|");
  }

  async function fetchLocalization({
    l10n_lang,
    sourceContent,
    isPublic = false,
  }: {
    l10n_lang: string;
    sourceContent: SourceContent;
    isPublic?: boolean;
  }): Promise<Localization | null> {
    return utilsFetchLocalization({
      l10n_lang,
      sourceContent,
      isPublic,
      translationsCache,
      ...(runtimeSupabaseClient
        ? {
            supabaseClient:
              runtimeSupabaseClient as NonNullable<
                Parameters<typeof utilsFetchLocalization>[0]["supabaseClient"]
              >,
          }
        : {}),
      ...(useStagingBackend === undefined ? {} : { useStagingBackend }),
    });
  }

  function updateTranslationsCaches(sbTranslationRows: TranslationRow[]): void {
    const cacheMap = new Map(translationsCache.current.map((row) => [row.id, row]));

    for (const row of sbTranslationRows) {
      cacheMap.set(row.id, row);
    }

    translationsCache.current = Array.from(cacheMap.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }

  function getT9nCacheDateBySC(sourceContent: SourceContent): string | null {
    return t9nCacheDatesBySC[getSourceContentKey(sourceContent)] ?? null;
  }

  function _updateT9nCacheDatesBySCs(sourceContents: SourceContent[]): void {
    const now = new Date().toISOString();
    for (const sourceContent of sourceContents) {
      t9nCacheDatesBySC[getSourceContentKey(sourceContent)] = now;
    }
  }

  async function updateTranslationRow({
    existingRow,
    targetText,
    translator,
  }: {
    existingRow: TranslationRow;
    targetText: string;
    translator: string;
  }): Promise<TranslationRow | null> {
    if (!runtimeSupabaseClient) {
      console.error("A Supabase client is required to update translations.");
      return null;
    }

    const updatedAt = new Date().toISOString();
    const optimisticRow: TranslationRow = {
      ...existingRow,
      target_text: targetText,
      created_at: updatedAt,
      translator,
    };

    const { data, error } = await runtimeSupabaseClient
      .from("translations")
      .update({
        target_text: targetText,
        created_at: updatedAt,
        translator,
      })
      .eq("id", existingRow.id)
      .select(
        "id, source_lang, source_text, target_lang, target_text, owner_id, created_at, translator, ref",
      );

    if (error) {
      console.error("Supabase update error:", errorMessage(error));
      return null;
    }

    const rows = isTranslationRowArray(data) ? data : [];
    return rows[0] ?? optimisticRow;
  }

  async function getTranslationRowById(id: number): Promise<TranslationRow | null> {
    const cached = translationsCache.current.find((row) => row.id === id);
    if (cached) return cached;

    if (!runtimeSupabaseClient) {
      console.error("A Supabase client is required to load uncached translations by id.");
      return null;
    }

    const { data, error } = await runtimeSupabaseClient
      .from("translations")
      .select(
        "id, source_lang, source_text, target_lang, target_text, owner_id, created_at, translator, ref",
      )
      .eq("id", id);

    if (error) {
      console.error("Supabase select error:", errorMessage(error));
      return null;
    }

    const rows = isTranslationRowArray(data) ? data : [];
    const row = rows[0] ?? null;
    if (row) updateTranslationsCaches([row]);
    return row;
  }

  async function retranslate({ id }: { id: number }): Promise<TranslationRow | null> {
    const existingRow = await getTranslationRowById(id);
    if (!existingRow) {
      console.error(`Could not find translation row ${id} for retranslation.`);
      return null;
    }

    const resolvedAccessToken = await resolveAccessToken({
      supabaseClient: runtimeSupabaseClient,
    });
    if (!resolvedAccessToken) {
      console.error("retranslate requires an access token.");
      return null;
    }

    try {
      const generated = await callTranslateCreateLimitedAnon({
        source_lang: existingRow.source_lang,
        source_text: existingRow.source_text,
        target_lang: existingRow.target_lang,
        accessToken: resolvedAccessToken,
        ...(useStagingBackend === undefined ? {} : { useStagingBackend }),
      });
      const row = await updateTranslationRow({
        existingRow,
        targetText: generated.targetText,
        translator: generated.translator,
      });
      if (!row) return null;

      updateTranslationsCaches([row]);
      invalidateLocalizationForTranslationRow(row);
      _updateT9nCacheDatesBySCs([sourceContentFromTranslationRow(row)]);
      return row;
    } catch (error) {
      console.error("callTranslateCreateLimitedAnon failed", error);
      return null;
    }
  }

  async function updateTranslationWithHumanEdit({
    id,
    targetText,
  }: {
    id: number;
    targetText: string;
  }): Promise<TranslationRow | null> {
    const existingRow = await getTranslationRowById(id);
    if (!existingRow) {
      console.error(`Could not find translation row ${id} for human edit.`);
      return null;
    }

    try {
      const row = await updateTranslationRow({
        existingRow,
        targetText,
        translator: "USER",
      });
      if (!row) return null;

      updateTranslationsCaches([row]);
      invalidateLocalizationForTranslationRow(row);
      _updateT9nCacheDatesBySCs([sourceContentFromTranslationRow(row)]);
      return row;
    } catch (error) {
      console.error("updateTranslationWithHumanEdit failed", error);
      return null;
    }
  }

  async function fetchAnnotation({
    localization,
  }: {
    localization: Localization;
  }): Promise<AnnotatedText | null> {
    return utilsFetchAnnotation({
      localization,
      annotationsByLangNTextCache,
      ...(runtimeSupabaseClient
        ? {
            supabaseClient: runtimeSupabaseClient,
          }
        : {}),
      ...(useStagingBackend === undefined ? {} : { useStagingBackend }),
    });
  }

  async function reGenOwnerAnnotation({
    localization,
    skipDeletionOfExisting = false,
  }: {
    localization: Localization;
    skipDeletionOfExisting?: boolean;
  }): Promise<AnnotatedText | null> {
    const ref = contentRefFromLocalization(localization);
    if (!ref) {
      console.error("reGenOwnerAnnotation could not derive a content ref from localization.");
      return null;
    }

    if (!skipDeletionOfExisting) {
      if (!runtimeSupabaseClient) {
        console.error("reGenOwnerAnnotation requires a Supabase client to delete existing annotations.");
        return null;
      }

      const resolvedSupabaseUserID = await resolveSupabaseUserID({
        supabaseClient: runtimeSupabaseClient,
      });

      if (!resolvedSupabaseUserID) {
        console.error(
          "reGenOwnerAnnotation requires an authenticated Supabase user to delete owner annotations.",
        );
        return null;
      }

      let query = (
        runtimeSupabaseClient.from("annotations") as unknown as {
          delete(): SupabaseQueryLike<unknown[]>;
        }
      )
        .delete()
        .eq("lang", localization.l10n_lang)
        .eq("owner_id", resolvedSupabaseUserID)
        .eq("ref", JSON.stringify(ref));

      if (!hasDbRefId(ref)) {
        query = query.eq("lang_text", localization.text);
      }

      const { error } = await query.select();
      if (error) {
        console.error("Supabase delete error:", errorMessage(error));
        return null;
      }
    }

    const resolvedAccessToken = await resolveAccessToken({
      supabaseClient: runtimeSupabaseClient,
    });
    if (!resolvedAccessToken) {
      console.error("reGenOwnerAnnotation requires an access token.");
      return null;
    }

    try {
      const annotation = await callAnnotate_storedForOwner({
        lang: localization.l10n_lang,
        text: localization.text,
        ref,
        accessToken: resolvedAccessToken,
        ...(useStagingBackend === undefined ? {} : { useStagingBackend }),
      });

      upsertAnnotationCache({
        cacheRef: annotationsByLangNTextCache,
        annotation,
        insertAtFront: true,
      });

      return annotation;
    } catch (error) {
      console.error("callAnnotate_storedForOwner failed", error);
      return null;
    }
  }

  async function reAnnotateWithExistingData(
    input: APIInputReAnnotate,
  ): Promise<AnnotationRow[] | null> {
    const resolvedAccessToken = await resolveAccessToken({
      supabaseClient: runtimeSupabaseClient,
    });
    if (!resolvedAccessToken) {
      console.error("reAnnotateWithExistingData requires an access token.");
      return null;
    }

    const requestFetch = getFetch();
    const apiBaseUrl =
      useStagingBackend === undefined
        ? getBEApiBaseUrl()
        : getBEApiBaseUrl({ useStagingBackend });
    const res = await requestFetch(`${apiBaseUrl}/api/re-annotate-with-existing-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedAccessToken}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      console.error(
        `External API call failed. HTTP ${res.status} - Data: ${JSON.stringify(
          await readFailedResponse(res),
        )}`,
      );
      return null;
    }

    const data = (await res.json()) as AnnotationRow[];
    for (const row of data) {
      const annotation = convertAnnotatedEntryToAText(row);
      if (!annotation) continue;

      upsertAnnotationCache({
        cacheRef: annotationsByLangNTextCache,
        annotation,
        insertAtFront: true,
      });
    }

    return data;
  }

  async function generateClientEmoji(
    en_gloss: string,
    study_word?: string,
    study_lang?: string,
  ): Promise<string | null> {
    return generateEmoji(en_gloss, study_word, study_lang, {
      ...(runtimeSupabaseClient
        ? {
            supabaseClient: runtimeSupabaseClient,
          }
        : {}),
      isNotCoreWord: (word_lang, word, gloss) =>
        isNotCoreWord(word_lang, word, gloss, {
          ...(runtimeSupabaseClient
            ? {
                supabaseClient: runtimeSupabaseClient,
              }
            : {}),
        }),
    });
  }

  async function fetchAndGenClientGloss(input: {
    source_lang: string;
    source_word: string;
    target_lang: string;
  }): Promise<GlossOutputData | null> {
    return fetchAndGenGloss(input, {
      ...(runtimeSupabaseClient
        ? {
            supabaseClient: runtimeSupabaseClient,
          }
        : {}),
      getOneWayWordExplicitations: (explicitationsInput) =>
        getOneWayWordExplicitations(explicitationsInput, {
          ...(runtimeSupabaseClient
            ? {
                supabaseClient: runtimeSupabaseClient,
              }
            : {}),
        }),
      generateEmojiForGloss: generateClientEmoji,
    });
  }

  return {
    get supabaseUserID() {
      return authState.supabaseUserID;
    },
    get userEmail() {
      return authState.userEmail;
    },
    get signedInStatus() {
      return authState.signedInStatus;
    },
    get enabledSubProd() {
      return authState.enabledSubProd;
    },
    refreshEnabledSubProd,
    translationsCache,
    t9nCacheDatesBySC,
    fetchLocalization,
    updateTranslationsCaches,
    getT9nCacheDateBySC,
    _updateT9nCacheDatesBySCs,
    retranslate,
    updateTranslationWithHumanEdit,
    annotationsByLangNTextCache,
    fetchAnnotation,
    reGenOwnerAnnotation,
    reAnnotateWithExistingData,
    loadWordExplicitationsRows: () =>
      loadWordExplicitationsRows({
        ...(runtimeSupabaseClient
          ? {
              supabaseClient: runtimeSupabaseClient,
            }
          : {}),
      }),
    getOneWayWordExplicitations: (input) =>
      getOneWayWordExplicitations(input, {
        ...(runtimeSupabaseClient
          ? {
              supabaseClient: runtimeSupabaseClient,
            }
          : {}),
      }),
    loadEmojiData: () =>
      loadEmojiData({
        ...(runtimeSupabaseClient
          ? {
              supabaseClient: runtimeSupabaseClient,
            }
          : {}),
      }),
    generateEmoji: generateClientEmoji,
    isNotCoreWord: (word_lang, word, gloss) =>
      isNotCoreWord(word_lang, word, gloss, {
        ...(runtimeSupabaseClient
          ? {
              supabaseClient: runtimeSupabaseClient,
            }
          : {}),
      }),
    getSBWordsForLangDir: (word_lang, gloss_lang) =>
      getSBWordsForLangDir(word_lang, gloss_lang, {
        ...(runtimeSupabaseClient
          ? {
              supabaseClient: runtimeSupabaseClient,
            }
          : {}),
      }),
    refreshCoreSBWordsCache: (word_lang, gloss_lang) =>
      refreshCoreSBWordsCache(word_lang, gloss_lang, {
        ...(runtimeSupabaseClient
          ? {
              supabaseClient: runtimeSupabaseClient,
            }
          : {}),
      }),
    fetchAndGenGloss: fetchAndGenClientGloss,
  };
}
