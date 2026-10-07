/** Camp Lingo membership is independent of the app that initiated checkout. */
export type CampLingoTier = "free" | "core" | "plus";
export type CampLingoPaidTier = Exclude<CampLingoTier, "free">;
export const CAMP_LINGO_PRODUCTS = {
  core: "prod_camplingo_core",
  plus: "prod_camplingo_plus",
} as const;
/** Existing paid and complimentary memberships retain full access. */
export const CAMP_LINGO_LEGACY_PLUS_PRODUCTS = [
  "prod_TwF7eqsuPfNsY6", "prod_SCgsprzaWOJWKV", "prod_SD3eNfeGmU3SbZ",
] as const;

export function getCampLingoTier(product: string | null | undefined): CampLingoTier | undefined {
  if (product === undefined) return undefined;
  if (product === CAMP_LINGO_PRODUCTS.core) return "core";
  if (product === CAMP_LINGO_PRODUCTS.plus || CAMP_LINGO_LEGACY_PLUS_PRODUCTS.some(id => id === product)) return "plus";
  return "free";
}

export function hasCampLingoAccess(product: string | null | undefined, minimum: CampLingoPaidTier = "core"): boolean {
  const tier = getCampLingoTier(product);
  return tier === "plus" || (minimum === "core" && tier === "core");
}

export type CampLingoCurrency = "aud" | "usd" | "nzd" | "gbp" | "cad" | "sgd" | "hkd" | "jpy" | "eur";
export type CampLingoCatalog = {
  currencies: CampLingoCurrency[];
  prices: Record<CampLingoPaidTier, { amounts: Partial<Record<CampLingoCurrency, number>> }>;
};
export type CampLingoMembership = {
  tier: CampLingoTier;
  currency: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  recurringAmount: number | null;
  scheduledTier: CampLingoPaidTier | null;
};

export function formatCampLingoAmount(amount: number, currency: string, locale = "en") {
  const options = { style: "currency" as const, currency: currency.toUpperCase(), currencyDisplay: "code" as const };
  let formatter: Intl.NumberFormat;
  try { formatter = new Intl.NumberFormat(locale, options); }
  catch { formatter = new Intl.NumberFormat("en", options); }
  const digits = new Intl.NumberFormat("en", options).resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}

export function guessCampLingoCurrency(): CampLingoCurrency {
  if (typeof window === "undefined") return "usd";
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone.startsWith("Australia/")) return "aud";
  if (zone === "Pacific/Auckland" || zone === "Pacific/Chatham") return "nzd";
  if (zone === "Europe/London") return "gbp";
  if (zone === "Asia/Hong_Kong") return "hkd";
  if (zone === "Asia/Singapore") return "sgd";
  if (zone === "Asia/Tokyo") return "jpy";
  const region = navigator.language.split("-").at(-1)?.toUpperCase();
  if (region === "CA" || /Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns/.test(zone)) return "cad";
  if (["AT","BE","CY","DE","EE","ES","FI","FR","GR","HR","IE","IT","LT","LU","LV","MT","NL","PT","SI","SK"].includes(region ?? "")) return "eur";
  return "usd";
}

export type CampLingoBillingAction = "checkout" | "portal" | "downgrade" | "undo-change";
const membershipRequests = new Map<string, Promise<unknown>>();
/** Only accepts a Supabase access token; customer IDs and amounts are resolved by the server. */
export async function requestCampLingoBilling<T>(path: string, options: {
  apiBaseUrl?: string;
  accessToken?: string;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
} = {}): Promise<T> {
  // The return-to-app provider and pricing UI can refresh together. Share only
  // in-flight requests, scoped to this token and service, without caching results.
  const key = path === "membership" && options.accessToken && !options.body && !options.signal
    ? JSON.stringify([options.apiBaseUrl ?? "https://camplingo.com", options.accessToken]) : null;
  if (key) {
    const existing = membershipRequests.get(key);
    if (existing) return existing as Promise<T>;
    const request = fetchCampLingoBilling<T>(path, options);
    membershipRequests.set(key, request);
    try { return await request; } finally { membershipRequests.delete(key); }
  }
  return fetchCampLingoBilling<T>(path, options);
}

async function fetchCampLingoBilling<T>(path: string, options: {
  apiBaseUrl?: string; accessToken?: string; body?: Record<string, unknown>; signal?: AbortSignal;
}): Promise<T> {
  let response: Response;
  try { response = await fetch(`${(options.apiBaseUrl ?? "https://camplingo.com").replace(/\/$/, "")}/api/billing/${path}`, {
    method: options.body ? "POST" : "GET",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  }); } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error("Unable to connect to billing. Please check your connection and try again.");
  }
  const data = await response.json().catch(() => { throw new Error("Billing is temporarily unavailable. Please try again."); });
  if (!response.ok) throw new Error(data.error || "Unable to load billing. Please try again.");
  return data as T;
}
