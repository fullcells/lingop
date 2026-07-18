import {
  contentRefFromLocalization,
  isJsonDeepEqual,
  isLocalizationDefinitelyFromPublicSource,
  type ContentReference,
  type Localization,
} from "../misc.js";
import callAnnotate_storedForOwner, { type AnnotateFetch } from "./api-client.js";
import { convertAnnotatedEntryToAText } from "./converters.js";
import type { AnnotatedText, AnnotationEntry } from "./types.js";
import { INTERNAL_API_BASE_URL } from "../backend-api.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike } from "../supabase.js";

const MAX_ANNOTATION_BATCH_SIZE = 10;
const ANNOTATION_BATCH_WINDOW_MS = 20;
const MAX_CONCURRENT_ANNOTATION_FETCHES = 2;

export type AnnotationCache = Record<string, Record<string, AnnotatedText[]>>;

export type AnnotationCacheRef = {
  current: AnnotationCache;
};

export type SupabaseAnnotationClient = SupabaseClientLike;

export type FetchAnnotationFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type FetchAnnotationFetch = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchAnnotationFetchResponse>;

export type FetchAnnotationInput = {
  localization: Localization;
  annotationsByLangNTextCache: AnnotationCacheRef;
  supabaseClient?: SupabaseAnnotationClient;
  accessToken?: string;
  getAccessToken?: () => Promise<string | null | undefined>;
  fetchImpl?: FetchAnnotationFetch;
  annotateFetchImpl?: AnnotateFetch;
  useStagingBackend?: boolean;
};

type FetchAnnotationBatchItem = {
  localization: Localization;
  annotationsByLangNTextCache: AnnotationCacheRef;
  supabaseClient?: SupabaseAnnotationClient | undefined;
  accessToken?: string | undefined;
  getAccessToken?: (() => Promise<string | null | undefined>) | undefined;
  fetchImpl?: FetchAnnotationFetch | undefined;
  annotateFetchImpl?: AnnotateFetch | undefined;
  useStagingBackend?: boolean | undefined;
};

type QueuedFetchAnnotationRequest = FetchAnnotationBatchItem & {
  key: string;
  resolve: (value: AnnotatedText | null) => void;
  reject: (reason?: unknown) => void;
};

type AnnotationFetchState = FetchAnnotationBatchItem & {
  lang: string;
  text: string;
  ref: ContentReference | null;
  isRefFile: boolean;
  belongsToPublicSuperAdmin: boolean;
  output: AnnotatedText | null;
  fromCache: boolean;
  failed: boolean;
};

const queuedFetchAnnotationRequests: QueuedFetchAnnotationRequest[] = [];
const inflightFetchAnnotationRequests = new Map<string, Promise<AnnotatedText | null>>();
let queueFlushScheduled = false;
let activeAnnotationFetches = 0;

function keyFromLocalization(localization: Localization): string {
  return [
    localization.l10n_lang,
    localization.text,
    JSON.stringify(contentRefFromLocalization(localization)),
    JSON.stringify(localization.sourceContent),
  ].join("|");
}

function getFetch(fetchImpl: FetchAnnotationFetch | undefined): FetchAnnotationFetch {
  if (fetchImpl) return fetchImpl;

  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required to call annotation APIs.");
  }

  return globalThis.fetch.bind(globalThis) as FetchAnnotationFetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  fetchImpl: FetchAnnotationFetch,
  url: string,
  options: Parameters<FetchAnnotationFetch>[1],
  retries = 3,
  delayMs = 250,
): Promise<FetchAnnotationFetchResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, options);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) return res;
      if (attempt === retries) return res;
    } catch (error) {
      if (attempt === retries) throw error;
    }

    await sleep(delayMs * 2 ** attempt);
  }

  throw new Error("fetchWithRetry: exhausted retries");
}

function scheduleAnnotationQueueFlush(): void {
  if (queueFlushScheduled) return;
  queueFlushScheduled = true;
  setTimeout(() => {
    queueFlushScheduled = false;
    flushAnnotationQueue();
  }, ANNOTATION_BATCH_WINDOW_MS);
}

function flushAnnotationQueue(): void {
  while (
    activeAnnotationFetches < MAX_CONCURRENT_ANNOTATION_FETCHES &&
    queuedFetchAnnotationRequests.length > 0
  ) {
    const batch = queuedFetchAnnotationRequests.splice(0, MAX_ANNOTATION_BATCH_SIZE);

    if (queuedFetchAnnotationRequests.length > 20) {
      console.log(
        `(Remaining>20 Msg:) [fetchAnnotation queue] flushing batch size=${batch.length}, remaining=${queuedFetchAnnotationRequests.length}, active=${activeAnnotationFetches + 1}`,
      );
    }

    activeAnnotationFetches++;
    void processAnnotationBatch(batch);
  }
}

