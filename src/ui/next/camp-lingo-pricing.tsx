"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { asSupabaseRuntimeClient } from "../../core/supabase.js";
import { formatCampLingoAmount, getCampLingoTier, guessCampLingoCurrency, requestCampLingoBilling, type CampLingoCatalog, type CampLingoCurrency, type CampLingoMembership, type CampLingoPaidTier, type CampLingoTier } from "../../core/camp-lingo-billing.js";
import { useLingopClientData } from "./lingop-client-data-provider.js";
import { useSupabaseSignedInStatus } from "./supabase-auth.js";
import { CampLingoAuthForm } from "./camp-lingo-auth-form.js";

export type CampLingoPricingProps = {
  guiLang: string;
  /** Translate descriptions in the consumer's UI language (for example useOAT().OAT). */
  translate?: (text: string) => string;
  recommendedTier?: CampLingoPaidTier;
  plans?: Partial<Record<CampLingoTier, { hidden?: boolean; disabled?: boolean; reason?: string; features?: ReactNode }>>;
  /** Optional consumer-owned auth dialog. Otherwise the shared auth form is shown. */
  onSignIn?: () => void;
  onComplete?: () => void;
  apiBaseUrl?: string;
  /** Disable inside Translate & Learn; other apps link brand mentions in a new tab. */
  linkToTranslateApp?: boolean;
  className?: string;
};

