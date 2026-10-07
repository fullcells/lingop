"use client";

import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { asSupabaseRuntimeClient } from "../core/supabase.js";
import { requestCampLingoBilling } from "../core/camp-lingo-billing.js";
import {
  createLingoDataClient,
  type CreateLingoDataClientOptions,
  type LingoDataClient,
  type SupabaseLingoDataClient,
} from "../core/lingo-data-client.js";
import type { APIVoiceAccessProfile } from "../speech/shared.js";

export type LingopClientDataContextType = {
  lingopClient: LingoDataClient;
  supabaseClient: SupabaseLingoDataClient | undefined;
  useStagingBackend: boolean;
  /** Consumer-owned entitlement policy for cloud speech voices. */
  apiVoiceAccessProfile: APIVoiceAccessProfile;
};

export type LingopClientDataProviderProps = CreateLingoDataClientOptions & {
  children: ReactNode;
  /**
   * Consumers determine this from their own site/account policy. Lingop
   * defaults to device/browser-only speech and does not infer subscriptions or hosts.
   */
  apiVoiceAccessProfile?: APIVoiceAccessProfile;
  /** Central billing service; override for sandbox/local testing. */
  billingApiBaseUrl?: string;
};

const LingopClientDataContext = createContext<
  LingopClientDataContextType | undefined
>(undefined);

/**
 * Owns one long-lived LingoDataClient for a React subtree.
 *
 * Consumers configure their existing platform-configured Supabase client and backend
 * environment once. Lingop UI beneath this provider can then share the same
 * client, including its in-memory annotation and translation caches.
 */
export function LingopClientDataProvider({
  apiVoiceAccessProfile = "NONE",
  billingApiBaseUrl = "https://camplingo.com",
  children,
  supabaseClient,
  useStagingBackend = false,
}: LingopClientDataProviderProps) {
  const lingopClient = useMemo(
    () => createLingoDataClient({
      ...(supabaseClient ? { supabaseClient } : {}),
      useStagingBackend,
    }),
    [supabaseClient, useStagingBackend],
  );
  useEffect(() => {
    if (typeof window === "undefined" || new URL(window.location.href).searchParams.get("billing") !== "return") return;
    let canceled = false;
    async function reconcileReturn() {
      try {
        const session = await asSupabaseRuntimeClient(supabaseClient)?.auth?.getSession?.();
        if (!session?.data.session?.access_token || canceled) return;
        await requestCampLingoBilling("membership", { apiBaseUrl: billingApiBaseUrl, accessToken: session.data.session.access_token });
        if (canceled) return;
        await lingopClient.refreshEnabledSubProd();
        const url = new URL(window.location.href); url.searchParams.delete("billing");
        window.history.replaceState(window.history.state, "", url);
      } catch { /* Keep the marker: focus or the pricing screen can retry. */ }
    }
    void reconcileReturn();
    window.addEventListener("focus", reconcileReturn);
    return () => { canceled = true; window.removeEventListener("focus", reconcileReturn); };
  }, [billingApiBaseUrl, lingopClient, supabaseClient]);

  const value = useMemo<LingopClientDataContextType>(() => {
    return {
      apiVoiceAccessProfile,
      lingopClient,
      supabaseClient,
      useStagingBackend,
    };
  }, [apiVoiceAccessProfile, lingopClient, supabaseClient, useStagingBackend]);

  return (
    <LingopClientDataContext.Provider value={value}>
      {children}
    </LingopClientDataContext.Provider>
  );
}

export function useLingopClientData(): LingopClientDataContextType {
  const context = useContext(LingopClientDataContext);
  if (!context) {
    throw new Error(
      "useLingopClientData must be used within a LingopClientDataProvider",
    );
  }
  return context;
}

// Internal migration helper. Package UI can retain explicit-client fallbacks
// while consumers move their shared configuration to the provider.
export function useOptionalLingopClientData():
  | LingopClientDataContextType
  | undefined {
  return useContext(LingopClientDataContext);
}

/** Internal bridge for UI props retained during provider migration. */
export function useLingopClientDataOrCreate({
  supabaseClient,
  useStagingBackend,
}: CreateLingoDataClientOptions = {}): LingoDataClient {
  const providedClientData = useOptionalLingopClientData();
  const hasExplicitConfiguration =
    supabaseClient !== undefined || useStagingBackend !== undefined;
  const standaloneClient = useMemo(
    () =>
      hasExplicitConfiguration || !providedClientData
        ? createLingoDataClient({
            ...(supabaseClient ? { supabaseClient } : {}),
            ...(useStagingBackend !== undefined ? { useStagingBackend } : {}),
          })
        : undefined,
    [
      hasExplicitConfiguration,
      providedClientData,
      supabaseClient,
      useStagingBackend,
    ],
  );

  if (!hasExplicitConfiguration && providedClientData) {
    return providedClientData.lingopClient;
  }
  // A standalone client always exists when there is no usable provider value.
  return standaloneClient as LingoDataClient;
}
