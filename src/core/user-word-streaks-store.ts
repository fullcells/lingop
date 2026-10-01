import { setWordStreaksByDelta, setWordStreaksToMin1, setWordStreaksToValue, deleteWordStreaks, type WordStreaksForLang, type UserWordStreaksByLang } from "./user-word-streaks.js";
import type { WordStreaksRemote } from "./user-word-streaks-remote.js";

/** Compatible with AsyncStorage; implementations must atomically replace each key. */
export type WordStreaksStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type WordStreaksLifecycle = {
  subscribe(listener: (state: "active" | "background") => void): () => void;
};
type Change = { value: number | null; revision: number; onlyIfMissing?: boolean };
type LanguageState = { words: WordStreaksForLang; pending: Record<string, Change>; clear: number; guestImported?: boolean; guestTransfer?: { language: string | null; legacy: string | null } };
type RecordData = { version: 1; revision: number; languages: Record<string, LanguageState> };
export type WordStreaksSnapshot = { userWordStreaks: UserWordStreaksByLang; error: Error | null };
const empty = (): RecordData => ({ version: 1, revision: 0, languages: {} });
const emptyLang = (): LanguageState => ({ words: {}, pending: {}, clear: 0 });
const hasPending = (entry: LanguageState) => !!entry.clear || !!Object.keys(entry.pending).length;
const normalizeLang = (lang: string) => {
  const result = lang.trim().toLowerCase();
  if (!result) throw new Error("A language is required.");
  return result;
};
const apply = (words: WordStreaksForLang, entry: LanguageState) => {
  const result = { ...(entry.clear ? {} : words) };
  for (const [word, change] of Object.entries(entry.pending)) {
    if (change.value === null) delete result[word];
    else if (!change.onlyIfMissing || result[word] === undefined) result[word] = change.value;
  }
  return result;
};
function parseRecord(raw: string | null): RecordData {
  if (!raw) return empty();
  const data = JSON.parse(raw) as RecordData;
  if (!data || data.version !== 1 || !Number.isFinite(data.revision) || !data.languages || typeof data.languages !== "object") throw new Error("Invalid saved word streaks.");
  for (const entry of Object.values(data.languages)) {
    if (!entry || !entry.words || typeof entry.words !== "object" || Array.isArray(entry.words) || Object.values(entry.words).some(value => !Number.isFinite(value)) || !entry.pending || typeof entry.pending !== "object" || Array.isArray(entry.pending) || Object.values(entry.pending).some(change => !change || !Number.isFinite(change.revision) || (change.value !== null && !Number.isFinite(change.value))) || !Number.isFinite(entry.clear)) throw new Error("Invalid saved word streaks.");
  }
  return data;
}

