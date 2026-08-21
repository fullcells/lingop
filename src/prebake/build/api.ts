import type { AnnotatedText } from "../../core/annotation/types.js";
import { getBEApiBaseUrl } from "../../core/backend-api.js";
import type { TranslationRow } from "../../core/translation/types.js";

export type PrebakeBuildServices = {
  privateOverrideKey: string;
  supabaseUrl: string;
  supabasePublicKey: string;
  fetchImpl?: typeof globalThis.fetch;
  now?: () => Date;
  useStagingBackend?: boolean;
};

function getFetch(services: PrebakeBuildServices): typeof globalThis.fetch {
  const fetchImpl = services.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Prebake preflight requires fetch.");
  return fetchImpl.bind(globalThis);
}

async function throwResponseError(
  response: Response,
  operation: string,
): Promise<never> {
  const rawText = await response.text();
  let data: unknown = rawText;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {}
  throw new Error(
    `${operation} failed. HTTP ${response.status}. Data: ${JSON.stringify(data)}`,
  );
}

export async function translatePrebakeTexts({
  sourceLang,
  sourceTexts,
  targetLang,
  refs,
  services,
}: {
  sourceLang: string;
  sourceTexts: string[];
  targetLang: string;
  refs: unknown[];
  services: PrebakeBuildServices;
}): Promise<Record<string, string>> {
  // 20260216: Future: consolidate this with the other raw translation callers
  // so bulk API behavior is managed in one place.
  const response = await getFetch(services)(
    `${getBEApiBaseUrl(services)}/api/translate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_lang: sourceLang,
        target_lang: targetLang,
        source_texts: sourceTexts,
        refs,
        options: [],
        private_override_key: services.privateOverrideKey,
      }),
    },
  );
  if (!response.ok) {
    await throwResponseError(response, `${sourceLang}->${targetLang} prebake translation`);
  }
  const rows = (await response.json()) as TranslationRow[];
  return Object.fromEntries(rows.map((row) => [row.source_text, row.target_text]));
}

export async function resetPrebakeCoreWordsCache(
  lang: string,
  services: PrebakeBuildServices,
): Promise<void> {
  const response = await getFetch(services)(
    `${getBEApiBaseUrl(services)}/api/reset-core-sbwords`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word_lang: lang,
        gloss_lang: "en",
        private_override_key: services.privateOverrideKey,
      }),
    },
  );
  if (!response.ok) {
    await throwResponseError(response, `${lang} prebake reset-core-sbwords`);
  }
}

export async function annotatePrebakeTexts({
  lang,
  texts,
  ref,
  services,
}: {
  lang: string;
  texts: string[];
  ref: unknown;
  services: PrebakeBuildServices;
}): Promise<AnnotatedText[]> {
  const response = await getFetch(services)(
    `${getBEApiBaseUrl(services)}/api/annotate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        texts,
        ref,
        private_override_key: services.privateOverrideKey,
      }),
    },
  );
  if (!response.ok) {
    await throwResponseError(response, `${lang} prebake annotation`);
  }
  const data = (await response.json()) as { annotatedTexts: AnnotatedText[] };
  return data.annotatedTexts;
}
