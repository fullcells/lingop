import { afterEach, expect, it, vi } from "vitest";
import { createWordStreaksStore, type WordStreaksStorage } from "./user-word-streaks-store.js";
import type { WordStreaksRemote } from "./user-word-streaks-remote.js";
import type { SBUserWordStreaks } from "./user-word-streaks.js";
function memory() {
  const values = new Map<string, string>();
  const storage: WordStreaksStorage = {
    getItem: vi.fn(async key => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => { values.set(key, value); }),
    removeItem: vi.fn(async key => { values.delete(key); }),
  };
  return { storage, values };
}
function server() {
  const rows = new Map<string, SBUserWordStreaks>();
  let sequence = 0;
  const remote: WordStreaksRemote = {
    read: vi.fn(async lang => rows.get(lang) ?? null),
    compareAndSet: vi.fn(async (lang, previous, words) => {
      if (rows.get(lang)?.updated_at !== previous?.updated_at) return null;
      const row = { user_id: "a", lang, word_streaks: { ...words }, updated_at: String(++sequence) };
      rows.set(lang, row);
      return row;
    }),
  };
  return { remote, rows };
}
const stores: ReturnType<typeof createWordStreaksStore>[] = [];
function store(options: Parameters<typeof createWordStreaksStore>[0]) {
  const value = createWordStreaksStore({ ...options, syncDelayMs: 60_000 });
  stores.push(value); value.start(); return value;
}
afterEach(() => { stores.forEach(value => value.stop()); stores.length = 0; vi.restoreAllMocks(); });

it("restores anonymous legacy words and saves every changed language before resolving", async () => {
  const { storage, values } = memory();
  values.set("USER_VOCAB_STREAKS_ja", JSON.stringify({ CAT: 2 }));
  const first = store({ storage });
  await first.setUserWordStreaksByDelta("ja", [{ word: "cat", streakDelta: 1 }]);
  await first.setUserWordStreaksToValue("yue", ["貓"], 5);
  first.stop();
  const second = store({ storage });
  await second.ensureUserWordStreaksForLang("ja");
  expect(second.getSnapshot().userWordStreaks).toEqual({ ja: { CAT: 3 }, yue: { 貓: 5 } });
});

it("retains signed-in pending writes across offline failure and restart", async () => {
  const { storage } = memory();
  const { remote, rows } = server();
  vi.mocked(remote.read).mockRejectedValueOnce(new Error("offline"));
  const first = store({ storage, remote, userID: "a" });
  await first.setUserWordStreaksToValue("ja", ["cat"], 4);
  await expect(first.syncUserWordStreaks("ja")).rejects.toThrow("offline");
  expect(remote.compareAndSet).not.toHaveBeenCalled();
  first.stop();
  const second = store({ storage, remote, userID: "a" });
  await second.syncAll();
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 4 });
  expect(second.getSnapshot().error).toBeNull();
});

it("merges changed words and retries a concurrent server update", async () => {
  const { storage } = memory();
  const { remote, rows } = server();
  rows.set("ja", { user_id: "a", lang: "ja", word_streaks: { DOG: 3 }, updated_at: "initial" });
  const save = remote.compareAndSet;
  vi.mocked(remote.compareAndSet).mockImplementationOnce(async (lang, previous, words) => {
    rows.set(lang, { ...rows.get(lang)!, word_streaks: { DOG: 3, BIRD: 7 }, updated_at: "other-device" });
    return null;
  });
  const value = store({ storage, remote, userID: "a" });
  await value.setUserWordStreaksToValue("ja", ["cat"], 4);
  await value.syncUserWordStreaks("ja");
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 4, DOG: 3, BIRD: 7 });
  expect(save).toHaveBeenCalledTimes(2);
});

it("does not acknowledge a newer edit made while an older sync is in flight", async () => {
  const { storage } = memory();
  const { remote, rows } = server();
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const original = remote.compareAndSet;
  const implementation = vi.mocked(original).getMockImplementation()!;
  vi.mocked(original).mockImplementationOnce(async (...args) => { started(); await blocked; return implementation(...args); });
  const value = store({ storage, remote, userID: "a" });
  await value.setUserWordStreaksToValue("ja", ["cat"], 1);
  const syncing = value.syncUserWordStreaks("ja");
  await ready;
  await value.setUserWordStreaksToValue("ja", ["cat"], 2);
  release(); await syncing;
  expect(value.getSnapshot().userWordStreaks.ja).toEqual({ CAT: 2 });
  await value.syncUserWordStreaks("ja");
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 2 });
});

it("keeps account caches isolated and rejects changes through an old account", async () => {
  const { storage } = memory();
  const first = store({ storage, userID: "a" });
  await first.setUserWordStreaksToValue("ja", ["private"], 1);
  first.stop();
  const second = store({ storage, userID: "b" });
  await second.ensureUserWordStreaksForLang("ja");
  expect(second.getSnapshot().userWordStreaks.ja).toEqual({});
  await expect(first.setUserWordStreaksToValue("ja", ["old"], 1)).rejects.toThrow("not active");
});

