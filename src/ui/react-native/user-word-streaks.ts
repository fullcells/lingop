import type { WordStreaksLifecycle } from "../../react/user-word-streaks.js";
export { UserWordStreaksDataProvider, useUserWordStreaksData, useOptionalUserWordStreaksData } from "../../react/user-word-streaks.js";
export type { UserWordStreaksDataProviderProps, UserWordStreaksDataContextType, WordStreaksStorage, WordStreaksLifecycle } from "../../react/user-word-streaks.js";

/** Pass React Native's AppState; the app supplies its installed native modules. */
export function createNativeWordStreaksLifecycle(appState: {
  addEventListener(event: "change", listener: (state: string) => void): { remove(): void };
}): WordStreaksLifecycle {
  return {
    subscribe(listener) {
      const subscription = appState.addEventListener("change", state => listener(state === "active" ? "active" : "background"));
      return () => subscription.remove();
    },
  };
}
