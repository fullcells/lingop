import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  areWordStreaksDifferent,
  deleteWordStreaks,
  getSBUserWordStreaksForLang,
  setWordStreaksByDelta,
  setWordStreaksToMin1 as setWordStreaksForLangToMin1,
  setWordStreaksToValue,
  type SBUserWordStreaks,
  type UserWordStreaksByLang,
  upsertSBUserWordStreaksForLang,
} from "../../core/user-word-streaks.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike } from "../../core/supabase.js";

export type UserWordStreaksSupabaseClient = SupabaseClientLike;

export type UserWordStreaksDataContextType = {
  // USER WORD STREAKS (Supabase+LocalStorage versions together)
  // Future: Update var names to be ...WORDStreaks... as opposed to ...WordStreaks... // WORD Streaks updated to all be stored as UPPERCASE - 20260629
  userWordStreaks: UserWordStreaksByLang; // explicitly a useState
  ensureUserWordStreaksForLang: (lang: string) => Promise<void>;
  setUserWordStreaksByDelta: (
    lang: string,
    wordStreakDeltas: { word: string; streakDelta: number }[],
  ) => Promise<void>;
  setUserWordStreaksToValue: (
    lang: string,
    words: string[],
    streakValue: number,
  ) => Promise<void>;
  setUserWordStreaksToMin1: (lang: string, words: string[]) => Promise<string[]>;
  deleteUserWordStreaks: (lang: string, words: string[]) => Promise<void>;
  deleteAllUserWordStreaksForLang: (lang: string) => void;
  syncUserWordStreaks: (lang: string) => Promise<void>;
};

export type UserWordStreaksDataProviderProps = {
  children: ReactNode;
  focusLang: string | null;
  supabaseClient?: UserWordStreaksSupabaseClient | null;
  syncDelayMs?: number;
};

const UserWordStreaksDataContext =
  createContext<UserWordStreaksDataContextType | undefined>(undefined);

const LOCALSTORE_USER_VOCAB_STREAKS_PREFIX = "USER_VOCAB_STREAKS_"; // NOTE: Can change var name, but not value (for existing users) - 20260331.

function readLocalStoreUserWordStreaks(): UserWordStreaksByLang {
  if (typeof window === "undefined" || !window.localStorage) return {};

  const localStoreUserWordStreaks: UserWordStreaksByLang = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) ?? "";
    if (key.startsWith(LOCALSTORE_USER_VOCAB_STREAKS_PREFIX)) {
      const lang = key.replace(LOCALSTORE_USER_VOCAB_STREAKS_PREFIX, "");
      try {
        // try catch needed because localStorage.getItem can throw error
        const data = JSON.parse(localStorage.getItem(key) || "{}") as Record<
          string,
          number
        >;
        localStoreUserWordStreaks[lang] = data;
      } catch {
        // Ignore unreadable legacy localStorage entries.
      }
    }
  }

  return localStoreUserWordStreaks;
}

function writeLocalStoreUserWordStreaks(
  lang: string,
  userWordStreaks: UserWordStreaksByLang,
): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  const langStoreKey = LOCALSTORE_USER_VOCAB_STREAKS_PREFIX + lang;
  localStorage.setItem(langStoreKey, JSON.stringify(userWordStreaks[lang] ?? {}));
}

function removeLocalStoreUserWordStreaks(lang: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  const langStoreKey = LOCALSTORE_USER_VOCAB_STREAKS_PREFIX + lang;
  localStorage.removeItem(langStoreKey);
}

