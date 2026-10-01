import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  LingopClientDataProvider,
  useLingopClientData,
  useSupabaseSignedInStatus,
  type LingopClientDataContextType,
  type SupabaseSignedInStatusState,
} from "./index.js";
import {
  LingopClientDataProvider as LegacyProvider,
  useLingopClientData as useLegacyClient,
} from "../ui/next/lingop-client-data-provider.js";
import { useSupabaseSignedInStatus as useLegacyAuth } from "../ui/next/supabase-auth.js";

type User = { id: string; email: string };
type AuthListener = (event: string, session: { user: User } | null) => void;
function makeSupabase(user: User | null = null) {
  const listeners = new Set<AuthListener>();
  let currentUser = user;
  let product: string | null = "pro";
  const client = {
    from: vi.fn(() => ({ select: () => ({ eq: async () => ({
      data: [{ enabled_sub_prod: product }], error: null,
    }) }) })),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentUser } })),
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      }),
    },
  };
  return {
    client, listeners,
    setProduct(value: string | null) { product = value; },
    emit(event: string, next: User | null) {
      currentUser = next;
      for (const listener of listeners) listener(event, next ? { user: next } : null);
    },
  };
}
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const error = console.error;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) error(...args);
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  vi.restoreAllMocks();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});

it("shares the legacy context and preserves client caches when voice policy changes", async () => {
  expect(LegacyProvider).toBe(LingopClientDataProvider);
  expect(useLegacyAuth).toBe(useSupabaseSignedInStatus);
  let context!: LingopClientDataContextType;
  function Consumer() {
    context = useLingopClientData();
    expect(useLegacyClient()).toBe(context);
    return null;
  }
  const element = (profile: "NONE" | "ALL", staging = false) =>
    createElement(LingopClientDataProvider, {
      apiVoiceAccessProfile: profile,
      useStagingBackend: staging,
      children: createElement(Consumer),
    });
  await act(async () => { tree = create(element("NONE")); });
  const client = context.lingopClient;
  await act(async () => tree!.update(element("ALL")));
  expect(context.apiVoiceAccessProfile).toBe("ALL");
  expect(context.lingopClient).toBe(client);
  await act(async () => tree!.update(element("ALL", true)));
  expect(context.lingopClient).not.toBe(client);
});

it("observes provider account and entitlement changes without browser globals", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const sb = makeSupabase({ id: "user-1", email: "learner@example.test" });
  let state!: SupabaseSignedInStatusState;
  function Consumer() { state = useSupabaseSignedInStatus(); return null; }
  await act(async () => { tree = create(createElement(LingopClientDataProvider, {
    supabaseClient: sb.client, children: createElement(Consumer),
  })); });
  expect(state).toMatchObject({ signedInStatus: true, supabaseUserID: "user-1", enabledSubProd: "pro" });
  sb.setProduct("family");
  await act(async () => { expect(await state.refreshEnabledSubProd()).toBe("family"); });
  expect(state.enabledSubProd).toBe("family");
  await act(async () => sb.emit("SIGNED_OUT", null));
  expect(state).toMatchObject({ signedInStatus: false, supabaseUserID: null, userEmail: null, enabledSubProd: null });
});

it("supports standalone auth, client replacement, explicit null, and subscription cleanup", async () => {
  const first = makeSupabase();
  const second = makeSupabase({ id: "user-2", email: "second@example.test" });
  let state!: SupabaseSignedInStatusState;
  function Consumer({ client }: { client: unknown }) { state = useSupabaseSignedInStatus(client); return null; }
  await act(async () => { tree = create(createElement(Consumer, { client: first.client })); });
  expect(first.listeners.size).toBe(1);
  await act(async () => first.emit("SIGNED_IN", { id: "user-1", email: "first@example.test" }));
  expect(state).toMatchObject({ signedInStatus: true, supabaseUserID: "user-1", authChangeCount: 1 });
  expect(state.enabledSubProd).toBeUndefined();
  await act(async () => tree!.update(createElement(Consumer, { client: second.client })));
  expect(first.listeners.size).toBe(0);
  expect(state.supabaseUserID).toBe("user-2");
  await act(async () => tree!.update(createElement(Consumer, { client: null })));
  expect(second.listeners.size).toBe(0);
  expect(state.signedInStatus).toBe(false);
  await act(async () => tree!.update(createElement(Consumer, { client: first.client })));
  await act(async () => tree!.unmount());
  tree = undefined;
  expect(first.listeners.size).toBe(0);
});

it("ignores a late initial auth lookup after a newer sign-in event", async () => {
  const sb = makeSupabase();
  let resolve!: (value: { data: { user: null } }) => void;
  sb.client.auth.getUser.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  let state!: SupabaseSignedInStatusState;
  function Consumer() { state = useSupabaseSignedInStatus(sb.client); return null; }
  await act(async () => { tree = create(createElement(Consumer)); });
  await act(async () => sb.emit("SIGNED_IN", { id: "current", email: "current@example.test" }));
  await act(async () => resolve({ data: { user: null } }));
  expect(state.supabaseUserID).toBe("current");
  expect(state.signedInStatus).toBe(true);
});
