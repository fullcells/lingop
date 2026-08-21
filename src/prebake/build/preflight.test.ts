import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnnotatedText } from "../../core/annotation/types.js";
import { BE_API_STAGING_URL } from "../../core/backend-api.js";
import type {
  SBCacheWordListL10nWordsRow,
  SBWordListRow,
} from "../../core/word-lists.js";
import type { PrebakeConfig } from "./config.js";
import { runPrebakePreflight } from "./preflight.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("prebake preflight", () => {
  it("reads public word-list data and generates only missing values when fresh", async () => {
    const generatedAssetsRoot = makeTempDir();
    const publicData = makePublicData();
    const requestFetch = makeFetch(publicData);
    const config = makeConfig(generatedAssetsRoot, ["es"]);
    const now = new Date("2026-08-21T00:00:00.000Z");

    await runPrebakePreflight(config, {
      privateOverrideKey: "secret",
      supabaseUrl: "https://public-data.example",
      supabasePublicKey: "public-key",
      fetchImpl: requestFetch,
      now: () => now,
      useStagingBackend: true,
    });

    expect(readJson(generatedAssetsRoot, "translations/t.en-to-es.json")).toEqual({
      Animals: "ES:Animals",
    });
    expect(readJson(generatedAssetsRoot, "annotations/a.es.json")).toEqual({
      animales: expect.objectContaining({ lang: "es", lang_text: "animales" }),
    });
    expect(readJson(generatedAssetsRoot, "metadata.json")).toEqual({
      translations_last_full_refresh: now.toISOString(),
      annotations_last_full_refresh: now.toISOString(),
    });

    publicData.wordLists[0]!.sublists = ["Animals", "Colors"];
    publicData.wordLists.push(makeWordList("Colors"));
    publicData.localized.es!.push(makeLocalizedRow("es", "colores"));
    await runPrebakePreflight(config, {
      privateOverrideKey: "secret",
      supabaseUrl: "https://public-data.example",
      supabasePublicKey: "public-key",
      fetchImpl: requestFetch,
      now: () => new Date("2026-08-21T01:00:00.000Z"),
      useStagingBackend: true,
    });

    expect(readJson(generatedAssetsRoot, "translations/t.en-to-es.json")).toEqual({
      Animals: "ES:Animals",
      Colors: "ES:Colors",
    });
    expect(readJson(generatedAssetsRoot, "annotations/a.es.json")).toEqual({
      animales: expect.any(Object),
      colores: expect.any(Object),
    });
    expect(
      requestFetch.mock.calls
        .filter(([input]) => String(input).includes("/api/"))
        .every(([input]) => String(input).startsWith(BE_API_STAGING_URL)),
    ).toBe(true);

    // At day four translations are stale but the seven-day annotation timer is
    // still fresh. A translation full refresh must nevertheless refresh the
    // corresponding annotations, preserving OmniAccess's intended coupling.
    const coupledRefresh = new Date("2026-08-25T00:00:00.000Z");
    await runPrebakePreflight(config, {
      privateOverrideKey: "secret",
      supabaseUrl: "https://public-data.example",
      supabasePublicKey: "public-key",
      fetchImpl: requestFetch,
      now: () => coupledRefresh,
      useStagingBackend: true,
    });
    const annotationBodies = callsEndingWith(requestFetch, "/api/annotate").map(
      ([, init]) => JSON.parse(String(init?.body)) as { texts: string[] },
    );
    expect(annotationBodies.at(-1)?.texts).toEqual(["animales", "colores"]);
    expect(readJson(generatedAssetsRoot, "metadata.json")).toEqual({
      translations_last_full_refresh: coupledRefresh.toISOString(),
      annotations_last_full_refresh: coupledRefresh.toISOString(),
    });
  });

  it("batches annotations by ten and resets every language cache", async () => {
    const generatedAssetsRoot = makeTempDir();
    const publicData = makePublicData();
    publicData.localized.es = Array.from({ length: 11 }, (_, index) =>
      makeLocalizedRow("es", `es-${index}`),
    );
    publicData.localized.fr = [makeLocalizedRow("fr", "fr-0")];
    const requestFetch = makeFetch(publicData);

    await runPrebakePreflight(makeConfig(generatedAssetsRoot, ["es", "fr"]), {
      privateOverrideKey: "secret",
      supabaseUrl: "https://public-data.example",
      supabasePublicKey: "public-key",
      fetchImpl: requestFetch,
      now: () => new Date("2026-08-21T00:00:00.000Z"),
    });

    expect(callsEndingWith(requestFetch, "/api/reset-core-sbwords")).toHaveLength(2);
    expect(callsEndingWith(requestFetch, "/api/annotate")).toHaveLength(3);
  });
});

function makeConfig(generatedAssetsRoot: string, allLangs: string[]): PrebakeConfig {
  return {
    generatedAssetsRoot,
    translationRootListTitle: "_public",
    allLangs,
    guiLangs: allLangs,
  };
}

function makePublicData() {
  return {
    wordLists: [
      makeWordList("_public", ["Animals"]),
      makeWordList("Animals"),
    ],
    localized: {
      es: [makeLocalizedRow("es", "animales")],
      fr: [] as SBCacheWordListL10nWordsRow[],
    } as Record<string, SBCacheWordListL10nWordsRow[]>,
  };
}

function makeWordList(title: string, sublists: string[] = []): SBWordListRow {
  return {
    title,
    lang: "en",
    sublists,
    words: [],
    type: "LANG_SPECIFIC",
    updated_at: "2026-08-21T00:00:00.000Z",
  };
}

function makeLocalizedRow(
  lang: string,
  text: string,
): SBCacheWordListL10nWordsRow {
  return {
    lang,
    list_title: "Animals",
    l10n_words: [text],
    updated_at: "2026-08-21T00:00:00.000Z",
    is_human_verified: true,
  };
}

function makeFetch(publicData: ReturnType<typeof makePublicData>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/word_lists") {
      expect(init?.headers).toEqual(
        expect.objectContaining({ apikey: "public-key" }),
      );
      return Response.json(publicData.wordLists);
    }
    if (url.pathname === "/rest/v1/cache_word_list_l10n_words") {
      const lang = url.searchParams.get("lang")?.replace(/^eq\./, "") ?? "";
      return Response.json(publicData.localized[lang] ?? []);
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (url.pathname === "/api/translate") {
      const targetLang = body.target_lang as string;
      return Response.json(
        (body.source_texts as string[]).map((sourceText) => ({
          source_text: sourceText,
          target_text: `${targetLang.toUpperCase()}:${sourceText}`,
        })),
      );
    }
    if (url.pathname === "/api/reset-core-sbwords") {
      return Response.json({ ok: true });
    }
    if (url.pathname === "/api/annotate") {
      const lang = body.lang as string;
      return Response.json({
        annotatedTexts: (body.texts as string[]).map((text) =>
          makeAnnotation(lang, text),
        ),
      });
    }
    return new Response("Not found", { status: 404 });
  });
}

function makeAnnotation(lang: string, text: string): AnnotatedText {
  return {
    lang,
    lang_text: text,
    tokens: [],
    containsGloss: false,
    containsPhonetics: false,
    ref: { dev: "prebake" },
    owner_id: null,
  };
}

function callsEndingWith(fetchMock: ReturnType<typeof makeFetch>, suffix: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input).endsWith(suffix));
}

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lingop-prebake-"));
  tempDirs.push(dir);
  return dir;
}

function readJson(root: string, relativePath: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(root, "i18n/var", relativePath), "utf-8"),
  ) as unknown;
}
