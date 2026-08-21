import type { AnnotatedText } from "../../core/annotation/types.js";
import { getBEApiBaseUrl } from "../../core/backend-api.js";
import type { TranslationRow } from "../../core/translation/types.js";
import { OAT_SOURCE_LANG } from "../constants.js";

export type OATBuildServices = {
  privateOverrideKey: string;
  fetchImpl?: typeof globalThis.fetch;
  useStagingBackend?: boolean;
};

function getFetch(services: OATBuildServices): typeof globalThis.fetch {
  const fetchImpl = services.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("OAT preflight requires a fetch implementation.");
  }
  return fetchImpl.bind(globalThis);
}

async function throwResponseError(response: Response, operation: string): Promise<never> {
  const rawText = await response.text();
  let data: unknown = rawText;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {}
  throw new Error(
    `${operation} failed. HTTP ${response.status}. Data: ${JSON.stringify(data)}`,
  );
}

export async function translateOATTexts({
  sourceTexts,
  targetLang,
  refs,
  services,
}: {
  sourceTexts: string[];
  targetLang: string;
  refs: unknown[];
  services: OATBuildServices;
}): Promise<Record<string, string>> {
  const fetchImpl = getFetch(services);
  const response = await fetchImpl(`${getBEApiBaseUrl(services)}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_lang: OAT_SOURCE_LANG,
      target_lang: targetLang,
      source_texts: sourceTexts,
      refs,
      options: [],
      private_override_key: services.privateOverrideKey,
    }),
  });
  if (!response.ok) {
    await throwResponseError(
      response,
      `${OAT_SOURCE_LANG}->${targetLang} OAT translation`,
    );
  }
  const rows = (await response.json()) as TranslationRow[];
  return Object.fromEntries(rows.map((row) => [row.source_text, row.target_text]));
}

export async function resetOATCoreWordsCache(
  targetLang: string,
  services: OATBuildServices,
): Promise<void> {
  const fetchImpl = getFetch(services);
  const response = await fetchImpl(
    `${getBEApiBaseUrl(services)}/api/reset-core-sbwords`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word_lang: targetLang,
        gloss_lang: "en",
        private_override_key: services.privateOverrideKey,
      }),
    },
  );
  if (!response.ok) {
    await throwResponseError(response, "OAT reset-core-sbwords");
  }
}

export async function annotateOATTexts(
  targetLang: string,
  texts: string[],
  services: OATBuildServices,
): Promise<AnnotatedText[]> {
  const fetchImpl = getFetch(services);
  const response = await fetchImpl(`${getBEApiBaseUrl(services)}/api/annotate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lang: targetLang,
      texts,
      ref: { dev: "prebake" },
      private_override_key: services.privateOverrideKey,
    }),
  });
  if (!response.ok) {
    await throwResponseError(response, `${targetLang} OAT annotation`);
  }
  const data = (await response.json()) as { annotatedTexts: AnnotatedText[] };
  return data.annotatedTexts;
}
