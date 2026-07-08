import { getBEApiBaseUrl } from "../backend-api.js";
import type { TranslationRow } from "./types.js";
import { isTranslationRow } from "./validators.js";

// TODO: BATCHING where grouped values are refs + source_texts, akin to
// callAnnotate_storedForOwner and callSBSelectTranslationsByRef. This currently
// dedupes in-flight matching requests only.

export type TranslateFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type TranslateFetch = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<TranslateFetchResponse>;

export type CallTranslateStoreForOwnerInput = {
  source_lang: string;
  source_text: string;
  target_lang: string;
  ref: unknown;
  options?: string[];
  accessToken: string;
  useStagingBackend?: boolean;
  fetchImpl?: TranslateFetch;
};

export type TranslateCreateLimitedAnonOutput = {
  targetText: string;
  translator: string;
};

export type CallTranslateCreateLimitedAnonInput = {
  source_lang: string;
  source_text: string;
  target_lang: string;
  accessToken: string;
  useStagingBackend?: boolean;
  fetchImpl?: TranslateFetch;
};

type CallTranslateApiInput = Required<
  Pick<
    CallTranslateStoreForOwnerInput,
    "source_lang" | "source_text" | "target_lang" | "ref" | "options" | "accessToken"
  >
> & {
  fetchImpl: TranslateFetch;
  useStagingBackend?: boolean | undefined;
};

const inflightRequests: Record<string, Promise<TranslationRow[]> | undefined> = {};

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function getFetch(fetchImpl: TranslateFetch | undefined): TranslateFetch {
  if (fetchImpl) return fetchImpl;

  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required to call /api/translate.");
  }

  return globalThis.fetch.bind(globalThis) as TranslateFetch;
}

async function readErrorResponse(res: TranslateFetchResponse): Promise<unknown> {
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

function parseTranslateAPIOutput(data: unknown): TranslationRow[] {
  if (!Array.isArray(data)) {
    throw new Error("External /translate returned malformed data.");
  }

  const rows = data.filter(isTranslationRow);
  if (rows.length !== data.length) {
    throw new Error("External /translate returned malformed translation rows.");
  }

  return rows;
}

function parseTranslateCreateLimitedAnonOutput(data: unknown): TranslateCreateLimitedAnonOutput {
  if (data === null || typeof data !== "object") {
    throw new Error("External /translate-create-limited-anon returned malformed data.");
  }

  const output = data as Record<string, unknown>;
  if (
    typeof output.target_text !== "string" ||
    typeof output.translator !== "string"
  ) {
    throw new Error("External /translate-create-limited-anon returned malformed data.");
  }

  return {
    targetText: output.target_text,
    translator: output.translator,
  };
}

async function callTranslateApi({
  source_lang,
  source_text,
  target_lang,
  ref,
  options,
  accessToken,
  useStagingBackend,
  fetchImpl,
}: CallTranslateApiInput): Promise<TranslationRow[]> {
  const apiBaseUrl = normalizeApiBaseUrl(
    useStagingBackend === undefined
      ? getBEApiBaseUrl()
      : getBEApiBaseUrl({ useStagingBackend }),
  );

  const res = await fetchImpl(`${apiBaseUrl}/api/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      source_lang,
      target_lang,
      source_texts: [source_text],
      refs: [ref],
      options,
    }),
  });

  if (!res.ok) {
    const errorData = await readErrorResponse(res);

    if (res.status === 402) {
      throw new Error(
        `Insufficient credits for /translate (HTTP 402). Data: ${JSON.stringify(errorData)}`,
      );
    }

    if (res.status === 429) {
      throw new Error(
        `Too many requests to /translate (HTTP 429). Data: ${JSON.stringify(errorData)}`,
      );
    }

    throw new Error(
      `External /translate failed. HTTP ${res.status}. Data: ${JSON.stringify(errorData)}`,
    );
  }

  return parseTranslateAPIOutput(await res.json());
}

export function callTranslate_storeForOwner({
  source_lang,
  target_lang,
  source_text,
  ref,
  options = [],
  accessToken,
  useStagingBackend,
  fetchImpl,
}: CallTranslateStoreForOwnerInput): Promise<TranslationRow[]> {
  const requestFetch = getFetch(fetchImpl);
  const batchKey = [source_lang, target_lang, options.join(",")].join(":");
  const requestKey = `${batchKey}:${source_text}:${JSON.stringify(ref)}`;
  const inflightRequest = inflightRequests[requestKey];
  if (inflightRequest) return inflightRequest;

  const request = callTranslateApi({
    source_lang,
    target_lang,
    source_text,
    ref,
    options,
    accessToken,
    fetchImpl: requestFetch,
    ...(useStagingBackend === undefined ? {} : { useStagingBackend }),
  });

  inflightRequests[requestKey] = request;
  void request.finally(() => {
    delete inflightRequests[requestKey];
  });

  return request;
}

export async function callTranslateCreateLimitedAnon({
  source_lang,
  source_text,
  target_lang,
  accessToken,
  useStagingBackend,
  fetchImpl,
}: CallTranslateCreateLimitedAnonInput): Promise<TranslateCreateLimitedAnonOutput> {
  const requestFetch = getFetch(fetchImpl);
  const apiBaseUrl =
    useStagingBackend === undefined
      ? getBEApiBaseUrl()
      : getBEApiBaseUrl({ useStagingBackend });

  const res = await requestFetch(`${normalizeApiBaseUrl(apiBaseUrl)}/api/translate-create-limited-anon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      source_lang,
      target_lang,
      source_text,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `External /translate-create-limited-anon failed. HTTP ${res.status}. Data: ${JSON.stringify(
        await readErrorResponse(res),
      )}`,
    );
  }

  return parseTranslateCreateLimitedAnonOutput(await res.json());
}

export default callTranslate_storeForOwner;