export function UserWordStreaksDataProvider({
  children,
  focusLang,
  supabaseClient,
  syncDelayMs = 30_000,
}: UserWordStreaksDataProviderProps) {
  const streaksSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  const [signedInStatus, setSignedInStatus] = useState<boolean | null>(null);
  const _SBUserWordStreaksByLangRef = useRef<Record<string, SBUserWordStreaks | null>>(
    {},
  ); // a null value indicates the lang was fetched, but there's no data
  const __initialSBUserWordStreaksPromisesByLangRef = useRef<
    Record<string, Promise<SBUserWordStreaks | null>>
  >({});

  const [userWordStreaks, setUserWordStreaks] =
    useState<UserWordStreaksByLang>({}); // userWordStreaks + _latestSBUserWordStreaks: if lang key is missing, then it hasn't been fetched. if it doesn't exist, the key will exist but with empty {} value.

  // - sync consts
  const _syncUserWordStreaksTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const cancelPendingSyncUserWordStreaks = useCallback((lang: string) => {
    if (_syncUserWordStreaksTimersRef.current[lang] !== undefined) {
      clearTimeout(_syncUserWordStreaksTimersRef.current[lang]);
      delete _syncUserWordStreaksTimersRef.current[lang];
    }
  }, []);

  const _userWordStreaksRef = useRef(userWordStreaks); // to ensure the latest version is used at sync
  useEffect(() => {
    _userWordStreaksRef.current = userWordStreaks;
  }, [userWordStreaks]);

  useEffect(() => {
    let isCurrent = true;
    setSignedInStatus(null);

    async function loadSignedInStatus() {
      if (!streaksSupabaseClient) {
        if (isCurrent) setSignedInStatus(false);
        return;
      }

      try {
        const result = await streaksSupabaseClient.auth?.getUser?.();
        const data = result?.data ?? { user: null };
        if (isCurrent) setSignedInStatus(!!data.user);
      } catch (error) {
        console.error("Error getting Supabase user:", error);
        if (isCurrent) setSignedInStatus(false);
      }
    }

    void loadSignedInStatus();

    return () => {
      isCurrent = false;
    };
  }, [streaksSupabaseClient]);

  useEffect(() => {
    _SBUserWordStreaksByLangRef.current = {};
    __initialSBUserWordStreaksPromisesByLangRef.current = {};
  }, [streaksSupabaseClient]);

  const __loadInitialSBUserWordStreaksForLang = useCallback(
    async (lang: string): Promise<SBUserWordStreaks | null> => {
      const promises = __initialSBUserWordStreaksPromisesByLangRef.current;
      if (promises[lang]) return promises[lang];

      if (!streaksSupabaseClient) return null;

      promises[lang] = getSBUserWordStreaksForLang({
        supabaseClient: streaksSupabaseClient,
        lang,
      });
      return promises[lang];
    },
    [streaksSupabaseClient],
  );

  const _getSBUserWordStreaksForLang = useCallback(
    async (lang: string): Promise<SBUserWordStreaks | null> => {
      // 1. Return FE data if it exists
      if (lang in _SBUserWordStreaksByLangRef.current) {
        return _SBUserWordStreaksByLangRef.current[lang] ?? null;
      }

      // 2. Continue If FE data doesn't exist: load initial data and remember it.
      const initialSBWordStreaksForLang =
        await __loadInitialSBUserWordStreaksForLang(lang);
      _SBUserWordStreaksByLangRef.current[lang] = initialSBWordStreaksForLang;
      return initialSBWordStreaksForLang;
    },
    [__loadInitialSBUserWordStreaksForLang],
  );

  const ensureUserWordStreaksForLang = useCallback(
    async (lang: string) => {
      // 1. Preload localStorage USER_VOCAB_STREAKS (for ALL LANGS)
      const localStoreUserWordStreaks = readLocalStoreUserWordStreaks();

      // 2A. If Not SignedIn; Set userWordStreaks as is. (On initial formation - doesn't need to be reset on each lang change)
      if (signedInStatus === false) {
        setUserWordStreaks((prv) => {
          if (Object.keys(prv).length === 0) {
            // If userWordStreaks has never been set, then set it - making sure it includes the current language.
            return {
              ...localStoreUserWordStreaks,
              [lang]: localStoreUserWordStreaks[lang] ?? {},
            };
          }

          // If userWordStreaks does exist, just not for the current language, then initialize for the current language (as empty).
          if (!prv[lang]) {
            return {
              ...prv,
              [lang]: localStoreUserWordStreaks[lang] ?? {},
            };
          }

          return prv;
        });
        return;
      }

      // 2B. If SignedIn:
      if (signedInStatus === true) {
        // i. Fetch SB for Lang
        const curSBUserWordStreaksRow = await _getSBUserWordStreaksForLang(lang);
        // ii.a. If SB for Lang Exists
        if (curSBUserWordStreaksRow) {
          setUserWordStreaks((prv) => ({
            ...prv,
            [lang]: curSBUserWordStreaksRow.word_streaks,
          }));
          return;
        }
        // ii.b. If SB for Lang Does NOT Exist
        // - .1 If LocalStore Doesn't Exist
        if (!localStoreUserWordStreaks[lang]) {
          setUserWordStreaks((prv) => ({ ...prv, [lang]: {} }));
          return;
        }
        // - .2 If LocalStore DOES Exist
        if (localStoreUserWordStreaks[lang]) {
          if (!streaksSupabaseClient) return;

          // - ..1. insert localizations to SB
          const newSBUserWordStreaksRow = await upsertSBUserWordStreaksForLang({
            supabaseClient: streaksSupabaseClient,
            lang,
            wordStreaks: localStoreUserWordStreaks[lang],
          });
          if (!newSBUserWordStreaksRow) return;

          // -- update RAM version of SB-UserWordStreaks
          _SBUserWordStreaksByLangRef.current[lang] = newSBUserWordStreaksRow;
          // - ..2. clear localStorage for lang
          removeLocalStoreUserWordStreaks(lang);
          // - ..3. set it
          setUserWordStreaks((prv) => ({
            ...prv,
            [lang]: localStoreUserWordStreaks[lang] ?? {},
          }));
        }
      }
    },
    [streaksSupabaseClient, signedInStatus, _getSBUserWordStreaksForLang],
  );

  const syncUserWordStreaks = useCallback(
    async (lang: string) => {
      // UNTESTED - 20260401 // Uses `_userWordStreaksRef.current` instead of `userWordStreaks:State` to ensure most recent data is used (i.e. avoid stale closure data from when timeout was created)
      if (!lang) return;
      if (!signedInStatus) return;
      if (!streaksSupabaseClient) return;

      // Clear any existing Request for syncUserWordStreaks (notably if this func is immediately-triggered externally)
      cancelPendingSyncUserWordStreaks(lang);

      if (!_userWordStreaksRef.current[lang]) return;
      if (_SBUserWordStreaksByLangRef.current[lang] === undefined) return; // Skip if SB not loaded yet. // Note: Possible for `_SBUserWordStreaksByLangRef.current[lang]` to be null (representing that a fetch was made, but there was no SBWordStreaksRow).

      // 1. Check if Different
      const sbUserWordStreaksForLang =
        _SBUserWordStreaksByLangRef.current[lang]?.word_streaks ?? {};
      const curUserWordStreaksForLang = _userWordStreaksRef.current[lang] ?? {};
      // - return if same
      if (!areWordStreaksDifferent(sbUserWordStreaksForLang, curUserWordStreaksForLang)) {
        return;
      }

      // 2. Upsert
      const updatedSBUserWordStreaksRow = await upsertSBUserWordStreaksForLang({
        supabaseClient: streaksSupabaseClient,
        lang,
        wordStreaks: curUserWordStreaksForLang,
      });
      if (!updatedSBUserWordStreaksRow) return;

      // - Update SB Ref
      _SBUserWordStreaksByLangRef.current[lang] = updatedSBUserWordStreaksRow;
    },
    [cancelPendingSyncUserWordStreaks, signedInStatus, streaksSupabaseClient],
  );

  // - Syncs on Close
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Note: As is, it's unlikely any of these will actually work.
    /* Future:
    - Abstract Diff Calc so it's not occupying time/code-space in syncUserWordStreaks.
    - Future Future:
      - Dedicated Internal API that wraps SB Call <- useable in navigator.sendBeacon
      - Reduce size of call to sync properly. Then use keepAlive (body must be < 64kb)
    - (Optional) Desktop: Unsaved Changes Alert, with Followup Central Toast that it's been Saved
    */
    const onPageHide = () => {
      if (!focusLang) return;
      void syncUserWordStreaks(focusLang);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [focusLang, syncUserWordStreaks]);

  // - Future: useEffect(()=>{ syncUserWordStreaks(PREVIOUS_focusLang) },[focusLang]); //

  // - On [focusLang, signedInStatus]: LOAD userWordStreaks.lang // UNTESTED - 20260401
  useEffect(() => {
    if (signedInStatus === null || !focusLang) return; // Notably is still retriggered upon new signout or new signin
    void ensureUserWordStreaksForLang(focusLang);
  }, [focusLang, signedInStatus, ensureUserWordStreaksForLang]);

  // - On [userWordStreaks] changes: Queue SYNC-UserWordStreaks // UNTESTED - 20260401
  useEffect(() => {
    if (!focusLang) return;
    if (!userWordStreaks[focusLang]) return;
    if (signedInStatus === null) return;
    if (
      signedInStatus === true &&
      _SBUserWordStreaksByLangRef.current[focusLang] === undefined
    ) {
      return;
    }

    // A. if notSignedIn: update LocalStorage.
    if (signedInStatus === false) {
      writeLocalStoreUserWordStreaks(focusLang, userWordStreaks);
      return;
    }

    // B. if signedIn: Create a Delayed Request to syncUserWordStreaks.
    const langToSync = focusLang;
    // - if a sync is already queued for this lang, do nothing.
    if (_syncUserWordStreaksTimersRef.current[langToSync] !== undefined) return;

    // - queue a delayed sync.
    _syncUserWordStreaksTimersRef.current[langToSync] = setTimeout(() => {
      // Clear the Timer Ref
      delete _syncUserWordStreaksTimersRef.current[langToSync];
      void syncUserWordStreaks(focusLang);
    }, syncDelayMs);
  }, [userWordStreaks, focusLang, signedInStatus, syncDelayMs, syncUserWordStreaks]);

  // - On Signout - Cancel any pending timers
  useEffect(() => {
    if (signedInStatus === false) {
      Object.keys(_syncUserWordStreaksTimersRef.current).forEach((lang) => {
        cancelPendingSyncUserWordStreaks(lang);
      });
    }
  }, [cancelPendingSyncUserWordStreaks, signedInStatus]);

  // --------------------------------------------------------------------
  // Change UserWordStreaks Functions:

  const setUserWordStreaksToValue = useCallback(
    async (lang: string, words: string[], streakValue: number) => {
      setUserWordStreaks((prv) => ({
        ...prv,
        [lang]: setWordStreaksToValue(prv[lang], words, streakValue),
      }));
    },
    [],
  );

  const setUserWordStreaksByDelta = useCallback(
    async (
      lang: string,
      wordStreakDeltas: { word: string; streakDelta: number }[],
    ) => {
      setUserWordStreaks((prv) => ({
        ...prv,
        [lang]: setWordStreaksByDelta(prv[lang], wordStreakDeltas),
      }));
    },
    [],
  );

  const deleteUserWordStreaks = useCallback(async (lang: string, words: string[]) => {
    setUserWordStreaks((prv) => {
      if (!prv[lang]) return prv;
      return {
        ...prv,
        [lang]: deleteWordStreaks(prv[lang], words),
      };
    });
  }, []);

  const deleteAllUserWordStreaksForLang = useCallback((lang: string) => {
    setUserWordStreaks((prv) => ({
      ...prv,
      [lang]: {},
    }));
  }, []);

  const setUserWordStreaksToMin1 = useCallback(
    async (lang: string, words: string[]): Promise<string[]> => {
      // Internally treats as case-insensitive // aka setNewUserWordStreaksTo1 (i.e. words that already exist aren't changed)
      const currentWordStreaks = _userWordStreaksRef.current[lang];
      if (!lang || !currentWordStreaks) return [];

      const { wordStreaks, newWords } = setWordStreaksForLangToMin1(
        currentWordStreaks,
        words,
      );
      if (newWords.length === 0) return [];

      setUserWordStreaks((prv) => ({
        ...prv,
        [lang]: wordStreaks,
      }));
      return newWords;
    },
    [],
  );

  const value = useMemo(
    () => ({
      userWordStreaks,
      ensureUserWordStreaksForLang,
      setUserWordStreaksByDelta,
      setUserWordStreaksToValue,
      setUserWordStreaksToMin1,
      deleteUserWordStreaks,
      deleteAllUserWordStreaksForLang,
      syncUserWordStreaks,
    }),
    [
      userWordStreaks,
      ensureUserWordStreaksForLang,
      setUserWordStreaksByDelta,
      setUserWordStreaksToValue,
      setUserWordStreaksToMin1,
      deleteUserWordStreaks,
      deleteAllUserWordStreaksForLang,
      syncUserWordStreaks,
    ],
  );

  return (
    <UserWordStreaksDataContext.Provider value={value}>
      {children}
    </UserWordStreaksDataContext.Provider>
  );
}

export function useUserWordStreaksData() {
  const context = useContext(UserWordStreaksDataContext);
  if (context === undefined) {
    throw new Error("This use... function must be used within its related ....Provider.");
  }
  return context;
}
