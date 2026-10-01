"use client";

import { UserWordStreaksDataProvider as SharedProvider, type UserWordStreaksDataProviderProps as SharedProps, type WordStreaksStorage, type WordStreaksLifecycle } from "../../react/user-word-streaks.js";
export { useUserWordStreaksData, useOptionalUserWordStreaksData } from "../../react/user-word-streaks.js";
export type { UserWordStreaksDataContextType, UserWordStreaksSupabaseClient } from "../../react/user-word-streaks.js";
export type UserWordStreaksDataProviderProps = Omit<SharedProps, "storage"> & { storage?: WordStreaksStorage };
const browserStorage: WordStreaksStorage = {
  async getItem(key) { return window.localStorage.getItem(key); },
  async setItem(key, value) { window.localStorage.setItem(key, value); },
  async removeItem(key) { window.localStorage.removeItem(key); },
};
const browserLifecycle: WordStreaksLifecycle = {
  subscribe(listener) {
    if (typeof window === "undefined") return () => {};
    const hidden = () => listener("background");
    const visibility = () => listener(document.visibilityState === "hidden" ? "background" : "active");
    const online = () => listener("active");
    window.addEventListener("pagehide", hidden);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", hidden);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  },
};
/** Browser defaults; the shared provider and context also serve React Native. */
export function UserWordStreaksDataProvider({ storage = browserStorage, lifecycle = browserLifecycle, ...props }: UserWordStreaksDataProviderProps) {
  return <SharedProvider {...props} storage={storage} lifecycle={lifecycle} />;
}
