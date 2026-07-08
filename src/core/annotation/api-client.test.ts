import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BE_API_PRODUCTION_URL,
  BE_API_STAGING_URL,
} from "../backend-api.js";
import callAnnotate_storedForOwner from "./api-client.js";
import type { AnnotatedText } from "./types.js";

function makeAnnotatedText(text: string): AnnotatedText {
  return {
    lang: "th",
    lang_text: text,
    tokens: [{ text, isWord: 1 }],
    containsGloss: false,
    containsPhonetics: false,
    ref: { source: "test" },
    owner_id: "owner-1",
  };
}

describe("callAnnotate_storedForOwner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches requests with matching language and ref", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { texts: string[] };

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: body.texts.map(makeAnnotatedText),
        }),
      };
    });

    const firstRequest = callAnnotate_storedForOwner({
      lang: "th",
      ref: { source: "test" },
      text: "hello",
      accessToken: "token-1",
      fetchImpl,
    });
    const secondRequest = callAnnotate_storedForOwner({
      lang: "th",
      ref: { source: "test" },
      text: "world",
      accessToken: "token-1",
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      makeAnnotatedText("hello"),
      makeAnnotatedText("world"),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BE_API_PRODUCTION_URL}/api/annotate`);
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body ?? "{}")).toMatchObject({
      lang: "th",
      texts: ["hello", "world"],
      ref: { source: "test" },
    });
  });

  it("uses the staging backend URL when requested", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { texts: string[] };

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: body.texts.map(makeAnnotatedText),
        }),
      };
    });

    const request = callAnnotate_storedForOwner({
      lang: "th",
      ref: { source: "test" },
      text: "staging",
      accessToken: "token-1",
      useStagingBackend: true,
      fetchImpl,
    });

    await vi.advanceTimersByTimeAsync(50);
    await expect(request).resolves.toEqual(makeAnnotatedText("staging"));

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BE_API_STAGING_URL}/api/annotate`);
  });

  it("uses the production backend URL by default", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { texts: string[] };

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: body.texts.map(makeAnnotatedText),
        }),
      };
    });

    const request = callAnnotate_storedForOwner({
      lang: "th",
      ref: { source: "test" },
      text: "default",
      accessToken: "token-1",
      fetchImpl,
    });

    await vi.advanceTimersByTimeAsync(50);
    await expect(request).resolves.toEqual(makeAnnotatedText("default"));

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BE_API_PRODUCTION_URL}/api/annotate`);
  });

  it("dedupes matching in-flight text requests", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { texts: string[] };

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: body.texts.map(makeAnnotatedText),
        }),
      };
    });

    const firstRequest = callAnnotate_storedForOwner({
      lang: "th",
      ref: { source: "test" },
      text: "same",
      accessToken: "token-1",
      fetchImpl,
    });
    const secondRequest = callAnnotate_storedForOwner({
      lang: "th",
      ref: { source: "test" },
      text: "same",
      accessToken: "token-1",
      fetchImpl,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      makeAnnotatedText("same"),
      makeAnnotatedText("same"),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body ?? "{}").texts).toEqual(["same"]);
  });

  it("splits large batches into backend-sized chunks", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_input: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { texts: string[] };

      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          langHasPhonetics: false,
          annotatedTexts: body.texts.map(makeAnnotatedText),
        }),
      };
    });

    const requests = Array.from({ length: 12 }, (_, index) =>
      callAnnotate_storedForOwner({
        lang: "th",
        ref: { source: "test" },
        text: `text-${index}`,
        accessToken: "token-1",
        fetchImpl,
      }),
    );

    await vi.advanceTimersByTimeAsync(50);
    await expect(Promise.all(requests)).resolves.toHaveLength(12);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body ?? "{}").texts).toHaveLength(10);
    expect(JSON.parse(fetchImpl.mock.calls[1]?.[1].body ?? "{}").texts).toHaveLength(2);
  });
});
