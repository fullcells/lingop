import { describe, expect, it, vi } from "vitest";
import {
  BE_API_PRODUCTION_URL,
  BE_API_STAGING_URL,
} from "../../core/backend-api.js";
import { resetOATCoreWordsCache, translateOATTexts } from "./api.js";

describe("OAT build backend selection", () => {
  it("uses the shared production backend by default", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));

    await resetOATCoreWordsCache("es", {
      privateOverrideKey: "secret",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_PRODUCTION_URL}/api/reset-core-sbwords`,
      expect.any(Object),
    );
  });

  it("uses the shared staging backend when requested", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json([{ source_text: "Hello", target_text: "Hola" }]),
    );

    await translateOATTexts({
      sourceTexts: ["Hello"],
      targetLang: "es",
      refs: [],
      services: {
        privateOverrideKey: "secret",
        fetchImpl,
        useStagingBackend: true,
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `${BE_API_STAGING_URL}/api/translate`,
      expect.any(Object),
    );
  });
});
