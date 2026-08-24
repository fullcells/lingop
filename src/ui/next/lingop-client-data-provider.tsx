"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  createLingoDataClient,
  type CreateLingoDataClientOptions,
  type LingoDataClient,
  type SupabaseLingoDataClient,
} from "../../core/lingo-data-client.js";
import type { APIVoiceAccessProfile } from "./speech-synth-tts.js";

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
   * defaults to browser-only speech and does not infer subscriptions or hosts.
   */
  apiVoiceAccessProfile?: APIVoiceAccessProfile;
};

const LingopClientDataContext = createContext<
  LingopClientDataContextType | undefined
>(undefined);

/**
 * Owns one long-lived LingoDataClient for a React subtree.
 *
 * Consumers configure their existing browser Supabase client and backend
 * environment once. Lingop UI beneath this provider can then share the same
 * client, including its in-memory annotation and translation caches.
 */
export function LingopClientDataProvider({
  apiVoiceAccessProfile = "NONE",
  children,
  supabaseClient,
  useStagingBackend = false,
}: LingopClientDataProviderProps) {
  const value = useMemo<LingopClientDataContextType>(() => {
    const lingopClient = createLingoDataClient({
      ...(supabaseClient ? { supabaseClient } : {}),
      useStagingBackend,
    });
    return {
      apiVoiceAccessProfile,
      lingopClient,
      supabaseClient,
      useStagingBackend,
    };
  }, [apiVoiceAccessProfile, supabaseClient, useStagingBackend]);

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