it("rejects failed storage writes without reporting progress as saved", async () => {
  const { storage } = memory();
  const value = store({ storage });
  await value.ensureUserWordStreaksForLang("ja");
  vi.mocked(storage.setItem).mockRejectedValueOnce(new Error("disk full"));
  await expect(value.setUserWordStreaksToValue("ja", ["cat"], 1)).rejects.toThrow("disk full");
  expect(value.getSnapshot().userWordStreaks.ja).toEqual({});
  expect(value.getSnapshot().error?.message).toBe("disk full");
  await value.setUserWordStreaksToValue("ja", ["cat"], 1);
  expect(value.getSnapshot().error).toBeNull();
});

it("persists deletes and reset-all without resurrecting remote words", async () => {
  const { storage } = memory();
  const { remote, rows } = server();
  rows.set("ja", { user_id: "a", lang: "ja", word_streaks: { CAT: 2, DOG: 4 }, updated_at: "initial" });
  const value = store({ storage, remote, userID: "a" });
  await value.deleteUserWordStreaks("ja", ["cat"]);
  await value.syncUserWordStreaks("ja");
  expect(rows.get("ja")?.word_streaks).toEqual({ DOG: 4 });
  await value.deleteAllUserWordStreaksForLang("ja");
  await value.syncUserWordStreaks("ja");
  expect(rows.get("ja")?.word_streaks).toEqual({});
});

it("transfers guest progress into a durable account queue before clearing the guest copy", async () => {
  const { storage, values } = memory();
  values.set("USER_VOCAB_STREAKS_ja", JSON.stringify({ CAT: 3 }));
  const { remote, rows } = server();
  vi.mocked(remote.compareAndSet).mockRejectedValueOnce(new Error("offline"));
  const value = store({ storage, remote, userID: "a" });
  await expect(value.syncUserWordStreaks("ja")).rejects.toThrow("offline");
  expect(value.getSnapshot().userWordStreaks.ja).toEqual({ CAT: 3 });
  expect(values.has("USER_VOCAB_STREAKS_ja")).toBe(false);
  value.stop();
  const restored = store({ storage, remote, userID: "a" });
  await restored.syncAll();
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 3 });
});

it("does not replace unreadable saved data with an empty record", async () => {
  const { storage, values } = memory();
  values.set("LINGOP_WORD_STREAKS_V1:default:anonymous", "broken");
  const value = store({ storage });
  await expect(value.setUserWordStreaksToValue("ja", ["cat"], 1)).rejects.toThrow();
  expect(values.get("LINGOP_WORD_STREAKS_V1:default:anonymous")).toBe("broken");
});

it("does not reduce an existing server streak when marking an uncached word seen", async () => {
  const { storage } = memory();
  const { remote, rows } = server();
  rows.set("ja", { user_id: "a", lang: "ja", word_streaks: { CAT: 9 }, updated_at: "initial" });
  const value = store({ storage, remote, userID: "a" });
  await value.setUserWordStreaksToMin1("ja", ["cat"]);
  await value.syncUserWordStreaks("ja");
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 9 });
});

it("retries an uncertain successful write without applying a local delta twice", async () => {
  const { storage } = memory();
  const { remote, rows } = server();
  const implementation = vi.mocked(remote.compareAndSet).getMockImplementation()!;
  vi.mocked(remote.compareAndSet).mockImplementationOnce(async (...args) => {
    await implementation(...args);
    throw new Error("response lost");
  });
  const value = store({ storage, remote, userID: "a" });
  await value.setUserWordStreaksByDelta("ja", [{ word: "cat", streakDelta: 2 }]);
  await expect(value.syncUserWordStreaks("ja")).rejects.toThrow("response lost");
  value.stop();
  const restored = store({ storage, remote, userID: "a" });
  await restored.syncAll();
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 2 });
});

it("automatically retries pending work after a failed sync", async () => {
  vi.useFakeTimers();
  try {
    const { storage } = memory();
    const { remote, rows } = server();
    vi.mocked(remote.read).mockRejectedValueOnce(new Error("offline"));
    const value = store({ storage, remote, userID: "a" });
    await value.setUserWordStreaksToValue("ja", ["cat"], 2);
    await expect(value.syncUserWordStreaks("ja")).rejects.toThrow("offline");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 2 });
    value.stop();
  } finally { vi.useRealTimers(); }
});

it("resumes guest cleanup after interruption without losing the account copy", async () => {
  const { storage, values } = memory();
  values.set("USER_VOCAB_STREAKS_ja", JSON.stringify({ CAT: 3 }));
  const { remote, rows } = server();
  vi.mocked(storage.removeItem).mockRejectedValueOnce(new Error("interrupted"));
  const first = store({ storage, remote, userID: "a" });
  await expect(first.syncUserWordStreaks("ja")).rejects.toThrow("interrupted");
  first.stop();
  const restored = store({ storage, remote, userID: "a" });
  await restored.syncAll();
  expect(values.has("USER_VOCAB_STREAKS_ja")).toBe(false);
  expect(rows.get("ja")?.word_streaks).toEqual({ CAT: 3 });
});