/** Shared fixed-price comparison, authentication, checkout, and membership management. */
export function CampLingoPricing({ guiLang, translate, recommendedTier = "core", plans = {}, onSignIn, onComplete, apiBaseUrl = "https://camplingo.com", linkToTranslateApp = true, className = "" }: CampLingoPricingProps) {
  const OAT = translate ?? ((text: string) => text);
  const appMention = (text: string) => text.split("{_TRANSLATE_APP_}").map((part, index) => <Fragment key={index}>{index > 0 && (linkToTranslateApp ? <a href="https://translate.camplingo.com" target="_blank" rel="noopener noreferrer">Translate &amp; Learn</a> : "Translate & Learn")}{part}</Fragment>);
  const { supabaseClient } = useLingopClientData();
  const auth = useSupabaseSignedInStatus();
  const [catalog, setCatalog] = useState<CampLingoCatalog | null>(null);
  const [memberState, setMemberState] = useState<{ user: string; data: CampLingoMembership } | null>(null);
  const membership = memberState?.user === auth.supabaseUserID ? memberState.data : null;
  const [currency, setCurrency] = useState<CampLingoCurrency>("usd");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const pendingRefresh = useRef<{ user: string; promise: Promise<void> } | null>(null);
  const actionInFlight = useRef(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const identity = useRef(auth.supabaseUserID);
  identity.current = auth.supabaseUserID;
  const tier = membership?.tier ?? getCampLingoTier(auth.enabledSubProd);
  const subscribed = tier === "core" || tier === "plus";
  const errorText = error === "Unable to connect to billing. Please check your connection and try again." ? OAT("Unable to connect to billing. Please check your connection and try again.")
    : error === "Billing is temporarily unavailable. Please try again." ? OAT("Billing is temporarily unavailable. Please try again.")
    : error === "Please sign in to manage your membership." ? OAT("Please sign in to manage your membership.") : error;
  const getToken = useCallback(async () => {
    const result = await asSupabaseRuntimeClient(supabaseClient)?.auth?.getSession?.();
    const token = result?.data.session?.access_token;
    if (!token) throw new Error("Please sign in to manage your membership.");
    return token;
  }, [supabaseClient]);

  const refresh = useCallback(async () => {
    if (!auth.supabaseUserID) return;
    const user = auth.supabaseUserID;
    if (pendingRefresh.current?.user === user) return pendingRefresh.current.promise;
    const promise = (async () => {
      const state = await requestCampLingoBilling<CampLingoMembership>("membership", { apiBaseUrl, accessToken: await getToken() });
      if (identity.current !== user) return;
      setMemberState({ user, data: state });
      if (state.currency) setCurrency(state.currency as CampLingoCurrency);
      await auth.refreshEnabledSubProd();
    })();
    pendingRefresh.current = { user, promise };
    try { await promise; }
    finally { if (pendingRefresh.current?.promise === promise) pendingRefresh.current = null; }
  }, [apiBaseUrl, getToken, auth.supabaseUserID, auth.refreshEnabledSubProd]);

  useEffect(() => {
    setCurrency(guessCampLingoCurrency());
    const controller = new AbortController();
    requestCampLingoBilling<CampLingoCatalog>("catalog", { apiBaseUrl, signal: controller.signal }).then(setCatalog).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [apiBaseUrl]);
  useEffect(() => {
    setMemberState(null);
    setConfirmDowngrade(false);
    if (auth.signedInStatus) { setAuthOpen(false); void refresh().catch(e => setError(e.message)); }
  }, [auth.supabaseUserID, auth.signedInStatus, refresh]);
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible" && !actionInFlight.current) void refresh().catch(e => setError(e.message)); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);

  async function act(action: "checkout" | "portal" | "downgrade" | "undo-change", selected?: CampLingoPaidTier) {
    if (actionInFlight.current) return;
    if (!auth.signedInStatus) { if (onSignIn) onSignIn(); else setAuthOpen(true); return; }
    const user = auth.supabaseUserID;
    actionInFlight.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      // Membership refresh and session creation use the same server-side lease.
      // Finish a focus-triggered refresh before opening billing.
      await pendingRefresh.current?.promise.catch(() => {});
      if (identity.current !== user) return;
      const result = await requestCampLingoBilling<{ url?: string; message?: string }>("session", {
        apiBaseUrl, accessToken: await getToken(),
        body: { action, tier: selected, currency, locale: guiLang, returnUrl: window.location.href },
      });
      if (identity.current !== user) return;
      if (result.url) {
        const url = new URL(result.url);
        if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error(OAT("Unable to open secure checkout."));
        window.location.assign(url.href);
      } else { setConfirmDowngrade(false); setNotice(action === "undo-change" ? OAT("Your scheduled change has been removed. You keep Plus.") : action === "downgrade" ? OAT("Your change to Core takes effect at your next renewal.") : OAT("Membership updated.")); await refresh(); onComplete?.(); }
    } catch (e) { setError(e instanceof Error ? e.message : OAT("Unable to load billing. Please try again.")); messageRef.current?.scrollIntoView?.({ block: "nearest" }); }
    finally { actionInFlight.current = false; setBusy(false); }
  }

  if (authOpen && !auth.signedInStatus) return <section className={`lingop-pricing ${className}`}><button type="button" onClick={() => setAuthOpen(false)}>{OAT("Back to plans")}</button><CampLingoAuthForm guiLang={guiLang} /></section>;
  return <section className={`lingop-pricing ${className}`} aria-label={OAT("Camp Lingo membership")}>
    <header className="lingop-pricing__header"><p className="lingop-pricing__brand">Camp Lingo</p><h2>{OAT("One membership. More ways to learn.")}</h2><p>{OAT("Choose the plan that fits your learning.")}</p></header>
    {notice && <p role="status" className="lingop-pricing__message">{notice}</p>}
    {membership?.scheduledTier && <div className="lingop-pricing__message"><p>{OAT("Your change to Core takes effect at your next renewal.")}</p><button type="button" disabled={busy} onClick={() => void act("undo-change")}>{OAT("Keep Plus")}</button></div>}
    {membership?.cancelAtPeriodEnd && <p className="lingop-pricing__message">{OAT("Your membership is set to end after the current billing period.")}</p>}
    {!catalog && !error && <p role="status">{OAT("Loading prices…")}</p>}
    {auth.signedInStatus && !membership && !error && <p role="status">{OAT("Loading your membership…")}</p>}
    <div className="lingop-pricing__grid">{(["free", "core", "plus"] as const).filter(plan => !plans[plan]?.hidden).map(plan => {
      const current = tier === plan;
      const disabled = plans[plan]?.disabled;
      const scheduled = membership?.scheduledTier === plan;
      const amount = plan === "free" ? 0 : current && membership?.recurringAmount != null ? membership.recurringAmount : catalog?.prices[plan].amounts[currency];
      return <article className={`lingop-pricing__card ${plan === recommendedTier ? "lingop-pricing__card--recommended" : ""}`} key={plan}>
        <div className="lingop-pricing__badge">{current ? OAT("Current plan") : scheduled ? OAT("Scheduled") : disabled ? OAT("Unavailable") : plan === recommendedTier ? OAT("Recommended for this app") : "\u00a0"}</div>
        <h3>{plan === "free" ? OAT("Free") : plan === "core" ? "Core" : "Plus"}</h3>
        <div className="lingop-pricing__amount">{amount === undefined ? "—" : formatCampLingoAmount(amount, currency, guiLang)}<small>{OAT("per month")}</small></div>
        <p>{plan === "free" ? OAT("Explore Camp Lingo at your own pace.") : plan === "core" ? OAT("More learning across Camp Lingo's ready-made content apps.") : OAT("Everything in Core, plus faster learning with your own translations.")}</p>
        <ul>{plan === "free" ? <><li>{OAT("Free learning features")}</li><li>{appMention(OAT("Limited fast translations in {_TRANSLATE_APP_}"))}</li></> : <><li>{OAT("Paid features across Camp Lingo's learning apps")}</li><li>{OAT("Ad-free Trivia and unlimited LingoDex hearts")}</li><li>{plan === "plus" ? appMention(OAT("Unlimited fast translations in {_TRANSLATE_APP_}")) : appMention(OAT("{_TRANSLATE_APP_} uses the Free limits"))}</li></>}</ul>
        {plans[plan]?.features}
        {plans[plan]?.reason && <p className="lingop-pricing__reason">{plans[plan]?.reason}</p>}
        {!disabled && !membership?.scheduledTier && !membership?.cancelAtPeriodEnd && (plan === "free" ? !subscribed && !!onComplete : !current) && <button className="lingop-pricing__primary" type="button" disabled={busy || auth.signedInStatus === null || (plan !== "free" && (amount === undefined || (auth.signedInStatus === true && !membership)))} onClick={() => {
          if (plan === "free") onComplete?.();
          else if (subscribed && plan === "core" && tier === "plus") setConfirmDowngrade(true);
          else void act("checkout", plan);
        }}>{plan === "free" ? OAT("Continue with Free") : subscribed ? (plan === "plus" ? OAT("Upgrade to Plus") : OAT("Change to Core")) : plan === "core" ? OAT("Choose Core") : OAT("Choose Plus")}</button>}
      </article>;
    })}</div>
    {confirmDowngrade && <div className="lingop-pricing__message" role="alert"><h3>{OAT("Change to Core at your next renewal?")}</h3><p>{appMention(OAT("You keep Plus until then. Afterward, {_TRANSLATE_APP_} returns to Free limits."))}</p><button type="button" disabled={busy} onClick={() => void act("downgrade", "core")}>{OAT("Confirm change to Core")}</button> <button type="button" disabled={busy} onClick={() => setConfirmDowngrade(false)}>{OAT("Keep Plus")}</button></div>}
    <div className="lingop-pricing__toolbar"><label>{OAT("Currency")} <select aria-label={OAT("Currency")} value={currency} disabled={subscribed || busy || !catalog} onChange={e => setCurrency(e.target.value as CampLingoCurrency)}>{Array.from(new Set([...(catalog?.currencies ?? []), currency])).map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label></div>
    <div ref={messageRef}>{error && <div role="alert" className="lingop-pricing__message"><p>{errorText}</p><button type="button" disabled={busy} onClick={() => { setError(""); void Promise.all([catalog ? Promise.resolve() : requestCampLingoBilling<CampLingoCatalog>("catalog", { apiBaseUrl }).then(setCatalog), refresh()]).catch(e => setError(e.message)); }}>{OAT("Try again")}</button></div>}</div>
    <footer>{auth.signedInStatus && subscribed && <button type="button" disabled={busy} onClick={() => void act("portal")}>{OAT("Manage billing")}</button>}<p>{OAT("The final amount and any applicable tax are shown before you confirm payment.")}</p>{busy && <p role="status">{OAT("Opening secure billing…")}</p>}</footer>
  </section>;
}