async function processAnnotationBatch(
  batch: QueuedFetchAnnotationRequest[],
): Promise<void> {
  try {
    const results = await fetchAnnotationsBatch({
      items: batch.map(
        ({
          localization,
          annotationsByLangNTextCache,
          supabaseClient,
          accessToken,
          getAccessToken,
          fetchImpl,
          annotateFetchImpl,
          useStagingBackend,
        }) => ({
          localization,
          annotationsByLangNTextCache,
          supabaseClient,
          accessToken,
          getAccessToken,
          fetchImpl,
          annotateFetchImpl,
          useStagingBackend,
        }),
      ),
    });

    batch.forEach((request, index) => {
      request.resolve(results[index] ?? null);
    });
  } catch (error) {
    batch.forEach((request) => request.reject(error));
  } finally {
    activeAnnotationFetches--;
    if (queuedFetchAnnotationRequests.length > 0) {
      scheduleAnnotationQueueFlush();
    }
  }
}

async function fetchAnnotationDataForState(
  state: AnnotationFetchState,
): Promise<AnnotationEntry[]> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(state.supabaseClient);
  if (!runtimeSupabaseClient) return [];

  let data: unknown[] | null | undefined;
  let finalError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let query = runtimeSupabaseClient
      .from("annotations")
      .select(
        "id, lang, lang_text, lang_tokens, lang_gloss, lang_phonetics_2, created_at, owner_id, ref",
      )
      .eq("lang", state.lang)
      .eq("ref", JSON.stringify(state.ref));

    if (state.isRefFile) {
      query = query.eq("lang_text", state.text);
    }

    const result = await query;
    if (!result.error) {
      data = result.data;
      finalError = undefined;
      break;
    }

    finalError = result.error;
    console.warn(`[3] SB fetch failed, attempt ${attempt}/3`, result.error);
    if (attempt < 3) {
      await sleep(250 * 2 ** (attempt - 1));
    }
  }

  if (finalError) throw finalError;
  return (data ?? []) as AnnotationEntry[];
}

async function getAccessTokenForState(
  state: AnnotationFetchState,
): Promise<string | null> {
  if (state.accessToken) return state.accessToken;
  if (state.getAccessToken) return (await state.getAccessToken()) ?? null;

  const session = await asSupabaseRuntimeClient(state.supabaseClient)?.auth?.getSession?.();
  return session?.data.session?.access_token ?? null;
}

export async function utilsFetchAnnotation({
  localization,
  annotationsByLangNTextCache,
  supabaseClient,
  accessToken,
  getAccessToken,
  fetchImpl,
  annotateFetchImpl,
  useStagingBackend,
}: FetchAnnotationInput): Promise<AnnotatedText | null> {
  if (!localization) {
    console.error("fetchAnnotation: Provided localization was undefined.");
    return null;
  }

  const key = keyFromLocalization(localization);
  const existingRequest = inflightFetchAnnotationRequests.get(key);
  if (existingRequest) return existingRequest;

  const fetchPromise = new Promise<AnnotatedText | null>((resolve, reject) => {
    queuedFetchAnnotationRequests.push({
      key,
      localization,
      annotationsByLangNTextCache,
      supabaseClient,
      accessToken,
      getAccessToken,
      fetchImpl,
      annotateFetchImpl,
      useStagingBackend,
      resolve,
      reject,
    });
    scheduleAnnotationQueueFlush();
  });

  inflightFetchAnnotationRequests.set(key, fetchPromise);
  fetchPromise.finally(() => {
    inflightFetchAnnotationRequests.delete(key);
  });

  return fetchPromise;
}

