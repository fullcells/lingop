import { describe, expect, it, vi } from "vitest";

import {
  getBinderDocsByMinL10nsOrder,
  fetchBinderDocsByMinL10nsOrder,
} from "./binder-docs-order.js";
import type { SupabaseQueryLike } from "./supabase.js";

function makeSupabaseClient(data: unknown[], eqCalls: Array<[string, unknown]>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        const query: SupabaseQueryLike = {
          eq: vi.fn((column: string, value: unknown) => {
            eqCalls.push([column, value]);
            return query;
          }),
          then: (onfulfilled, onrejected) =>
            Promise.resolve({ data, error: null }).then(onfulfilled, onrejected),
        };
        return query;
      }),
    })),
  };
}

describe("BinderDocsByMinL10nsOrder", () => {
  it("orders docs by fewest new l10ns, then highest new-l10n doc coverage", () => {
    const result = getBinderDocsByMinL10nsOrder([
      { doc_id: 1, l10ns: ["a", "b", "c"] },
      { doc_id: 2, l10ns: ["a"] },
      { doc_id: 3, l10ns: ["a", "b"] },
      { doc_id: 4, l10ns: ["d"] },
    ]);

    expect(result).toEqual([
      { doc_id: 2, l10ns: ["a"], newL10ns: ["a"] },
      { doc_id: 3, l10ns: ["a", "b"], newL10ns: ["b"] },
      { doc_id: 1, l10ns: ["a", "b", "c"], newL10ns: ["c"] },
      { doc_id: 4, l10ns: ["d"], newL10ns: ["d"] },
    ]);
  });

  it("can force priority docs earlier", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = getBinderDocsByMinL10nsOrder(
      [
        { doc_id: 1, l10ns: ["a"] },
        { doc_id: 139, l10ns: ["x", "y", "z"] },
        { doc_id: 2, l10ns: ["a", "b"] },
      ],
      [139],
    );

    expect(result[0]).toEqual({
      doc_id: 139,
      l10ns: ["x", "y", "z"],
      newL10ns: ["x", "y", "z"],
    });
    expect(consoleInfo).toHaveBeenCalledWith(
      "Using consumer-specified binder priority doc IDs:",
      [139],
    );
    consoleInfo.mockRestore();
  });

  it("uses and logs default priority doc 179 when present", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = getBinderDocsByMinL10nsOrder([
      { doc_id: 1, l10ns: ["a"] },
      { doc_id: 179, l10ns: ["x", "y"] },
    ]);

    expect(result[0]?.doc_id).toBe(179);
    expect(consoleInfo).toHaveBeenCalledWith("Using default binder priority doc ID:", 179);
    consoleInfo.mockRestore();
  });

  it("replaces a one-off singleton with exactly two recurring l10ns above 1,000", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const fillerL10ns = Array.from({ length: 999 }, (_, index) => `filler-${index}`);
    const result = getBinderDocsByMinL10nsOrder(
      [
        { doc_id: 1, l10ns: ["rare"] },
        { doc_id: 2, l10ns: ["common-a", "common-b"] },
        { doc_id: 3, l10ns: ["common-a", "common-b", ...fillerL10ns] },
      ],
      [],
    );

    expect(result[0]).toEqual({
      doc_id: 2,
      l10ns: ["common-a", "common-b"],
      newL10ns: ["common-a", "common-b"],
    });
    consoleInfo.mockRestore();
  });

  it("does not apply the recurring-pair exception at 1,000 unique l10ns", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const fillerL10ns = Array.from({ length: 997 }, (_, index) => `filler-${index}`);
    const result = getBinderDocsByMinL10nsOrder(
      [
        { doc_id: 1, l10ns: ["rare"] },
        { doc_id: 2, l10ns: ["common-a", "common-b"] },
        { doc_id: 3, l10ns: ["common-a", "common-b", ...fillerL10ns] },
      ],
      [],
    );

    expect(result[0]?.doc_id).toBe(1);
    consoleInfo.mockRestore();
  });

  it("fetches binder doc l10n caches and delegates to the ordering helper", async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const supabaseClient = makeSupabaseClient(
      [
        { doc_id: "10", l10ns: ["a", "b"] },
        { doc_id: "11", l10ns: ["a"] },
      ],
      eqCalls,
    );

    await expect(
      fetchBinderDocsByMinL10nsOrder({
        supabaseClient,
        binder_id: 7,
        lang: "ja",
      }),
    ).resolves.toEqual([
      { doc_id: "11", l10ns: ["a"], newL10ns: ["a"] },
      { doc_id: "10", l10ns: ["a", "b"], newL10ns: ["b"] },
    ]);
    expect(supabaseClient.from).toHaveBeenCalledWith("cache_binder_doc_l10ns");
    expect(eqCalls).toContainEqual(["lang", "ja"]);
    expect(eqCalls).toContainEqual(["user_binder_docs.binder_id", 7]);
  });
});
