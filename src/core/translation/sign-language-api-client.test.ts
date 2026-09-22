import { describe, expect, it, vi } from "vitest";

import { BE_API_PRODUCTION_URL } from "../backend-api.js";
import type { TranslateFetch } from "./api-client.js";
import {
  callTranslateOralToSignedLimitedAnon,
  callTranslateSignedToOralLimitedAnon,
} from "./sign-language-api-client.js";

describe("limited-anonymous Sign Language translation", () => {
  it("uses the shared endpoint for anonymous Oral-to-Signed translation", async () => {
    const fetchImpl = vi.fn<TranslateFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        direction: "oral-to-signed",
        source_lang: "en",
        target_lang: "jsl",
        source_text: "I drink tea",
        search_language: "en",
        signword_source_languages: ["jsl", "kvk"],
        tokens: [
          {
            type: "sign_word",
            sign_word_id: 101,
            sign_lang: "kvk",
            glosses: [{ gloss: "TEA", gloss_lang: "en", position: 0 }],
            search_query: "tea",
            from_related_sign_language: true,
          },
          {
            type: "fingerspell",
            text: "I",
            reason: "no_dictionary_match",
          },
        ],
        signword_ids: [101],
        translator: "AI:OPENAI:test+SIGNWORDS",
        warnings: ["Uses a related Sign Language."],
      }),
    }));

    await expect(
      callTranslateOralToSignedLimitedAnon({
        source_lang: "en",
        target_lang: "jsl",
        source_text: "I drink tea",
        fetchImpl,
      }),
    ).resolves.toEqual({
      direction: "oral-to-signed",
      sourceLang: "en",
      targetLang: "jsl",
      sourceText: "I drink tea",
      searchLanguage: "en",
      signWordSourceLanguages: ["jsl", "kvk"],
      tokens: [
        {
          type: "sign_word",
          signWordId: 101,
          signLang: "kvk",
          glosses: [{ gloss: "TEA", glossLang: "en", position: 0 }],
          searchQuery: "tea",
          fromRelatedSignLanguage: true,
        },
        { type: "fingerspell", text: "I", reason: "no_dictionary_match" },
      ],
      signWordIds: [101],
      translator: "AI:OPENAI:test+SIGNWORDS",
      warnings: ["Uses a related Sign Language."],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/translate-create-limited-anon`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_lang: "en",
          target_lang: "jsl",
          source_text: "I drink tea",
        }),
      },
    );
  });

  it("uses the same endpoint and forwards auth for Signed-to-Oral translation", async () => {
    const fetchImpl = vi.fn<TranslateFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        direction: "signed-to-oral",
        source_lang: "jsl",
        target_lang: "ja",
        source_signword_ids: [101],
        source_sign_words: [
          {
            id: 101,
            sign_lang: "kvk",
            glosses: [{ gloss: "茶", gloss_lang: "ja", position: 0 }],
            from_related_sign_language: true,
          },
        ],
        target_text: "お茶を飲みます。",
        translator: "AI:OPENAI:test+SIGNWORDS",
        warnings: [],
      }),
    }));

    await expect(
      callTranslateSignedToOralLimitedAnon({
        source_lang: "jsl",
        target_lang: "ja",
        source_signword_ids: [101],
        accessToken: "token-1",
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      direction: "signed-to-oral",
      sourceLang: "jsl",
      targetLang: "ja",
      sourceSignWordIds: [101],
      targetText: "お茶を飲みます。",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/translate-create-limited-anon`,
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
        },
        body: JSON.stringify({
          source_lang: "jsl",
          target_lang: "ja",
          source_signword_ids: [101],
        }),
      }),
    );
  });

  it("rejects malformed sign translation output", async () => {
    const fetchImpl = vi.fn<TranslateFetch>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ direction: "oral-to-signed", signword_ids: ["bad"] }),
    }));

    await expect(
      callTranslateOralToSignedLimitedAnon({
        source_lang: "en",
        target_lang: "ase",
        source_text: "hello",
        fetchImpl,
      }),
    ).rejects.toThrow("malformed Oral-to-Signed data");
  });
});
