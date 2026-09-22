import { getBEApiBaseUrl } from "../backend-api.js";
import {
  SIGN_LANGUAGE_NAMES,
  type GlossLanguageCode,
  type SignLanguageCode,
} from "../language/data/sign-languages.js";
import type { TranslateFetch, TranslateFetchResponse } from "./api-client.js";

export type SignWordGloss = {
  gloss: string;
  glossLang: string;
  position: number;
};

export type OralToSignedToken =
  | {
      type: "sign_word";
      signWordId: number;
      signLang: SignLanguageCode;
      glosses: SignWordGloss[];
      searchQuery: string;
      fromRelatedSignLanguage: boolean;
    }
  | {
      type: "fingerspell";
      text: string;
      reason: "no_dictionary_match";
    };

export type OralToSignedTranslation = {
  direction: "oral-to-signed";
  sourceLang: string;
  targetLang: SignLanguageCode;
  sourceText: string;
  searchLanguage: GlossLanguageCode;
  signWordSourceLanguages: SignLanguageCode[];
  tokens: OralToSignedToken[];
  signWordIds: number[];
  translator: string;
  warnings: string[];
};

export type SignedToOralSourceSignWord = {
  id: number;
  signLang: SignLanguageCode;
  glosses: SignWordGloss[];
  fromRelatedSignLanguage: boolean;
};

export type SignedToOralTranslation = {
  direction: "signed-to-oral";
  sourceLang: SignLanguageCode;
  targetLang: string;
  sourceSignWordIds: number[];
  sourceSignWords: SignedToOralSourceSignWord[];
  targetText: string;
  translator: string;
  warnings: string[];
};

type SharedLimitedAnonInput = {
  source_lang: string;
  target_lang: string;
  accessToken?: string;
  useStagingBackend?: boolean;
  fetchImpl?: TranslateFetch;
};

export type CallTranslateOralToSignedLimitedAnonInput = SharedLimitedAnonInput & {
  source_text: string;
};

export type CallTranslateSignedToOralLimitedAnonInput = SharedLimitedAnonInput & {
  source_signword_ids: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSignLanguageCode(value: unknown): value is SignLanguageCode {
  return typeof value === "string" && Object.hasOwn(SIGN_LANGUAGE_NAMES, value);
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`External /translate-create-limited-anon returned malformed ${field}.`);
  }
  return value;
}

function parsePositiveIntegerArray(value: unknown, field: string): number[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => Number.isSafeInteger(item) && Number(item) > 0)
  ) {
    throw new Error(`External /translate-create-limited-anon returned malformed ${field}.`);
  }
  return value as number[];
}

function parseSignLanguageArray(value: unknown, field: string): SignLanguageCode[] {
  if (!Array.isArray(value) || !value.every(isSignLanguageCode)) {
    throw new Error(`External /translate-create-limited-anon returned malformed ${field}.`);
  }
  return value;
}

function parseGlosses(value: unknown): SignWordGloss[] {
  if (!Array.isArray(value)) {
    throw new Error("External /translate-create-limited-anon returned malformed glosses.");
  }
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.gloss !== "string" ||
      typeof entry.gloss_lang !== "string" ||
      typeof entry.position !== "number" ||
      !Number.isFinite(entry.position)
    ) {
      throw new Error("External /translate-create-limited-anon returned malformed glosses.");
    }
    return {
      gloss: entry.gloss,
      glossLang: entry.gloss_lang,
      position: entry.position,
    };
  });
}

function parseOralToSignedToken(value: unknown): OralToSignedToken {
  if (!isRecord(value)) {
    throw new Error("External /translate-create-limited-anon returned malformed tokens.");
  }
  if (value.type === "fingerspell") {
    if (typeof value.text !== "string" || value.reason !== "no_dictionary_match") {
      throw new Error("External /translate-create-limited-anon returned malformed tokens.");
    }
    return { type: "fingerspell", text: value.text, reason: value.reason };
  }
  if (
    value.type !== "sign_word" ||
    !Number.isSafeInteger(value.sign_word_id) ||
    Number(value.sign_word_id) <= 0 ||
    !isSignLanguageCode(value.sign_lang) ||
    typeof value.search_query !== "string" ||
    typeof value.from_related_sign_language !== "boolean"
  ) {
    throw new Error("External /translate-create-limited-anon returned malformed tokens.");
  }
  return {
    type: "sign_word",
    signWordId: value.sign_word_id as number,
    signLang: value.sign_lang,
    glosses: parseGlosses(value.glosses),
    searchQuery: value.search_query,
    fromRelatedSignLanguage: value.from_related_sign_language,
  };
}

