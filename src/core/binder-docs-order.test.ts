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
