import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CampLingoPricing, type CampLingoPricingProps } from './camp-lingo-pricing.js';
import { CAMP_LINGO_PRODUCTS } from '../../core/camp-lingo-billing.js';

const fixtures = vi.hoisted(() => ({ auth: {} as any, client: {} as any }));
vi.mock('./supabase-auth.js', () => ({ useSupabaseSignedInStatus: () => fixtures.auth }));
vi.mock('./lingop-client-data-provider.js', () => ({ useLingopClientData: () => ({ supabaseClient: fixtures.client }) }));
vi.mock('./camp-lingo-auth-form.js', () => ({ CampLingoAuthForm: () => createElement('div', {}, 'Sign in form') }));
let tree: ReactTestRenderer;
let fetcher: ReturnType<typeof vi.fn>;
let member: any;
let session: any;
let props: CampLingoPricingProps;
const catalog = { currencies: ['usd', 'aud', 'hkd', 'jpy'], prices: { core: { amounts: { usd: 299, aud: 449, hkd: 1800, jpy: 480 } }, plus: { amounts: { usd: 899, aud: 1299, hkd: 5800, jpy: 1480 } } } };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
function text(node: ReactTestInstance): string { return node.children.map(child => typeof child === 'string' ? child : text(child)).join(''); }
function buttons() { return tree.root.findAllByType('button'); }
function button(label: string) { return buttons().find(b => text(b) === label)!; }
function calls(path: string) { return fetcher.mock.calls.filter(([url]) => String(url).endsWith('/' + path)); }
function signedIn(tier: 'free' | 'core' | 'plus') {
  fixtures.auth.signedInStatus = true; fixtures.auth.supabaseUserID = 'user-1';
  fixtures.auth.enabledSubProd = tier === 'free' ? null : CAMP_LINGO_PRODUCTS[tier];
  member = { tier, currency: tier === 'free' ? null : 'hkd', recurringAmount: tier === 'free' ? null : tier === 'core' ? 1800 : 5800, scheduledTier: null, cancelAtPeriodEnd: false };
}
async function render(extra: Partial<CampLingoPricingProps> = {}) {
  props = { guiLang: 'en', ...extra };
  await act(async () => { tree = create(createElement(CampLingoPricing, props)); });
}
async function click(label: string) { await act(async () => { await button(label).props.onClick(); }); }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  fixtures.auth = { signedInStatus: false, supabaseUserID: null, enabledSubProd: null, refreshEnabledSubProd: vi.fn(async () => null) };
  fixtures.client = { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: `test-token-${fixtures.auth.supabaseUserID}` } } })) } };
  member = null; session = { url: 'https://checkout.stripe.com/c/pay/test' };
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { href: 'http://localhost:3000/en/es', assign: vi.fn() } }));
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  vi.stubGlobal('navigator', { language: 'en-US' });
  fetcher = vi.fn(async (url: string) => {
    const data = url.endsWith('/catalog') ? catalog : url.endsWith('/membership') ? await member : session;
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal('fetch', fetcher);
  const error = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => { if (!String(args[0]).startsWith('react-test-renderer is deprecated')) error(...args); });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
it('signed-out Plus opens sign-in; a free comparison without a close handler has no dead button', async () => {
  const signIn = vi.fn(); await render({ onSignIn: signIn });
  expect(button('Continue with Free')).toBeUndefined();
  await click('Choose Plus'); expect(signIn).toHaveBeenCalledOnce(); expect(calls('session')).toHaveLength(0);
});
it('the built-in sign-in form has a working back-to-plans path', async () => {
  await render(); await click('Choose Plus'); expect(text(tree.root)).toContain('Sign in form');
  await click('Back to plans'); expect(button('Choose Plus')).toBeDefined();
});
it('Free can check out in the chosen currency and return to localhost', async () => {
  signedIn('free'); await render();
  expect(button('Manage billing')).toBeUndefined();
  await act(async () => tree.root.findByType('select').props.onChange({ target: { value: 'jpy' } }));
  await click('Choose Plus');
  expect(JSON.parse(calls('session')[0]![1].body)).toMatchObject({ tier: 'plus', currency: 'jpy', returnUrl: 'http://localhost:3000/en/es', action: 'checkout' });
  expect(window.location.assign).toHaveBeenCalledWith(session.url);
});
it('Plus in Translate has no Free or unavailable Core CTA, and Manage billing opens Stripe', async () => {
  signedIn('plus'); session = { url: 'https://billing.stripe.com/p/session/test' };
  await render({ recommendedTier: 'plus', plans: { core: { disabled: true, reason: 'Plus required here.' } }, onComplete: vi.fn() });
  expect(buttons().map(text)).toEqual(['Manage billing']);
  expect(text(tree.root)).toContain('Unavailable');
  expect(text(tree.root)).not.toContain('Your subscription keeps');
  expect(text(tree.root)).not.toContain('Core and Plus are alternatives');
  expect(tree.root.findByType('select').props.disabled).toBe(true);
  await click('Manage billing'); expect(window.location.assign).toHaveBeenCalledWith(session.url);
});
it('Core can upgrade, and only available plans offer downgrade confirmation', async () => {
  signedIn('core'); await render(); await click('Upgrade to Plus');
  expect(JSON.parse(calls('session')[0]![1].body)).toMatchObject({ action: 'checkout', tier: 'plus', currency: 'hkd' });
});
it('Plus downgrade requires confirmation, and Keep Plus dismisses it without a request', async () => {
  signedIn('plus'); await render(); await click('Change to Core');
  expect(calls('session')).toHaveLength(0); await click('Keep Plus'); expect(button('Confirm change to Core')).toBeUndefined();
  await click('Change to Core'); session = { message: 'Scheduled' }; await click('Confirm change to Core');
  expect(JSON.parse(calls('session')[0]![1].body)).toMatchObject({ action: 'downgrade', tier: 'core' });
});
it('membership loading explains disabled buttons and overlapping focus events share one request', async () => {
  signedIn('free'); const pending = deferred(); member = pending.promise;
  await render(); expect(button('Choose Plus').props.disabled).toBe(true); expect(text(tree.root)).toContain('Loading your membership');
  await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  expect(calls('membership')).toHaveLength(1);
  await act(async () => pending.resolve({ tier: 'free', currency: null }));
  expect(button('Choose Plus').props.disabled).toBe(false);
  await act(async () => tree.update(createElement(CampLingoPricing, { ...props, translate: (s: string) => s })));
  expect(calls('membership')).toHaveLength(1);
});
it('billing waits for background membership refresh and ignores repeated clicks', async () => {
  signedIn('plus'); await render(); const pending = deferred(); member = pending.promise;
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => { button('Manage billing').props.onClick(); button('Manage billing').props.onClick(); });
  expect(calls('session')).toHaveLength(0);
  await act(async () => pending.resolve({ tier: 'plus', currency: 'hkd' }));
  expect(calls('session')).toHaveLength(1);
});
it('network errors are visible and retry restores both prices and membership', async () => {
  signedIn('free'); fetcher.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await render(); expect(text(tree.root)).toContain('Unable to connect to billing');
  await click('Try again'); expect(button('Choose Plus').props.disabled).toBe(false);
  expect(tree.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
});
it('a stale membership response cannot overwrite the next signed-in account', async () => {
  signedIn('plus'); const old = deferred(); member = old.promise; await render();
  fixtures.auth.supabaseUserID = 'user-2'; fixtures.auth.enabledSubProd = null; member = { tier: 'free', currency: null };
  await act(async () => tree.update(createElement(CampLingoPricing, { ...props })));
  await act(async () => old.resolve({ tier: 'plus', currency: 'hkd' }));
  expect(button('Choose Plus')).toBeDefined(); expect(button('Manage billing')).toBeUndefined();
});
it('scheduled or canceling memberships offer management instead of invalid repeat plan changes', async () => {
  signedIn('plus'); member.scheduledTier = 'core'; await render();
  expect(button('Change to Core')).toBeUndefined(); expect(text(tree.root)).toContain('Scheduled');
  expect(button('Keep Plus')).toBeDefined();
  session = { message: 'Removed' }; member = { ...member, scheduledTier: null };
  await click('Keep Plus'); expect(button('Change to Core')).toBeDefined();
  expect(JSON.parse(calls('session')[0]![1].body)).toMatchObject({ action: 'undo-change' });
  member.cancelAtPeriodEnd = true;
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(button('Change to Core')).toBeUndefined(); expect(button('Manage billing')).toBeDefined();
});
