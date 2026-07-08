import type { AnnotatedText } from "./types.js";
import { getBEApiBaseUrl } from "../backend-api.js";

const ANNOTATE_BATCH_WAIT_MS = 50;
const ANNOTATE_API_MAX_TEXTS = 10;

export type AnnotateFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type AnnotateFetch = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<AnnotateFetchResponse>;

type AnnotateRequest = {
  text: string;
  resolve: (value: AnnotatedText) => void;
  reject: (reason?: unknown) => void;
};

type AnnotateBatch = {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl: AnnotateFetch;
  lang: string;
  ref: unknown;
  requests: AnnotateRequest[];
};

export type AnnotateAPIOutput = {
  langHasPhonetics: boolean;
  annotatedTexts: AnnotatedText[];
};

export type CallAnnotateStoredForOwnerInput = {
  lang: string;
  ref: unknown;
  text: string;
  accessToken: string;
  useStagingBackend?: boolean;
  fetchImpl?: AnnotateFetch;
};

const inflightRequests: Record<string, Promise<AnnotatedText> | undefined> = {};
const batches: Record<string, AnnotateBatch | undefined> = {};
const batchTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function getFetch(fetchImpl: AnnotateFetch | undefined): AnnotateFetch {
  if (fetchImpl) return fetchImpl;

  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required to call /api/annotate.");
  }

  return globalThis.fetch.bind(globalThis) as AnnotateFetch;
}

function getBatchKey({
  apiBaseUrl,
  accessToken,
  lang,
  ref,
}: {
  apiBaseUrl: string;
  accessToken: string;
  lang: string;
  ref: unknown;
}): string {
  return [apiBaseUrl, accessToken, lang, JSON.stringify(ref)].join(":");
}

function parseAnnotateAPIOutput(data: unknown): AnnotateAPIOutput {
  const output = data as Partial<AnnotateAPIOutput>;

  if (!Array.isArray(output.annotatedTexts)) {
    throw new Error("External /annotate returned malformed data.");
  }

  return {
    langHasPhonetics: output.langHasPhonetics ?? false,
    annotatedTexts: output.annotatedTexts,
  };
}

async function readErrorResponse(res: AnnotateFetchResponse): Promise<unknown> {
  try {
    const rawText = await res.text();

    try {
      return JSON.parse(rawText) as unknown;
    } catch {
      return rawText;
    }
  } catch {
    return "(could not read response body)";
  }
}

async function callAnnotateApi({
  apiBaseUrl,
  accessToken,
  fetchImpl,
  lang,
  texts,
  ref,
}: {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl: AnnotateFetch;
  lang: string;
  texts: string[];
  ref: unknown;
}): Promise<AnnotateAPIOutput> {
  for (const text of texts) {
    if (text.trim() !== text) {
      console.warn(
        `_caa: Text has whitespace at start/end. BE /annotate historically struggles with this case; trim upstream where possible. Text: "${text}"`,
      );
    }
  }

  const res = await fetchImpl(`${apiBaseUrl}/api/annotate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      lang,
      texts,
      ref,
    }),
  });

  if (!res.ok) {
    const errorData = await readErrorResponse(res);

    if (res.status === 429) {
      throw new Error(
        `Too many requests to /annotate (HTTP 429). Data: ${JSON.stringify(errorData)}`,
      );
    }

    throw new Error(
      `External /annotate failed. HTTP ${res.status}. Data: ${JSON.stringify(errorData)}`,
    );
  }

  return parseAnnotateAPIOutput(await res.json());
}

async function flushBatch(batchKey: string): Promise<void> {
  const batch = batches[batchKey];
  if (!batch) return;

  delete batches[batchKey];

  const timer = batchTimers[batchKey];
  if (timer) {
    clearTimeout(timer);
    delete batchTimers[batchKey];
  }

  if (batch.requests.length === 0) return;

  const uniqueTexts = Array.from(new Set(batch.requests.map((request) => request.text)));

  try {
    const annotatedTexts: AnnotatedText[] = [];

    for (let index = 0; index < uniqueTexts.length; index += ANNOTATE_API_MAX_TEXTS) {
      const chunk = uniqueTexts.slice(index, index + ANNOTATE_API_MAX_TEXTS);
      const result = await callAnnotateApi({
        apiBaseUrl: batch.apiBaseUrl,
        accessToken: batch.accessToken,
        fetchImpl: batch.fetchImpl,
        lang: batch.lang,
        texts: chunk,
        ref: batch.ref,
      });

      annotatedTexts.push(...result.annotatedTexts);
    }

    const annotatedByText = new Map(
      annotatedTexts.map((annotatedText) => [annotatedText.lang_text, annotatedText]),
    );

    for (const request of batch.requests) {
      const annotatedText = annotatedByText.get(request.text);

      if (annotatedText) {
        request.resolve(annotatedText);
      } else {
        request.reject(new Error(`Requested text not found in /annotate response: ${request.text}`));
      }
    }
  } catch (error) {
    for (const request of batch.requests) {
      request.reject(error);
    }
  }
}

export async function callAnnotate_storedForOwner({
  lang,
  ref,
  text,
  accessToken,
  useStagingBackend,
  fetchImpl,
}: CallAnnotateStoredForOwnerInput): Promise<AnnotatedText> {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(
    useStagingBackend === undefined
      ? getBEApiBaseUrl()
      : getBEApiBaseUrl({ useStagingBackend }),
  );
  const requestFetch = getFetch(fetchImpl);
  const batchKey = getBatchKey({
    apiBaseUrl: normalizedApiBaseUrl,
    accessToken,
    lang,
    ref,
  });
  const requestKey = `${batchKey}:${text}`;
  const existingRequest = inflightRequests[requestKey];

  if (existingRequest) return existingRequest;

  const request = new Promise<AnnotatedText>((resolve, reject) => {
    const existingBatch = batches[batchKey];

    if (existingBatch) {
      existingBatch.requests.push({ text, resolve, reject });
      return;
    }

    batches[batchKey] = {
      apiBaseUrl: normalizedApiBaseUrl,
      accessToken,
      fetchImpl: requestFetch,
      lang,
      ref,
      requests: [{ text, resolve, reject }],
    };
    batchTimers[batchKey] = setTimeout(() => {
      void flushBatch(batchKey);
    }, ANNOTATE_BATCH_WAIT_MS);
  });

  inflightRequests[requestKey] = request;
  request.then(
    () => {
      delete inflightRequests[requestKey];
    },
    () => {
      delete inflightRequests[requestKey];
    },
  );

  return request;
}

export default callAnnotate_storedForOwner;
