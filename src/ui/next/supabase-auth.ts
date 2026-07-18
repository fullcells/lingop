import { useEffect, useState } from "react";

import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
} from "../../core/supabase.js";

export type SupabaseSignedInStatus = boolean | null;

export type SupabaseSignedInStatusState = {
  signedInStatus: SupabaseSignedInStatus;
  authChangeCount: number;
};

export function useSupabaseSignedInStatus(
  supabaseClient: SupabaseClientLike | null | undefined,
): SupabaseSignedInStatusState {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  const [signedInStatus, setSignedInStatus] =
    useState<SupabaseSignedInStatus>(null);
  const [authChangeCount, setAuthChangeCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setSignedInStatus(null);

    async function loadSignedInStatus() {
      if (!runtimeSupabaseClient) {
        if (isCurrent) setSignedInStatus(false);
        return;
      }

      try {
        const result = await runtimeSupabaseClient.auth?.getUser?.();
        const data = result?.data ?? { user: null };
        if (isCurrent) setSignedInStatus(!!data.user);
      } catch (error) {
        console.error("Error getting Supabase user:", error);
        if (isCurrent) setSignedInStatus(false);
      }
    }

    void loadSignedInStatus();
    const authListener = runtimeSupabaseClient?.auth?.onAuthStateChange?.(
      (_event, session) => {
        if (!isCurrent) return;
        setSignedInStatus(!!session?.user);
        setAuthChangeCount((count) => count + 1);
      },
    );

    return () => {
      isCurrent = false;
      authListener?.data?.subscription?.unsubscribe?.();
      authListener?.subscription?.unsubscribe?.();
    };
  }, [runtimeSupabaseClient]);

  return { signedInStatus, authChangeCount };
}