function parseOralToSignedTranslation(data: unknown): OralToSignedTranslation {
  if (
    !isRecord(data) ||
    data.direction !== "oral-to-signed" ||
    typeof data.source_lang !== "string" ||
    !isSignLanguageCode(data.target_lang) ||
    typeof data.source_text !== "string" ||
    typeof data.search_language !== "string" ||
    !Array.isArray(data.tokens) ||
    typeof data.translator !== "string"
  ) {
    throw new Error("External /translate-create-limited-anon returned malformed Oral-to-Signed data.");
  }
  return {
    direction: data.direction,
    sourceLang: data.source_lang,
    targetLang: data.target_lang,
    sourceText: data.source_text,
    searchLanguage: data.search_language as GlossLanguageCode,
    signWordSourceLanguages: parseSignLanguageArray(
      data.signword_source_languages,
      "signword_source_languages",
    ),
    tokens: data.tokens.map(parseOralToSignedToken),
    signWordIds: parsePositiveIntegerArray(data.signword_ids, "signword_ids"),
    translator: data.translator,
    warnings: parseStringArray(data.warnings, "warnings"),
  };
}

function parseSourceSignWord(value: unknown): SignedToOralSourceSignWord {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) <= 0 ||
    !isSignLanguageCode(value.sign_lang) ||
    typeof value.from_related_sign_language !== "boolean"
  ) {
    throw new Error("External /translate-create-limited-anon returned malformed source_sign_words.");
  }
  return {
    id: value.id as number,
    signLang: value.sign_lang,
    glosses: parseGlosses(value.glosses),
    fromRelatedSignLanguage: value.from_related_sign_language,
  };
}

function parseSignedToOralTranslation(data: unknown): SignedToOralTranslation {
  if (
    !isRecord(data) ||
    data.direction !== "signed-to-oral" ||
    !isSignLanguageCode(data.source_lang) ||
    typeof data.target_lang !== "string" ||
    !Array.isArray(data.source_sign_words) ||
    typeof data.target_text !== "string" ||
    typeof data.translator !== "string"
  ) {
    throw new Error("External /translate-create-limited-anon returned malformed Signed-to-Oral data.");
  }
  return {
    direction: data.direction,
    sourceLang: data.source_lang,
    targetLang: data.target_lang,
    sourceSignWordIds: parsePositiveIntegerArray(
      data.source_signword_ids,
      "source_signword_ids",
    ),
    sourceSignWords: data.source_sign_words.map(parseSourceSignWord),
    targetText: data.target_text,
    translator: data.translator,
    warnings: parseStringArray(data.warnings, "warnings"),
  };
}

function getFetch(fetchImpl: TranslateFetch | undefined): TranslateFetch {
  if (fetchImpl) return fetchImpl;
  if (!globalThis.fetch) {
    throw new Error("A fetch implementation is required to call /api/translate-create-limited-anon.");
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

async function callSharedLimitedAnonEndpoint(
  input: SharedLimitedAnonInput,
  body: Record<string, unknown>,
): Promise<unknown> {
  const requestFetch = getFetch(input.fetchImpl);
  const apiBaseUrl = (
    input.useStagingBackend === undefined
      ? getBEApiBaseUrl()
      : getBEApiBaseUrl({ useStagingBackend: input.useStagingBackend })
  ).replace(/\/+$/, "");
  const res = await requestFetch(`${apiBaseUrl}/api/translate-create-limited-anon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `External /translate-create-limited-anon failed. HTTP ${res.status}. Data: ${JSON.stringify(
        await readErrorResponse(res),
      )}`,
    );
  }
  return res.json();
}

export async function callTranslateOralToSignedLimitedAnon({
  source_lang,
  source_text,
  target_lang,
  ...shared
}: CallTranslateOralToSignedLimitedAnonInput): Promise<OralToSignedTranslation> {
  const data = await callSharedLimitedAnonEndpoint(
    { source_lang, target_lang, ...shared },
    { source_lang, target_lang, source_text },
  );
  return parseOralToSignedTranslation(data);
}

export async function callTranslateSignedToOralLimitedAnon({
  source_lang,
  source_signword_ids,
  target_lang,
  ...shared
}: CallTranslateSignedToOralLimitedAnonInput): Promise<SignedToOralTranslation> {
  const data = await callSharedLimitedAnonEndpoint(
    { source_lang, target_lang, ...shared },
    { source_lang, target_lang, source_signword_ids },
  );
  return parseSignedToOralTranslation(data);
}
