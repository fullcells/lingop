import { describe, expect, it, vi } from "vitest";
import {
  BE_API_GCLOUD_RUN_URL, BE_API_PRODUCTION_URL, BE_API_STAGING_URL,
  getBEApiBaseUrl, parseBackendTarget, type BEApiBaseUrlOptions,
} from "./backend-api.js";
import { callTranslate_storeForOwner } from "./translation/api-client.js";
import utilsFetchLocalization, { invalidateFetchLocalizationCache } from "./translation/fetch-localization.js";
import utilsFetchAnnotation, { fetchAnnotationsBatch } from "./annotation/fetch-annotation.js";
import { getAPIVoices, getSpeechFileURL } from "../speech/shared.js";
import { resetOATCoreWordsCache } from "../oat/build/api.js";
import { resetPrebakeCoreWordsCache } from "../prebake/build/api.js";

const cloud = { backendTarget: "gcloud-run" as const };
const staging = { backendTarget: "staging" as const };
const production = { backendTarget: "production" as const };
const ref = { file: "lingodex" as const };
const sourceContent = { owner_id: "public-owner", lang: "en", text: "routing test", ref };
const localization = { l10n_lang: "en", text: "routing test", sourceContent };
const annotation = (host: string) => ({
  lang: "en", lang_text: "routing test", tokens: [{ text: host, isWord: 1 }],
  containsGloss: false, containsPhonetics: false, owner_id: null, ref,
});
const translation = (host: string) => ({
  id: 1, source_lang: "en", source_text: "routing test", target_lang: "es",
  target_text: host, owner_id: "public-owner", created_at: "2026-10-07T00:00:00Z",
  translator: "test", ref,
});

describe("backend target compatibility", () => {
  it.each<[BEApiBaseUrlOptions, string]>([
    [{}, BE_API_GCLOUD_RUN_URL],
    [{ useStagingBackend: false }, BE_API_GCLOUD_RUN_URL],
    [{ useStagingBackend: true }, BE_API_STAGING_URL],
    [production, BE_API_GCLOUD_RUN_URL],
    [{ ...production, useStagingBackend: true }, BE_API_GCLOUD_RUN_URL],
    [{ backendTarget: "staging", useStagingBackend: false }, BE_API_STAGING_URL],
    [{ ...cloud, useStagingBackend: true }, BE_API_GCLOUD_RUN_URL],
    [cloud, BE_API_GCLOUD_RUN_URL],
  ])("resolves %j to %s", (options, url) => {
    expect(getBEApiBaseUrl(options)).toBe(url);
  });

  it("uses the direct Cloud Run origin for default callers and the public production constant", () => {
    expect(getBEApiBaseUrl()).toBe("https://lingoprocessor-v20-mnykwbetrq-uc.a.run.app");
    expect(BE_API_PRODUCTION_URL).toBe(getBEApiBaseUrl());
  });

  it("rejects invalid configuration instead of silently routing to production", () => {
    expect(parseBackendTarget(undefined)).toBeUndefined();
    expect(() => parseBackendTarget("cloud-run")).toThrow(/Invalid Lingop backend target/);
    expect(() => getBEApiBaseUrl({ backendTarget: "typo" as never })).toThrow();
  });
});

it("keeps identical stored translation requests on their selected backends", async () => {
  const fetchImpl = vi.fn(async (url: string) => Response.json([translation(new URL(url).origin)]));
  const input = { source_lang: "en", target_lang: "es", source_text: "routing test", ref, accessToken: "test-token", fetchImpl };
  const results = await Promise.all([
    callTranslate_storeForOwner({ ...input, ...staging }),
    callTranslate_storeForOwner({ ...input, ...cloud }),
  ]);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(results.map(rows => rows[0]?.target_text)).toEqual([BE_API_STAGING_URL, BE_API_GCLOUD_RUN_URL]);
});

it("separates persistent localization results and invalidates all targets after a shared data edit", async () => {
  const fetchImpl = vi.fn(async (url: string) => Response.json(translation(new URL(url).origin)));
  const input = { l10n_lang: "es", sourceContent, isPublic: true, fetchImpl };
  const read = (options: BEApiBaseUrlOptions) => utilsFetchLocalization({ ...input, translationsCache: { current: [] }, ...options });
  const results = await Promise.all([read(staging), read(cloud)]);
  expect(results.map(result => result?.text)).toEqual([BE_API_STAGING_URL, BE_API_GCLOUD_RUN_URL]);
  await read(production);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  invalidateFetchLocalizationCache(input);
  await Promise.all([read(staging), read(cloud)]);
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});

it.each(["queued", "direct"] as const)("keeps %s public annotation batches separate by backend", async mode => {
  const fetchImpl = vi.fn(async (url: string) => Response.json([annotation(new URL(url).origin)]));
  const items = [staging, cloud].map(options => ({ localization, annotationsByLangNTextCache: { current: {} }, fetchImpl, ...options }));
  const results = mode === "queued"
    ? await Promise.all(items.map(item => utilsFetchAnnotation(item)))
    : await fetchAnnotationsBatch({ items });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(results.map(result => result?.tokens[0]?.text)).toEqual([BE_API_STAGING_URL, BE_API_GCLOUD_RUN_URL]);
});

it("keeps voice lists and generated audio caches separate by backend", async () => {
  const voice = { service: "MICROSOFT" as const, voice_id: "test-voice", voice_lang: "en-US" };
  const fetchImpl = vi.fn(async (url: string) => {
    const host = new URL(url).hostname;
    if (url.endsWith("get-api-voices")) return Response.json([{ ...voice, voice_id: host }]);
    return Response.json({ id: 1, lang: "en", text: "routing speech", filename: `${host}.mp3`,
      owner_id: "test-owner", character_label: null, service: "MICROSOFT", voice_id: voice.voice_id, ref: null, created_at: "2026-10-07T00:00:00Z" });
  });
  const voices = await Promise.all([getAPIVoices({ fetchImpl, ...staging }), getAPIVoices({ fetchImpl, ...cloud })]);
  expect(voices.map(rows => rows[0]?.voice_id)).toEqual([new URL(BE_API_STAGING_URL).hostname, new URL(BE_API_GCLOUD_RUN_URL).hostname]);
  const input = { text: "routing speech", lang: "en", contentContext: "LIMITED_TEMP_ANON" as const, voice, fetchImpl };
  const audio = await Promise.all([getSpeechFileURL({ ...input, ...staging }), getSpeechFileURL({ ...input, ...cloud })]);
  expect(audio[0]).toContain(new URL(BE_API_STAGING_URL).hostname);
  expect(audio[1]).toContain(new URL(BE_API_GCLOUD_RUN_URL).hostname);
  await getSpeechFileURL({ ...input, ...production });
  await getAPIVoices({ fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});

it("routes both build tools' default manual dictionary resets to Cloud Run", async () => {
  const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
  const services = { privateOverrideKey: "test-key", supabaseUrl: "https://example.test", supabasePublicKey: "test-public-key", fetchImpl };
  await resetOATCoreWordsCache("ja", services);
  await resetPrebakeCoreWordsCache("yue", services);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  for (const [url] of fetchImpl.mock.calls) expect(url).toBe(`${BE_API_GCLOUD_RUN_URL}/api/reset-core-sbwords`);
});
