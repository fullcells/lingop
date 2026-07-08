import { describe, expect, it, vi } from "vitest";

import {
  BE_API_PRODUCTION_URL,
  BE_API_STAGING_URL,
} from "../backend-api.js";
import {
  callTranslateCreateLimitedAnon,
  callTranslate_storeForOwner,
  type TranslateFetch,
} from "./api-client.js";
import type { TranslationRow } from "./types.js";

function makeTranslationRow(id: number): TranslationRow {
  return {
    id,
    source_lang: "en",
    source_text: `source-${id}`,
    target_lang: "th",
    target_text: `target-${id}`,
    owner_id: "owner-1",
    created_at: `2026-01-0${id}T00:00:00.000Z`,
    translator: "test",
    ref: { db: { table: "posts", column: "body", id } },
  };
}

describe("callTranslate_storeForOwner", () => {
  it("calls the translate backend with source_texts, refs, and options", async () => {
    const translation = makeTranslationRow(1);
    const fetchImpl = vi.fn<TranslateFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => [translation],
    }));

    await expect(
      callTranslate_storeForOwner({
        source_lang: "en",
        target_lang: "th",
        source_text: "source-1",
        ref: translation.ref,
        options: ["formal"],
        accessToken: "token-1",
        fetchImpl,
      }),
    ).resolves.toEqual([translation]);

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/translate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
        },
        body: JSON.stringify({
          source_lang: "en",
          target_lang: "th",
          source_texts: ["source-1"],
          refs: [translation.ref],
          options: ["formal"],
        }),
      },
    );
  });

  it("uses the staging backend URL when requested", async () => {
    const translation = makeTranslationRow(2);
    const fetchImpl = vi.fn<TranslateFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => [translation],
    }));

    await expect(
      callTranslate_storeForOwner({
        source_lang: "en",
        target_lang: "th",
        source_text: "source-2",
        ref: translation.ref,
        accessToken: "token-1",
        useStagingBackend: true,
        fetchImpl,
      }),
    ).resolves.toEqual([translation]);

    const [url] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`${BE_API_STAGING_URL}/api/translate`);
  });

  it("dedupes matching in-flight requests", async () => {
    const translation = makeTranslationRow(3);
    let resolveFetch: ((value: {
      ok: true;
      status: 200;
      text: () => Promise<string>;
      json: () => Promise<TranslationRow[]>;
    }) => void) | undefined;
    const fetchImpl = vi.fn<TranslateFetch>(
      () =>
        new Promise<{
          ok: true;
          status: 200;
          text: () => Promise<string>;
          json: () => Promise<TranslationRow[]>;
        }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const firstRequest = callTranslate_storeForOwner({
      source_lang: "en",
      target_lang: "th",
      source_text: "source-3",
      ref: translation.ref,
      accessToken: "token-1",
      fetchImpl,
    });
    const secondRequest = callTranslate_storeForOwner({
      source_lang: "en",
      target_lang: "th",
      source_text: "source-3",
      ref: translation.ref,
      accessToken: "token-1",
      fetchImpl,
    });

    expect(firstRequest).toBe(secondRequest);

    resolveFetch?.({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => [translation],
    });

    await expect(firstRequest).resolves.toEqual([translation]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("callTranslateCreateLimitedAnon", () => {
  it("calls the documented limited anonymous translation endpoint", async () => {
    const fetchImpl = vi.fn<TranslateFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        target_text: "sawatdee",
        translator: "MODEL_B",
      }),
    }));

    await expect(
      callTranslateCreateLimitedAnon({
        source_lang: "en",
        target_lang: "th",
        source_text: "hello",
        accessToken: "token-1",
        fetchImpl,
      }),
    ).resolves.toEqual({
      targetText: "sawatdee",
      translator: "MODEL_B",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/translate-create-limited-anon`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
        },
        body: JSON.stringify({
          source_lang: "en",
          target_lang: "th",
          source_text: "hello",
        }),
      },
    );
  });
});
