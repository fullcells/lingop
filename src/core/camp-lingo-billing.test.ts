import { afterEach, expect, it, vi } from 'vitest';
import { requestCampLingoBilling } from './camp-lingo-billing.js';
afterEach(() => vi.unstubAllGlobals());
it('coalesces provider and pricing refreshes without caching or crossing accounts', async () => {
  let finish!: (value: unknown) => void;
  const pending = new Promise(r => { finish = r; });
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => pending }));
  vi.stubGlobal('fetch', fetcher);
  const first = requestCampLingoBilling('membership', { accessToken: 'first' });
  const second = requestCampLingoBilling('membership', { accessToken: 'first' });
  const other = requestCampLingoBilling('membership', { accessToken: 'second' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  finish({ tier: 'plus' }); await Promise.all([first, second, other]);
  await requestCampLingoBilling('membership', { accessToken: 'first' });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('failed membership refreshes can be retried and non-JSON server errors stay readable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ ok: false, json: async () => { throw new Error('Unexpected <html>'); } }).mockResolvedValue({ ok: true, json: async () => ({ tier: 'free' }) }));
  await expect(requestCampLingoBilling('membership', { accessToken: 'test' })).rejects.toThrow('Unable to connect to billing');
  await expect(requestCampLingoBilling('membership', { accessToken: 'test' })).rejects.toThrow('Billing is temporarily unavailable');
  await expect(requestCampLingoBilling('membership', { accessToken: 'test' })).resolves.toEqual({ tier: 'free' });
});
