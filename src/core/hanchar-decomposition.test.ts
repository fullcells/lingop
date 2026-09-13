import { describe, expect, it, vi } from "vitest";

import { getHancharDecomposition } from "./hanchar-decomposition.js";
import type { SupabaseQueryLike, SupabaseQueryResult } from "./supabase.js";

function queryFor(data: unknown[]): SupabaseQueryLike {
  let rows = data;
  const query: SupabaseQueryLike = {
    eq: vi.fn((column: string, value: unknown) => {
      rows = rows.filter((row) =>
        !!row && typeof row === "object" &&
        (row as Record<string, unknown>)[column] === value
      );
      return query;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      rows = rows.filter((row) =>
        !!row && typeof row === "object" &&
        values.includes((row as Record<string, unknown>)[column])
      );
      return query;
    }),
    order: vi.fn(() => query),
    then: (resolve, reject) =>
      Promise.resolve({ data: rows, error: null } satisfies SupabaseQueryResult)
        .then(resolve, reject),
  };
  return query;
}

describe("getHancharDecomposition", () => {
  it("returns an ordered component tree and readings", async () => {
    const tables: Record<string, unknown[]> = {
      hanchars: [
        { id: 1, literal: "語" },
        { id: 2, literal: "言" },
        { id: 3, literal: "吾" },
        { id: 4, literal: "口" },
      ],
      hanchar_components: [
        {
          id: 10,
          hanchar_id: 1,
          component_hanchar_id: 3,
          parent_hanchar_component_id: null,
          ordinal: 2,
          role: "phonetic",
          source: "test",
        },
        {
          id: 11,
          hanchar_id: 1,
          component_hanchar_id: 2,
          parent_hanchar_component_id: null,
          ordinal: 1,
          role: "semantic",
          source: "test",
        },
        {
          id: 12,
          hanchar_id: 1,
          component_hanchar_id: 4,
          parent_hanchar_component_id: 10,
          ordinal: 1,
          role: "structural",
          source: "test",
        },
      ],
      hanchar_readings: [
        {
          hanchar_id: 1,
          lang: "yue",
          reading: "jyu5",
          reading_type: "jyutping",
          source: "test",
        },
      ],
    };
    const supabaseClient = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => queryFor(tables[table] ?? [])),
      })),
    };

    await expect(
      getHancharDecomposition("語", { supabaseClient }),
    ).resolves.toEqual({
      literal: "語",
      components: [
        {
          literal: "言",
          ordinal: 1,
          role: "semantic",
          source: "test",
          components: [],
        },
        {
          literal: "吾",
          ordinal: 2,
          role: "phonetic",
          source: "test",
          components: [
            {
              literal: "口",
              ordinal: 1,
              role: "structural",
              source: "test",
              components: [],
            },
          ],
        },
      ],
      readings: [
        {
          lang: "yue",
          reading: "jyu5",
          readingType: "jyutping",
          source: "test",
        },
      ],
    });
  });

  it("returns null when a character has not been prefetched", async () => {
    const supabaseClient = {
      from: vi.fn(() => ({ select: vi.fn(() => queryFor([])) })),
    };
    await expect(
      getHancharDecomposition("𠄘", { supabaseClient }),
    ).resolves.toBeNull();
  });
});
