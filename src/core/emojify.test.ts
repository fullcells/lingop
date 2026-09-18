import { describe, expect, it, vi } from "vitest";
import {
  cleanEmojiForNoto,
  convertEmojiTextToBlackWhiteCompatibleEmojiText,
  generateEmoji,
  generateEmojiFromRows,
  loadEmojiData,
  preloadEmojiData,
  shouldBlackWhiteEmojiUseColorEmojiFont,
  shouldFlipEmoji,
  type EmojiDataCacheEntry,
  type EmojiDataStorage,
  type EmojiRow,
  type SupabaseEmojiClient,
} from "./emojify.js";
import type { SupabaseQueryLike, SupabaseQueryResult } from "./supabase.js";

type SupabaseEmojiQuery = SupabaseQueryLike;
type SupabaseEmojiQueryResult = SupabaseQueryResult;

const rows: EmojiRow[] = [
  { emoji: "👍", en_gloss: "GOOD" },
  { emoji: "🏃", en_gloss: "RUN" },
  { emoji: "…", en_gloss: "-ING" },
  { emoji: "🐕", en_gloss: "DOG" },
  { emoji: "👴", en_gloss: "OLD" },
  { emoji: "♂", en_gloss: "[MALE]" },
];

function makeQuery(
  resultForRange: (from: number | null, to: number | null) => SupabaseEmojiQueryResult,
): SupabaseEmojiQuery {
  let rangeFrom: number | null = null;
  let rangeTo: number | null = null;

  const query: SupabaseEmojiQuery = {
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return query;
    }),
    then: (resolve, reject) =>
      Promise.resolve(resultForRange(rangeFrom, rangeTo)).then(resolve, reject),
  };

  return query;
}

function makeSupabaseClient(
  data: EmojiRow[],
  newestCreatedAt = "2026-09-18T00:00:00.000Z",
): {
  supabaseClient: SupabaseEmojiClient;
  select: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn(
    (
      columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): SupabaseEmojiQuery => {
      if (columns === "created_at") {
        return makeQuery(() => ({
          data:
            data.length > 0
              ? [{ created_at: newestCreatedAt }]
              : [],
          error: null,
          count: options?.count === "exact" ? data.length : null,
        }));
      }

      return makeQuery((from, to) => ({
        data:
          from === null || to === null
            ? data
            : data.slice(from, Math.min(to + 1, data.length)),
        error: null,
      }));
    },
  );

  return {
    supabaseClient: {
      from: vi.fn(() => ({ select })),
    },
    select,
  };
}

function makeMemoryStorage(): EmojiDataStorage {
  const entries = new Map<string, EmojiDataCacheEntry>();
  return {
    get: vi.fn(async (cacheKey) => entries.get(cacheKey) ?? null),
    set: vi.fn(async (cacheKey, entry) => {
      entries.set(cacheKey, structuredClone(entry));
    }),
  };
}

