import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSBWordsCache, getSBWordsForWords, type SBWordRow2 } from './sb-words.js';

const row = (id: number, word: string): SBWordRow2 => ({ id, word, word_lang: 'yue', gloss_lang: 'en', gloss: `gloss ${id}`, is_core: true, is_human_verified: true, created_at: '2026-10-13' });
function database(rows: SBWordRow2[]) {
  const calls: { filters: Record<string, unknown>; offset?: number }[] = [];
  let fail = false;
  const db = { from(table: string) {
    expect(table).toBe('words2');
    const call = { filters: {} } as typeof calls[number]; calls.push(call);
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { call.filters[key] = value; return query; },
      in(key: string, value: unknown) { call.filters[key] = value; return query; },
      filter(key: string, op: string, value: string) { expect(op).toBe('imatch'); call.filters[key] = value; return query; },
      order() { return query; },
      async range(from: number, to: number) {
        call.offset = from;
        const matches = rows.filter(row => new RegExp(String(call.filters.word), 'i').test(row.word));
        return { data: matches.slice(from, to + 1), error: fail ? new Error('offline') : null };
      },
    };
    return query;
  } };
  return { db, calls, fail: (value: boolean) => { fail = value; } };
}
afterEach(() => { clearSBWordsCache(); vi.restoreAllMocks(); });

describe('requested saved words', () => {
  it('preserves case/whitespace matching, literal punctuation and both core values without unrelated rows', async () => {
    const words = [' Tea ', '50%_(a,b)."*+?\\', '點心'];
    const data = [row(1, '  TEA\t'), row(2, words[1]!), row(3, '點心'), { ...row(4, '點心'), is_core: false }, row(5, 'Teapot')];
    const { db, calls } = database(data);
    expect(await getSBWordsForWords('yue', 'en', words, { supabaseClient: db })).toEqual(data.slice(0, 4));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.filters).toMatchObject({ word_lang: 'yue', gloss_lang: 'en', is_core: [true, false] });
  });

  it('pages duplicate gloss candidates and batches more than fifty distinct words', async () => {
    const data = Array.from({ length: 1001 }, (_, id) => row(id, '點心'));
    const { db, calls } = database(data);
    const words = ['點心', ...Array.from({ length: 51 }, (_, i) => `title${i}`)];
    expect(await getSBWordsForWords('yue', 'en', words, { supabaseClient: db })).toEqual(data);
    expect(calls.some(call => call.offset === 1000)).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it('shares concurrent/warm reads per client, expires, clears, and retries failures', async () => {
    const { db, calls, fail } = database([row(1, '點心')]);
    const load = () => getSBWordsForWords('yue', 'en', ['點心'], { supabaseClient: db });
    await Promise.all([load(), load(), load()]); await load();
    expect(calls).toHaveLength(1);
    const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 300_001);
    await load(); expect(calls).toHaveLength(2);
    clearSBWordsCache(); fail(true);
    await expect(load()).rejects.toThrow('offline');
    fail(false); await load(); expect(calls).toHaveLength(4);
    const other = database([row(2, '點心')]);
    expect((await getSBWordsForWords('yue', 'en', ['點心'], { supabaseClient: other.db }))[0]!.id).toBe(2);
    expect(await getSBWordsForWords('yue', 'en', [], { supabaseClient: db })).toEqual([]);
    expect(calls).toHaveLength(4);
  });
});
