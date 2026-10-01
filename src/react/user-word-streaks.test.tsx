import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { UserWordStreaksDataProvider, useUserWordStreaksData, type UserWordStreaksDataContextType, type WordStreaksStorage } from "./user-word-streaks.js";
import { useUserWordStreaksData as useLegacy } from "../ui/next/user-word-streaks.js";
import { createNativeWordStreaksLifecycle } from "../ui/react-native/user-word-streaks.js";
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const error = console.error;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) error(...args);
  });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.restoreAllMocks(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
it("shares the Next context in native React and removes its app-state listener on unmount", async () => {
  const values = new Map<string, string>();
  const storage: WordStreaksStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
  let notify!: (state: string) => void;
  const remove = vi.fn();
  const lifecycle = createNativeWordStreaksLifecycle({ addEventListener(_event, listener) { notify = listener; return { remove }; } });
  let state!: UserWordStreaksDataContextType;
  function Consumer() { state = useUserWordStreaksData(); expect(useLegacy()).toBe(state); return null; }
  await act(async () => { tree = create(createElement(UserWordStreaksDataProvider, {
    storage, lifecycle, supabaseClient: null, focusLang: "ja", children: createElement(Consumer),
  })); });
  await act(async () => { await state.setUserWordStreaksToValue("ja", ["cat"], 3); });
  expect(state.userWordStreaks.ja).toEqual({ CAT: 3 });
  await act(async () => { notify("background"); });
  await act(async () => { notify("active"); });
  await act(async () => tree.unmount());
  expect(remove).toHaveBeenCalledOnce();
});
