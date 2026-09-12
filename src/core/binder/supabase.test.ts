import { describe, expect, it, vi } from "vitest";

import { binderDocColumns, getBinderDoc } from "./supabase.js";

describe("getBinderDoc", () => {
  it("fetches exactly one binder document by id", async () => {
    const doc = {
      id: 12,
      binder_id: 7,
      name: "Puzzle",
      text: "## Puzzle",
      updated_at: "2026-09-12T00:00:00.000Z",
    };
    const single = vi.fn(async () => ({ data: doc, error: null }));
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await expect(getBinderDoc({ supabaseClient: { from }, id: 12 })).resolves.toEqual(doc);
    expect(from).toHaveBeenCalledWith("user_binder_docs");
    expect(select).toHaveBeenCalledWith(binderDocColumns);
    expect(eq).toHaveBeenCalledWith("id", 12);
    expect(single).toHaveBeenCalledOnce();
  });

  it("propagates Supabase query errors", async () => {
    const error = new Error("not allowed");
    const supabaseClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error }),
          }),
        }),
      }),
    };

    await expect(getBinderDoc({ supabaseClient, id: 12 })).rejects.toBe(error);
  });
});
