import { afterEach, expect, it, vi } from 'vitest';
import { guessCampLingoCurrency, guessCampLingoFixedCurrency, requestCampLingoBilling } from './camp-lingo-billing.js';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
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

function browserLocation(timeZone: string, language = 'en-US') {
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', { language });
  const options = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ ...options, timeZone });
}
it.each([
  ['Australia/Melbourne', 'aud'], ['Pacific/Auckland', 'nzd'], ['Europe/London', 'gbp'],
  ['Asia/Hong_Kong', 'hkd'], ['Asia/Singapore', 'sgd'], ['Asia/Tokyo', 'jpy'],
  ['America/Toronto', 'cad'], ['Europe/Paris', 'eur'], ['America/New_York', 'usd'],
  ['America/Indiana/Knox', 'usd'], ['Pacific/Honolulu', 'usd'],
  ['Europe/Sofia', 'eur'], ['Europe/Podgorica', 'eur'], ['America/Regina', 'cad'], ['America/Whitehorse', 'cad'], ['Atlantic/Canary', 'eur'],
])('recognizes the fixed currency for %s even with an English/US browser language', (zone, currency) => {
  browserLocation(zone!);
  expect(guessCampLingoFixedCurrency()).toBe(currency);
  expect(guessCampLingoCurrency()).toBe(currency);
});
it.each(['Europe/Stockholm', 'Europe/Warsaw', 'America/Sao_Paulo', 'Asia/Kolkata', 'Asia/Seoul', 'Asia/Bangkok'])('keeps USD as a reference outside fixed markets in %s', zone => {
  browserLocation(zone);
  expect(guessCampLingoFixedCurrency()).toBeNull();
  expect(guessCampLingoCurrency()).toBe('usd');
});
it.each([['en-US', 'usd'], ['zh-Hant-HK', 'hkd'], ['de-DE', 'eur'], ['sv-SE', null], ['en', null]])('uses browser-language region only without a regional time zone: %s', (language, currency) => {
  browserLocation('UTC', language!);
  expect(guessCampLingoFixedCurrency()).toBe(currency);
  expect(guessCampLingoCurrency()).toBe(currency ?? 'usd');
});
it('keeps the server-rendered currency fallback in USD', () => {
  vi.stubGlobal('window', undefined);
  expect(guessCampLingoFixedCurrency()).toBeNull();
  expect(guessCampLingoCurrency()).toBe('usd');
});

it.each([['sr-ME', 'eur'], ['sq-XK', 'eur'], ['sr-RS', null], ['en-US', null]])('only uses an explicit Montenegro/Kosovo region to disambiguate the shared Belgrade zone: %s', (language, currency) => {
  browserLocation('Europe/Belgrade', language!);
  expect(guessCampLingoFixedCurrency()).toBe(currency);
});