describe("emojify", () => {
  it("generates exact and lemmatized emoji matches from rows", async () => {
    await expect(generateEmojiFromRows("good", rows)).resolves.toBe("👍");
    await expect(generateEmojiFromRows("dogs", rows)).resolves.toBe("🐕");
  });

  it("handles slash groups and explicitations", async () => {
    await expect(generateEmojiFromRows("old [male] / running", rows)).resolves.toBe(
      "👴 [♂] / 🏃…",
    );
  });

  it("indexes emoji rows instead of repeatedly scanning them", async () => {
    const indexedRows = [...rows];
    const find = vi.spyOn(indexedRows, "find");

    await expect(generateEmojiFromRows("good", indexedRows)).resolves.toBe("👍");
    await expect(generateEmojiFromRows("dogs", indexedRows)).resolves.toBe("🐕");

    expect(find).not.toHaveBeenCalled();
  });

  it("shares concurrent work and caches generated emoji results", async () => {
    const resultRows: EmojiRow[] = [{ emoji: "🐕", en_gloss: "DOG" }];
    let releaseCoreWordLookup: (() => void) | undefined;
    const coreWordLookupGate = new Promise<void>((resolve) => {
      releaseCoreWordLookup = resolve;
    });
    const isNotCoreWord = vi.fn(async () => {
      await coreWordLookupGate;
      return false;
    });

    const first = generateEmojiFromRows("dog friend", resultRows, {
      isNotCoreWord,
    });
    const second = generateEmojiFromRows("dog friend", resultRows, {
      isNotCoreWord,
    });
    releaseCoreWordLookup?.();

    await expect(Promise.all([first, second])).resolves.toEqual(["🐕", "🐕"]);
    const callsAfterFirstGeneration = isNotCoreWord.mock.calls.length;

    await expect(
      generateEmojiFromRows("dog friend", resultRows, { isNotCoreWord }),
    ).resolves.toBe("🐕");
    expect(isNotCoreWord).toHaveBeenCalledTimes(callsAfterFirstGeneration);
  });

  it("loads Supabase emoji data once", async () => {
    const { supabaseClient, select } = makeSupabaseClient(rows);

    await expect(loadEmojiData({ supabaseClient, forceRefresh: true })).resolves.toHaveLength(rows.length);
    await expect(generateEmoji("good", undefined, undefined, { supabaseClient })).resolves.toBe(
      "👍",
    );

    expect(select).toHaveBeenCalledTimes(2);
  });

  it("reuses a persistent emoji cache with a new client", async () => {
    const storage = makeMemoryStorage();
    const first = makeSupabaseClient(rows);
    const second = makeSupabaseClient(rows);

    await expect(
      preloadEmojiData({
        supabaseClient: first.supabaseClient,
        cacheKey: "test-project",
        forceRefresh: true,
        storage,
      }),
    ).resolves.toHaveLength(rows.length);
    await expect(
      preloadEmojiData({
        supabaseClient: second.supabaseClient,
        cacheKey: "test-project",
        storage,
      }),
    ).resolves.toHaveLength(rows.length);

    expect(first.select).toHaveBeenCalledTimes(2);
    expect(second.select).not.toHaveBeenCalled();
  });

  it("refreshes cached rows when the newest created_at changes", async () => {
    const storage = makeMemoryStorage();
    const cacheKey = "created-at-refresh-test";
    await storage.set(cacheKey, {
      schemaVersion: 2,
      rows: [{ emoji: "🧥", en_gloss: "COAT" }],
      revision: {
        count: 1,
        newestCreatedAt: "2026-09-17T00:00:00.000Z",
      },
      checkedAt: 0,
      refreshedAt: 0,
    });
    const latestRows = [{ emoji: "🥼", en_gloss: "coat" }];
    const latest = makeSupabaseClient(
      latestRows,
      "2026-09-18T00:00:00.000Z",
    );

    await expect(
      preloadEmojiData({
        supabaseClient: latest.supabaseClient,
        cacheKey,
        storage,
      }),
    ).resolves.toEqual([{ emoji: "🧥", en_gloss: "COAT" }]);
    await vi.waitFor(async () => {
      await expect(storage.get(cacheKey)).resolves.toMatchObject({
        rows: [{ emoji: "🥼", en_gloss: "COAT" }],
        revision: {
          count: 1,
          newestCreatedAt: "2026-09-18T00:00:00.000Z",
        },
      });
    });

    expect(latest.select).toHaveBeenCalledTimes(2);
  });

  it("loads emoji batches concurrently", async () => {
    const manyRows = Array.from({ length: 2_001 }, (_, index) => ({
      emoji: "✅",
      en_gloss: `WORD ${index}`,
    }));
    let activeBatches = 0;
    let maxActiveBatches = 0;
    const select = vi.fn(
      (columns: string, options?: { count?: "exact" }): SupabaseEmojiQuery => {
        if (columns === "created_at") {
          return makeQuery(() => ({
            data: [{ created_at: "2026-09-18T00:00:00.000Z" }],
            error: null,
            count: options?.count === "exact" ? manyRows.length : null,
          }));
        }

        let rangeFrom = 0;
        let rangeTo = 0;
        const query: SupabaseEmojiQuery = {
          order: vi.fn(() => query),
          range: vi.fn((from: number, to: number) => {
            rangeFrom = from;
            rangeTo = to;
            return query;
          }),
          then: (resolve, reject) => {
            activeBatches += 1;
            maxActiveBatches = Math.max(maxActiveBatches, activeBatches);
            return new Promise<SupabaseEmojiQueryResult>((finish) => {
              setTimeout(() => {
                activeBatches -= 1;
                finish({
                  data: manyRows.slice(rangeFrom, rangeTo + 1),
                  error: null,
                });
              }, 5);
            }).then(resolve, reject);
          },
        };
        return query;
      },
    );
    const supabaseClient: SupabaseEmojiClient = {
      from: vi.fn(() => ({ select })),
    };

    await expect(
      loadEmojiData({
        supabaseClient,
        cacheKey: "parallel-test",
        forceRefresh: true,
        storage: null,
      }),
    ).resolves.toHaveLength(manyRows.length);
    expect(maxActiveBatches).toBeGreaterThan(1);
  });

  it("retries after an initial emoji data failure", async () => {
    let revisionAttempts = 0;
    const select = vi.fn(
      (columns: string, options?: { count?: "exact" }): SupabaseEmojiQuery => {
        if (columns === "created_at") {
          revisionAttempts += 1;
          return makeQuery(() =>
            revisionAttempts === 1
              ? { data: null, error: new Error("offline"), count: null }
              : {
                  data: [{ created_at: "2026-09-18T00:00:00.000Z" }],
                  error: null,
                  count: options?.count === "exact" ? rows.length : null,
                },
          );
        }
        return makeQuery((from, to) => ({
          data:
            from === null || to === null
              ? rows
              : rows.slice(from, Math.min(to + 1, rows.length)),
          error: null,
        }));
      },
    );
    const supabaseClient: SupabaseEmojiClient = {
      from: vi.fn(() => ({ select })),
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      loadEmojiData({
        supabaseClient,
        cacheKey: "retry-test",
        storage: null,
      }),
    ).resolves.toEqual([]);
    await expect(
      loadEmojiData({
        supabaseClient,
        cacheKey: "retry-test",
        storage: null,
      }),
    ).resolves.toHaveLength(rows.length);

    expect(revisionAttempts).toBe(2);
    consoleError.mockRestore();
  });

  it("converts emoji text for black-white compatibility", () => {
    expect(convertEmojiTextToBlackWhiteCompatibleEmojiText("🔴 1️⃣")).toBe(
      "[🎨🍓]\u2009①",
    );
    expect(shouldBlackWhiteEmojiUseColorEmojiFont("👩‍🍼")).toBe(true);
    expect(cleanEmojiForNoto("5️⃣")).toBe("5⃣");
    expect(shouldFlipEmoji("🚗")).toBe("YES");
  });
});
