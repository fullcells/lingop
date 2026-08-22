import { describe, expect, it, vi } from "vitest";
import {
  cleanEmojiForNoto,
  convertEmojiTextToBlackWhiteCompatibleEmojiText,
  generateEmoji,
  generateEmojiFromRows,
  loadEmojiData,
  shouldBlackWhiteEmojiUseColorEmojiFont,
  shouldFlipEmoji,
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

function makeSupabaseClient(data: EmojiRow[]): {
  supabaseClient: SupabaseEmojiClient;
  select: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn(
    (
      _columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): SupabaseEmojiQuery => {
      if (options?.head) {
        return makeQuery(() => ({ data: null, error: null, count: data.length }));
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

  it("converts emoji text for black-white compatibility", () => {
    expect(convertEmojiTextToBlackWhiteCompatibleEmojiText("🔴 1️⃣")).toBe(
      "[🎨🍓]\u2009①",
    );
    expect(shouldBlackWhiteEmojiUseColorEmojiFont("👩‍🍼")).toBe(true);
    expect(cleanEmojiForNoto("5️⃣")).toBe("5⃣");
    expect(shouldFlipEmoji("🚗")).toBe("YES");
  });
});
