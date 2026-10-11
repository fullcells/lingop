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

// IANA regional zones identify the fixed-currency markets without treating an
// English/US browser language as proof that a buyer elsewhere is in the US.
const fixedCurrencyZones: Partial<Record<CampLingoCurrency, readonly string[]>> = {
  usd: [
    "America/New_York", "America/Detroit", "America/Chicago", "America/Menominee",
    "America/Denver", "America/Boise", "America/Phoenix", "America/Los_Angeles",
    "America/Anchorage", "America/Juneau", "America/Sitka", "America/Metlakatla",
    "America/Yakutat", "America/Nome", "America/Adak", "Pacific/Honolulu",
    "America/Puerto_Rico", "America/St_Thomas", "Pacific/Guam", "Pacific/Saipan",
    "Pacific/Pago_Pago", "Pacific/Johnston", "Pacific/Wake", "Pacific/Midway", "America/Guayaquil", "Pacific/Galapagos", "America/Panama",
    "America/El_Salvador", "Asia/Dili", "Pacific/Majuro", "Pacific/Kwajalein",
    "Pacific/Chuuk", "Pacific/Truk", "Pacific/Pohnpei", "Pacific/Ponape",
    "Pacific/Kosrae", "Pacific/Palau", "America/Tortola", "America/Grand_Turk",
  ],
  cad: [
    "America/St_Johns", "America/Halifax", "America/Glace_Bay", "America/Moncton",
    "America/Goose_Bay", "America/Blanc-Sablon", "America/Toronto", "America/Iqaluit",
    "America/Atikokan", "America/Winnipeg", "America/Resolute", "America/Rankin_Inlet",
    "America/Regina", "America/Swift_Current", "America/Edmonton", "America/Cambridge_Bay",
    "America/Inuvik", "America/Vancouver", "America/Creston", "America/Dawson_Creek",
    "America/Fort_Nelson", "America/Whitehorse", "America/Dawson", "America/Montreal",
    "America/Thunder_Bay", "America/Nipigon", "America/Pangnirtung", "America/Rainy_River",
    "America/Yellowknife", "America/Coral_Harbour",
  ],
  eur: [
    "Europe/Sofia", "Europe/Andorra", "Europe/Vienna", "Europe/Brussels", "Asia/Nicosia",
    "Asia/Famagusta", "Europe/Nicosia", "Europe/Berlin", "Europe/Busingen",
    "Europe/Tallinn", "Europe/Madrid", "Africa/Ceuta", "Atlantic/Canary",
    "Europe/Helsinki", "Europe/Mariehamn", "Europe/Paris", "Europe/Athens",
    "Europe/Zagreb", "Europe/Dublin", "Europe/Rome", "Europe/Vilnius",
    "Europe/Luxembourg", "Europe/Riga", "Europe/Monaco", "Europe/Malta",
    "Europe/Amsterdam", "Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores",
    "Europe/Ljubljana", "Europe/Bratislava", "Europe/San_Marino", "Europe/Vatican", "Europe/Podgorica",
  ],
};
const currencyByZone = new Map(Object.entries(fixedCurrencyZones).flatMap(([currency, zones]) => zones.map(zone => [zone, currency as CampLingoCurrency] as const)));
const currencyByRegion: Record<string, CampLingoCurrency> = {
  AU: "aud", CX: "aud", CC: "aud", NF: "aud", KI: "aud", NR: "aud", TV: "aud",
  NZ: "nzd", CK: "nzd", NU: "nzd", PN: "nzd", GB: "gbp", GG: "gbp", JE: "gbp", IM: "gbp", HK: "hkd", SG: "sgd", JP: "jpy", CA: "cad",
  US: "usd", AS: "usd", GU: "usd", MP: "usd", PR: "usd", VI: "usd", EC: "usd",
  PA: "usd", SV: "usd", TL: "usd", MH: "usd", FM: "usd", PW: "usd", VG: "usd", TC: "usd",
  AT: "eur", BE: "eur", BG: "eur", CY: "eur", DE: "eur", EE: "eur", ES: "eur", FI: "eur",
  FR: "eur", GR: "eur", HR: "eur", IE: "eur", IT: "eur", LT: "eur", LU: "eur",
  LV: "eur", MT: "eur", NL: "eur", PT: "eur", SI: "eur", SK: "eur", AD: "eur",
  MC: "eur", SM: "eur", VA: "eur", AX: "eur", ME: "eur", XK: "eur",
};

/** null means USD is a display reference; checkout should start in AUD. */
export function guessCampLingoFixedCurrency(): CampLingoCurrency | null {
  if (typeof window === "undefined") return null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  if (zone.startsWith("Australia/") || ["Antarctica/Macquarie", "Indian/Christmas", "Indian/Cocos", "Pacific/Norfolk", "Pacific/Tarawa", "Pacific/Kanton", "Pacific/Enderbury", "Pacific/Kiritimati", "Pacific/Nauru", "Pacific/Funafuti"].includes(zone)) return "aud";
  if (["Pacific/Auckland", "Pacific/Chatham", "Pacific/Rarotonga", "Pacific/Niue", "Pacific/Pitcairn"].includes(zone)) return "nzd";
  if (["Europe/London", "Europe/Belfast", "Europe/Guernsey", "Europe/Jersey", "Europe/Isle_of_Man"].includes(zone)) return "gbp";
  if (zone === "Asia/Hong_Kong" || zone === "Hongkong") return "hkd";
  if (zone === "Asia/Singapore" || zone === "Singapore") return "sgd";
  if (zone === "Asia/Tokyo" || zone === "Japan") return "jpy";
  if (zone.startsWith("US/") || /^America\/(Indiana|Kentucky|North_Dakota)\//.test(zone)) return "usd";
  if (zone.startsWith("Canada/")) return "cad";
  const fixed = currencyByZone.get(zone);
  if (fixed) return fixed;
  // Montenegro/Kosovo can resolve to the shared Belgrade zone. Only their
  // explicit locale region distinguishes them from Serbia's currency market.
  let region: string | undefined;
  try { region = new Intl.Locale(navigator.language).region; } catch { /* No region hint. */ }
  if (zone === "Europe/Belgrade" && (region === "ME" || region === "XK")) return "eur";
  // A regional zone outside these markets wins over a browser-language region.
  // Locale is only a fallback when the time zone provides no country hint.
  if (/^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\//.test(zone)) return null;
  return region ? currencyByRegion[region] ?? null : null;
}

/** Preserve the USD visual fallback for existing consumers. */
export function guessCampLingoCurrency(): CampLingoCurrency {
  return guessCampLingoFixedCurrency() ?? "usd";
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
