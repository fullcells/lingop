"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createWordStreaksStore, type WordStreaksStorage, type WordStreaksLifecycle } from "../core/user-word-streaks-store.js";
import { createWordStreaksRemote } from "../core/user-word-streaks-remote.js";
import type { SupabaseClientLike } from "../core/supabase.js";
import { useOptionalLingopClientData } from "./lingop-client-data-provider.js";
import { useSupabaseSignedInStatus } from "./supabase-auth.js";
export type { WordStreaksStorage, WordStreaksLifecycle } from "../core/user-word-streaks-store.js";
export type { UserWordStreaksByLang, WordStreaksForLang } from "../core/user-word-streaks.js";
export type UserWordStreaksSupabaseClient = SupabaseClientLike;
type Store = ReturnType<typeof createWordStreaksStore>;
export type UserWordStreaksDataContextType = Pick<Store,
  "ensureUserWordStreaksForLang" | "setUserWordStreaksByDelta" | "setUserWordStreaksToValue" |
  "setUserWordStreaksToMin1" | "deleteUserWordStreaks" | "deleteAllUserWordStreaksForLang" | "syncUserWordStreaks"
> & ReturnType<Store["getSnapshot"]>;
export type UserWordStreaksDataProviderProps = {
  children: ReactNode;
  focusLang: string | null;
  storage: WordStreaksStorage;
  lifecycle?: WordStreaksLifecycle;
  /** Isolate different backends/apps sharing the same storage. Defaults to the Supabase URL. */
  storageNamespace?: string;
  supabaseClient?: UserWordStreaksSupabaseClient | null;
  syncDelayMs?: number;
  onError?: (error: Error) => void;
};
const Context = createContext<UserWordStreaksDataContextType | undefined>(undefined);

export function UserWordStreaksDataProvider({ children, focusLang, storage, lifecycle, storageNamespace, supabaseClient, syncDelayMs = 30_000, onError }: UserWordStreaksDataProviderProps) {
  const provided = useOptionalLingopClientData();
  const client = supabaseClient !== undefined ? supabaseClient : provided?.supabaseClient;
  const { signedInStatus, supabaseUserID, authChangeCount } = useSupabaseSignedInStatus(client);
  const ready = signedInStatus !== null && (signedInStatus === false || !!supabaseUserID);
  const userID = signedInStatus === true ? supabaseUserID : null;
  const namespace = storageNamespace ?? (client as { supabaseUrl?: string } | undefined)?.supabaseUrl ?? "default";
  const store = useMemo(() => createWordStreaksStore({
    storage, namespace, userID, syncDelayMs,
    ...(client && userID ? { remote: createWordStreaksRemote(client, userID) } : {}),
    ...(onError ? { onError } : {}),
  }), [storage, namespace, userID, client, syncDelayMs, onError]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (!ready) return;
    store.start();
    return () => store.stop();
  }, [store, ready]);
  useEffect(() => {
    if (ready && focusLang) void store.ensureUserWordStreaksForLang(focusLang).catch(() => {});
  }, [store, ready, focusLang, authChangeCount]);
  useEffect(() => {
    if (!ready) return;
    return lifecycle?.subscribe(() => { void store.syncAll().catch(() => {}); });
  }, [store, ready, lifecycle]);
  const value = useMemo(() => ({
    ...snapshot,
    ensureUserWordStreaksForLang: store.ensureUserWordStreaksForLang,
    setUserWordStreaksByDelta: store.setUserWordStreaksByDelta,
    setUserWordStreaksToValue: store.setUserWordStreaksToValue,
    setUserWordStreaksToMin1: store.setUserWordStreaksToMin1,
    deleteUserWordStreaks: store.deleteUserWordStreaks,
    deleteAllUserWordStreaksForLang: store.deleteAllUserWordStreaksForLang,
    syncUserWordStreaks: store.syncUserWordStreaks,
  }), [snapshot, store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOptionalUserWordStreaksData() { return useContext(Context); }
export function useUserWordStreaksData(): UserWordStreaksDataContextType {
  const value = useOptionalUserWordStreaksData();
  if (!value) throw new Error("useUserWordStreaksData must be used within UserWordStreaksDataProvider.");
  return value;
}