export async function fetchAnnotationsBatch({
  items,
}: {
  items: FetchAnnotationBatchItem[];
}): Promise<Array<AnnotatedText | null>> {
  if (items.length > MAX_ANNOTATION_BATCH_SIZE) {
    console.warn(
      `_fetchAnnotation received ${items.length} items; expected max ${MAX_ANNOTATION_BATCH_SIZE}. Only processing first ${MAX_ANNOTATION_BATCH_SIZE}.`,
    );
    items = items.slice(0, MAX_ANNOTATION_BATCH_SIZE);
  }

  const states: AnnotationFetchState[] = items.map((item) => {
    const { localization } = item;
    if (localization.text.trim() !== localization.text) {
      console.warn(
        `_fa: Text has whitespace at start/end. BE /annotate historically struggles with this case. Trim upstream where possible. Text: "${localization.text}"`,
      );
    }

    const ref = contentRefFromLocalization(localization);
    if (!ref) {
      console.warn("No valid ref found in l10n:", localization);
    }

    return {
      ...item,
      lang: localization.l10n_lang,
      text: localization.text,
      ref,
      isRefFile: !!ref && "file" in ref,
      belongsToPublicSuperAdmin: isLocalizationDefinitelyFromPublicSource(localization),
      output: null,
      fromCache: false,
      failed: !ref,
    };
  });

  // A. Check annotation cache.
  for (const state of states) {
    if (state.failed || !state.ref) continue;

    const cachedATexts =
      state.annotationsByLangNTextCache.current[state.lang]?.[state.text] ?? [];
    if (!cachedATexts.length) continue;

    const cachedATextWithRef =
      cachedATexts.find((annotatedText) =>
        isJsonDeepEqual(annotatedText?.ref ?? {}, state.ref),
      ) ?? null;

    if (cachedATextWithRef) {
      state.output = cachedATextWithRef;
      state.fromCache = true;
      continue;
    }

    if (state.belongsToPublicSuperAdmin) {
      state.output = cachedATexts[0] ?? null;
      state.fromCache = !!state.output;
    }
  }

  // B. Fetch public annotations for known public source content.
  const publicAnnotationGroups = new Map<
    string,
    { lang: string; ref: ContentReference; states: AnnotationFetchState[] }
  >();

  for (const state of states) {
    if (state.failed || state.output || !state.ref) continue;
    if (!state.belongsToPublicSuperAdmin) continue;

    const key = `${state.lang}::${JSON.stringify(state.ref)}`;
    let group = publicAnnotationGroups.get(key);
    if (!group) {
      group = { lang: state.lang, ref: state.ref, states: [] };
      publicAnnotationGroups.set(key, group);
    }
    group.states.push(state);
  }

  await Promise.all(
    Array.from(publicAnnotationGroups.values()).map(async ({ lang, ref, states: group }) => {
      const firstState = group[0];
      if (!firstState) return;

      const input = {
        lang,
        ref,
        file_texts: group.map((state) => state.text),
      };

      try {
        const requestFetch = getFetch(firstState.fetchImpl);
        const res = await fetchWithRetry(
          requestFetch,
          `${INTERNAL_API_BASE_URL}/api/lingoprocessor/annotate-get-public`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );

        if (!res.ok) {
          const data = await res.text();
          console.error(
            `Internal /annotate-get-public failed. - Input: ${JSON.stringify(input)} - Data: ${data}`,
          );
          for (const state of group) state.failed = true;
          return;
        }

        const publicATexts = (await res.json()) as Array<AnnotatedText | null>;
        if (!Array.isArray(publicATexts)) {
          console.error(
            `Internal /annotate-get-public returned invalid response. - Input: ${JSON.stringify(input)}`,
          );
          for (const state of group) state.failed = true;
          return;
        }

        for (let index = 0; index < group.length; index++) {
          const publicAText = publicATexts[index];
          if (publicAText) {
            group[index]!.output = publicAText;
          }
        }
      } catch (error) {
        console.error("Internal /annotate-get-public threw error.", error);
        for (const state of group) state.failed = true;
      }
    }),
  );

  // C. Check Supabase annotations table by ref.
  const statesToCheck = states.filter((state) => !state.failed && !state.output);
  await Promise.all(
    statesToCheck.map(async (state) => {
      try {
        const fetchedAnnotationEntries = await fetchAnnotationDataForState(state);
        const fetchedAnnotatedTexts = fetchedAnnotationEntries
          .map((entry) => convertAnnotatedEntryToAText(entry))
          .filter((annotatedText): annotatedText is AnnotatedText => Boolean(annotatedText));

        if (fetchedAnnotatedTexts.length > 0) {
          state.output = fetchedAnnotatedTexts[0] ?? null;
        }
      } catch (error) {
        console.error("[3] Fetch SB by Ref: sb select error after retries:", error, "state:", state);
        state.failed = true;
      }
    }),
  );

  // D. Generate owner annotations through the backend.
  const incompleteStates = states.filter((state) => !state.failed && !state.output);
  if (incompleteStates.length > 0) {
    await Promise.allSettled(
      incompleteStates.map(async (state) => {
        try {
          const accessToken = await getAccessTokenForState(state);
          if (!accessToken || !state.ref) return;

          const annotateInput = {
            lang: state.localization.l10n_lang,
            text: state.localization.text,
            ref: state.ref,
            accessToken,
          };

          state.output = await callAnnotate_storedForOwner({
            ...annotateInput,
            ...(state.annotateFetchImpl ? { fetchImpl: state.annotateFetchImpl } : {}),
            ...(state.useStagingBackend === undefined
              ? {}
              : { useStagingBackend: state.useStagingBackend }),
          });
        } catch (error) {
          console.error("callAnnotate_storedForOwner failed", error);
          state.failed = true;
        }
      }),
    );
  }

  // E. Update cache with newly fetched/generated annotations.
  for (const state of states) {
    if (!state.output || state.fromCache || !state.ref) continue;

    state.annotationsByLangNTextCache.current[state.lang] ??= {};
    state.annotationsByLangNTextCache.current[state.lang]![state.text] ??= [];

    const cachedTexts = state.annotationsByLangNTextCache.current[state.lang]![state.text]!;
    const alreadyCached = cachedTexts.some((annotatedText) =>
      isJsonDeepEqual(annotatedText?.ref ?? {}, state.ref),
    );

    if (!alreadyCached) {
      cachedTexts.push(state.output);
    }
  }

  // F. Output annotations in the same order as requested.
  return states.map((state) => state.output);
}

export default utilsFetchAnnotation;