/** One store per account/provider. Persistence completes before a mutation resolves. */
export function createWordStreaksStore({ storage, namespace = "default", userID = null, remote, syncDelayMs = 30_000, onError }: {
  storage: WordStreaksStorage;
  namespace?: string;
  userID?: string | null;
  remote?: WordStreaksRemote;
  syncDelayMs?: number;
  onError?: (error: Error) => void;
}) {
  const prefix = `LINGOP_WORD_STREAKS_V1:${encodeURIComponent(namespace)}:`;
  const key = prefix + (userID ? `user:${encodeURIComponent(userID)}` : "anonymous");
  const guestKey = prefix + "anonymous";
  let data = empty();
  let initialized = false;
  let active = false;
  let serial: Promise<unknown> = Promise.resolve();
  let snapshot: WordStreaksSnapshot = { userWordStreaks: {}, error: null };
  const listeners = new Set<() => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const syncing = new Map<string, Promise<void>>();
  const publish = (error: Error | null = null) => {
    snapshot = { userWordStreaks: Object.fromEntries(Object.entries(data.languages).map(([lang, entry]) => [lang, entry.words])), error };
    for (const listener of listeners) listener();
  };
  const report = (error: unknown) => {
    const value = error instanceof Error ? error : new Error(String(error));
    publish(value);
    onError?.(value);
  };
  const queue = <T,>(work: () => Promise<T>): Promise<T> => {
    const next = serial.then(work);
    serial = next.catch(() => {});
    return next;
  };
  const persist = async (next: RecordData) => {
    await storage.setItem(key, JSON.stringify(next));
    data = next;
    publish();
  };
  async function init() {
    if (initialized) return;
    data = parseRecord(await storage.getItem(key));
    initialized = true;
    publish();
    for (const [lang, entry] of Object.entries(data.languages)) if (hasPending(entry)) schedule(lang);
  }
  async function loadLocal(lang: string) {
    await init();
    if (data.languages[lang]) return;
    let entry = emptyLang();
    if (!userID) {
      const legacy = await storage.getItem(`USER_VOCAB_STREAKS_${lang}`);
      if (legacy) {
        const words = JSON.parse(legacy) as WordStreaksForLang;
        if (!words || typeof words !== "object" || Array.isArray(words) || Object.values(words).some(v => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Invalid legacy word streaks.");
        entry.words = Object.fromEntries(Object.entries(words).map(([word, value]) => [word.toUpperCase(), value]));
      }
    }
    await persist({ ...data, languages: { ...data.languages, [lang]: entry } });
  }
  function schedule(lang: string) {
    if (!active || !remote || timers.has(lang)) return;
    timers.set(lang, setTimeout(() => {
      timers.delete(lang);
      void sync(lang).catch(() => {});
    }, Math.max(100, syncDelayMs)));
  }
  async function finishGuestTransfer(lang: string) {
    const entry = data.languages[lang]!;
    if (!entry.guestTransfer) return;
    const guest = parseRecord(await storage.getItem(guestKey));
    // A new anonymous session may have changed its data since the transfer.
    if (entry.guestTransfer.language && JSON.stringify(guest.languages[lang]) === entry.guestTransfer.language) {
      const languages = { ...guest.languages };
      delete languages[lang];
      await storage.setItem(guestKey, JSON.stringify({ ...guest, languages }));
    }
    const legacyKey = `USER_VOCAB_STREAKS_${lang}`;
    if (entry.guestTransfer.legacy && await storage.getItem(legacyKey) === entry.guestTransfer.legacy) {
      await storage.removeItem(legacyKey);
    }
    const { guestTransfer: _completed, ...next } = entry;
    await persist({ ...data, languages: { ...data.languages, [lang]: next } });
  }
  async function syncWork(lang: string) {
    if (!remote) return;
    await queue(() => loadLocal(lang));
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!active) return;
      const previous = await remote.read(lang); // Read errors must never look like an empty account.
      await queue(async () => {
        const entry = data.languages[lang]!;
        if (entry.guestImported) { await finishGuestTransfer(lang); return; }
        const guest = parseRecord(await storage.getItem(guestKey));
        const legacy = await storage.getItem(`USER_VOCAB_STREAKS_${lang}`);
        const words = entry.clear || Object.keys(previous?.word_streaks ?? {}).length ? {} : guest.languages[lang]?.words ?? (legacy ? JSON.parse(legacy) as WordStreaksForLang : {});
        if (!words || typeof words !== "object" || Array.isArray(words) || Object.values(words).some(v => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Invalid guest word streaks.");
        const revision = data.revision + 1;
        const pending = { ...Object.fromEntries(Object.entries(words).map(([word, value]) => [word.toUpperCase(), { value, revision }])), ...entry.pending };
        const next: LanguageState = {
          ...entry, pending, guestImported: true,
          ...(Object.keys(words).length ? { guestTransfer: {
            language: guest.languages[lang] ? JSON.stringify(guest.languages[lang]) : null,
            legacy,
          } } : {}),
        };
        next.words = apply(entry.words, next);
        await persist({ ...data, revision, languages: { ...data.languages, [lang]: next } });
        // The durable marker makes cleanup safe to resume after a failed write.
        await finishGuestTransfer(lang);
      });
      if (!active) return;
      const sent = data.languages[lang]!;
      const words = apply(previous?.word_streaks ?? {}, sent);
      const committed = hasPending(sent) ? await remote.compareAndSet(lang, previous, words) : previous;
      if (hasPending(sent) && !committed) continue;
      await queue(async () => {
        if (!active) return;
        const current = data.languages[lang]!;
        const pending = Object.fromEntries(Object.entries(current.pending).filter(([word, change]) => change.revision !== sent.pending[word]?.revision));
        const next = { ...current, pending, clear: current.clear === sent.clear ? 0 : current.clear };
        next.words = apply(committed?.word_streaks ?? {}, next);
        await persist({ ...data, languages: { ...data.languages, [lang]: next } });
        if (hasPending(next)) schedule(lang);
      });
      return;
    }
    throw new Error("Word streaks changed on another device. Sync will retry.");
  }
  function sync(rawLang: string): Promise<void> {
    const lang = normalizeLang(rawLang);
    const existing = syncing.get(lang);
    if (existing) return existing;
    const timer = timers.get(lang);
    if (timer) clearTimeout(timer);
    timers.delete(lang);
    const work = syncWork(lang).catch(error => { report(error); schedule(lang); throw error; }).finally(() => syncing.delete(lang));
    syncing.set(lang, work);
    return work;
  }
  async function mutate<T>(rawLang: string, change: (words: WordStreaksForLang) => { words: WordStreaksForLang; result: T }, clear = false, touched: string[] = [], onlyIfMissing = false): Promise<T> {
    const lang = normalizeLang(rawLang);
    try {
      return await queue(async () => {
        if (!active) throw new Error("Word-streak account is not active.");
        await loadLocal(lang);
        if (!active) throw new Error("Word-streak account is not active.");
        const entry = data.languages[lang]!;
        const changed = change(entry.words);
        if (Object.values(changed.words).some(value => !Number.isFinite(value))) throw new Error("Word streaks must be finite numbers.");
        const revision = data.revision + 1;
        const pending = { ...(clear ? {} : entry.pending) };
        for (const word of new Set([...Object.keys(entry.words), ...Object.keys(changed.words), ...touched.map(word => word.toUpperCase())])) {
          if (entry.words[word] !== changed.words[word] || touched.some(value => value.toUpperCase() === word)) pending[word] = { value: changed.words[word] ?? null, revision, ...(onlyIfMissing ? { onlyIfMissing: true } : {}) };
        }
        const next = { ...entry, words: changed.words, pending: remote ? pending : {}, clear: remote ? (clear ? revision : entry.clear) : 0 };
        await persist({ ...data, revision, languages: { ...data.languages, [lang]: next } });
        if (hasPending(next)) schedule(lang);
        return changed.result;
      });
    } catch (error) { report(error); throw error; }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { active = true; void queue(async () => { await init(); for (const [lang, entry] of Object.entries(data.languages)) if (hasPending(entry)) schedule(lang); }).catch(report); },
    stop() { active = false; for (const timer of timers.values()) clearTimeout(timer); timers.clear(); },
    async ensureUserWordStreaksForLang(rawLang: string) {
      const lang = normalizeLang(rawLang);
      try { await queue(() => loadLocal(lang)); } catch (error) { report(error); throw error; }
      if (remote) await sync(lang).catch(() => {});
    },
    async syncAll() {
      await queue(init);
      await Promise.all(Object.keys(data.languages).map(sync));
    },
    syncUserWordStreaks: sync,
    setUserWordStreaksToValue: (lang: string, words: string[], value: number) => mutate(lang, current => ({ words: setWordStreaksToValue(current, words, value), result: undefined }), false, words),
    setUserWordStreaksByDelta: (lang: string, deltas: { word: string; streakDelta: number }[]) => mutate(lang, current => ({ words: setWordStreaksByDelta(current, deltas), result: undefined }), false, deltas.map(item => item.word)),
    setUserWordStreaksToMin1: (lang: string, words: string[]) => mutate(lang, current => { const result = setWordStreaksToMin1(current, words); return { words: result.wordStreaks, result: result.newWords }; }, false, [], true),
    deleteUserWordStreaks: (lang: string, words: string[]) => mutate(lang, current => ({ words: deleteWordStreaks(current, words), result: undefined }), false, words),
    deleteAllUserWordStreaksForLang: (lang: string) => mutate(lang, () => ({ words: {}, result: undefined }), true),
  };
}
