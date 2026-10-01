import { expect, it, vi } from "vitest";
import { createWordStreaksRemote } from "./user-word-streaks-remote.js";
const row = { user_id: "a", lang: "ja", word_streaks: { CAT: 3 }, updated_at: "2026-10-01T00:00:00.000Z" };
function client(result: { data: unknown[] | null; error: unknown }) {
  const filters: Array<[string, unknown]> = [];
  const query = { select: vi.fn(() => query), eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }), then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) };
  const table = { select: query.select, update: vi.fn(() => query), insert: vi.fn(() => query) };
  return { supabase: { from: vi.fn(() => table) }, table, filters };
}
it("updates only the captured account/language/revision and detects a lost race", async () => {
  const { supabase, table, filters } = client({ data: [], error: null });
  const remote = createWordStreaksRemote(supabase, "a");
  expect(await remote.compareAndSet("ja", row, { CAT: 4 })).toBeNull();
  expect(filters).toEqual([["user_id", "a"], ["lang", "ja"], ["updated_at", row.updated_at]]);
  expect(table.update.mock.calls[0][0]).toMatchObject({ user_id: "a", lang: "ja", word_streaks: { CAT: 4 } });
});
it("treats concurrent inserts as conflicts and rejects actual failures", async () => {
  const conflict = client({ data: null, error: { code: "23505" } });
  expect(await createWordStreaksRemote(conflict.supabase, "a").compareAndSet("ja", null, {})).toBeNull();
  const failure = client({ data: null, error: new Error("permission denied") });
  const remote = createWordStreaksRemote(failure.supabase, "a");
  await expect(remote.read("ja")).rejects.toThrow("permission denied");
  await expect(remote.compareAndSet("ja", row, {})).rejects.toThrow("permission denied");
});
