"use client";

import { useCallback, useEffect, useState } from "react";

import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
} from "../../core/supabase.js";
import { useOptionalLingopClientData } from "./lingop-client-data-provider.js";

export type SupabaseSignedInStatus = boolean | null;

export type SupabaseSignedInStatusState = {
  signedInStatus: SupabaseSignedInStatus;
  supabaseUserID: string | null;
  userEmail: string | null;
  authChangeCount: number;
  /** Current users_info.enabled_sub_prod value; undefined until its first lookup completes. */
  enabledSubProd: string | null | undefined;
  /** Reloads users_info.enabled_sub_prod for the current provider user. */
  refreshEnabledSubProd: () => Promise<string | null>;
};

export function useSupabaseSignedInStatus(
  supabaseClient?: SupabaseClientLike | null,
): SupabaseSignedInStatusState {
  const providedClientData = useOptionalLingopClientData();
  // An explicit null deliberately disables the provider's authenticated client.
  const resolvedSupabaseClient =
    supabaseClient !== undefined
      ? supabaseClient
      : providedClientData?.supabaseClient;
  const runtimeSupabaseClient = asSupabaseRuntimeClient(resolvedSupabaseClient);
  // Entitlement state is owned by the provider's long-lived client. An explicit
  // Supabase client continues to support auth-only use outside the provider.
  const lingopClient =
    supabaseClient === undefined ? providedClientData?.lingopClient : undefined;
  const [signedInStatus, setSignedInStatus] =
    useState<SupabaseSignedInStatus>(null);
  const [supabaseUserID, setSupabaseUserID] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChangeCount, setAuthChangeCount] = useState(0);
  const [enabledSubProd, setEnabledSubProd] = useState<
    string | null | undefined
  >(lingopClient?.enabledSubProd);

  const refreshEnabledSubProd = useCallback(async (): Promise<string | null> => {
    if (!lingopClient) return null;
    return lingopClient.refreshEnabledSubProd();
  }, [lingopClient]);

  useEffect(() => {
    let isCurrent = true;
    setSignedInStatus(null);
    setSupabaseUserID(null);
    setUserEmail(null);

    function setAuthUser(user: { id: string; email?: string | null } | null | undefined) {
      setSignedInStatus(!!user);
      setSupabaseUserID(user?.id ?? null);
      setUserEmail(user?.email ?? null);
    }

    async function loadSignedInStatus() {
      if (!runtimeSupabaseClient) {
        if (isCurrent) setAuthUser(null);
        return;
      }

      try {
        const result = await runtimeSupabaseClient.auth?.getUser?.();
        const data = result?.data ?? { user: null };
        if (isCurrent) setAuthUser(data.user);
      } catch (error) {
        console.error("Error getting Supabase user:", error);
        if (isCurrent) setAuthUser(null);
      }
    }

    void loadSignedInStatus();
    const authListener = runtimeSupabaseClient?.auth?.onAuthStateChange?.(
      (_event, session) => {
        if (!isCurrent) return;
        setAuthUser(session?.user);
        setAuthChangeCount((count) => count + 1);
      },
    );

    return () => {
      isCurrent = false;
      authListener?.data?.subscription?.unsubscribe?.();
      authListener?.subscription?.unsubscribe?.();
    };
  }, [runtimeSupabaseClient]);

  useEffect(() => {
    if (!lingopClient) {
      setEnabledSubProd(undefined);
      return;
    }
    const subscribedClient = lingopClient;

    function syncEnabledSubProd() {
      setEnabledSubProd(subscribedClient.enabledSubProd);
    }

    syncEnabledSubProd();
    return subscribedClient.subscribeAuthState(syncEnabledSubProd);
  }, [lingopClient]);

  useEffect(() => {
    if (lingopClient && signedInStatus) {
      void lingopClient.refreshEnabledSubProd();
    }
  }, [authChangeCount, lingopClient, signedInStatus, supabaseUserID]);

  return {
    signedInStatus,
    supabaseUserID,
    userEmail,
    authChangeCount,
    enabledSubProd,
    refreshEnabledSubProd,
  };
}
