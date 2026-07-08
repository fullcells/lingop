import { describe, expect, it, vi } from "vitest";

import {
  fetchAnnotationsBatch,
  type FetchAnnotationFetch,
  type SupabaseAnnotationClient,
  type SupabaseAnnotationQuery,
  type SupabaseAnnotationQueryResult,
} from "./fetch-annotation.js";
import type { AnnotatedText, AnnotationEntry } from "./types.js";
import type { Localization } from "../misc.js";

function makeLocalization(overrides: Partial<Localization> = {}): Localization {
  return {
    text: "hello",
    l10n_lang: "en",
    sourceContent: {
      owner_id: null,
      lang: "en",
      text: "hello",
      ref: { db: { table: "custom_sources", column: "text", id: 1 } },
    },
    ...overrides,
  };
}

function makeAnnotatedText(text: string, ref: unknown): AnnotatedText {
  return {
    lang: "en",
    lang_text: text,
    tokens: [{ text, isWord: 1 }],
    containsGloss: false,
    containsPhonetics: false,
    ref,
    owner_id: null,
  };
}

function makeAnnotationEntry(text: string, ref: unknown): AnnotationEntry {
  return {
    lang: "en",
    lang_text: text,
    lang_tokens: {
      texts: [text],
      isWordList: [1],
    },
    ref,
    owner_id: null,
  };
}

function makeSupabaseClient(
  data: AnnotationEntry[],
  eqCalls: Array<[string, unknown]> = [],
): SupabaseAnnotationClient {
  const result: SupabaseAnnotationQueryResult = { data, error: null };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        const query: SupabaseAnnotationQuery = {
          eq: vi.fn((column: string, value: unknown) => {
            eqCalls.push([column, value]);
            return query;
          }),
          then: (onfulfilled, onrejected) =>
            Promise.resolve(result).then(onfulfilled, onrejected),
        };
        return query;
      }),
    })),
  };
}

describe("fetchAnnotationsBatch", () => {
  it("returns a matching annotation from caller cache", async () => {
    const ref = { db: { table: "custom_sources", column: "text", id: 1 } };
    const cachedText = makeAnnotatedText("hello", ref);

    const results = await fetchAnnotationsBatch({
      items: [
        {
          localization: makeLocalization(),
          annotationsByLangNTextCache: {
            current: {
              en: {
                hello: [cachedText],
              },
            },
          },
        },
      ],
    });

    expect(results).toEqual([cachedText]);
  });

  it("uses the public annotation endpoint for public source content", async () => {
    const ref = { file: "lingodex" as const };
    const publicText = makeAnnotatedText("hello", ref);
    const fetchImpl = vi.fn<FetchAnnotationFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => [publicText],
    }));

    const results = await fetchAnnotationsBatch({
      items: [
        {
          localization: makeLocalization({
            sourceContent: {
              owner_id: null,
              lang: "en",
              text: "hello",
              ref,
            },
          }),
          annotationsByLangNTextCache: { current: {} },
          fetchImpl,
        },
      ],
    });

    expect(results).toEqual([publicText]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://camplingo.com/api/lingoprocessor/annotate-get-public",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          lang: "en",
          ref,
          file_texts: ["hello"],
        }),
      }),
    );
  });

  it("uses a caller-provided Supabase client for annotation table lookup", async () => {
    const ref = { db: { table: "custom_sources", column: "text", id: 1 } };
    const entry = makeAnnotationEntry("hello", ref);

    const results = await fetchAnnotationsBatch({
      items: [
        {
          localization: makeLocalization(),
          annotationsByLangNTextCache: { current: {} },
          supabaseClient: makeSupabaseClient([entry]),
        },
      ],
    });

    expect(results).toEqual([makeAnnotatedText("hello", ref)]);
  });

  it("looks up translated segment annotations with preserved segment coordinates", async () => {
    const ref = {
      db: {
        table: "translations",
        column: "target_text",
        id: 123,
        line_idx: 4,
        seg_idx: 1,
      },
    };
    const entry = makeAnnotationEntry("สวัสดี", ref);
    const eqCalls: Array<[string, unknown]> = [];

    const results = await fetchAnnotationsBatch({
      items: [
        {
          localization: makeLocalization({
            text: "สวัสดี",
            l10n_lang: "th",
            translationRow: { id: 123 },
            sourceContent: {
              owner_id: "owner-1",
              lang: "en",
              text: "hello",
              ref: {
                db: {
                  table: "custom_sources",
                  column: "text",
                  id: 1,
                  line_idx: 4,
                  seg_idx: 1,
                },
              },
            },
          }),
          annotationsByLangNTextCache: { current: {} },
          supabaseClient: makeSupabaseClient([entry], eqCalls),
        },
      ],
    });

    expect(results).toEqual([makeAnnotatedText("สวัสดี", ref)]);
    expect(eqCalls).toContainEqual(["ref", JSON.stringify(ref)]);
  });
});
