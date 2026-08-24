"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SpellingSystem } from "../../core/language/spelling-systems.js";
import { ilike } from "../../core/misc.js";
import { useOAT } from "../../oat/react/index.js";
import {
  isTripleDisplayState,
  type TripleDisplayState,
} from "../types.js";

export type SpellingSystemInfo = {
  label: string;
  shortLabel?: string;
  tagline?: string;
};

export type UserLingoPrefsDefaults = {
  showMainTextReadingGuide: boolean;
  fadeNonCoreWords: boolean;
  showNonCoreSpelling: TripleDisplayState;
  showNonCoreGlossEmoji: TripleDisplayState;
  showNonCoreGlossText: TripleDisplayState;
  prefShowSpelling: TripleDisplayState;
  prefShowMainText: boolean;
  prefShowGlossText: TripleDisplayState;
  prefShowGlossEmoji: TripleDisplayState;
};

export const DEFAULT_USER_LINGO_PREFS: UserLingoPrefsDefaults = {
  showMainTextReadingGuide: true,
  fadeNonCoreWords: false,
  showNonCoreSpelling: "ALWAYS",
  showNonCoreGlossEmoji: "NEVER",
  showNonCoreGlossText: "NEVER",
  prefShowSpelling: "ALWAYS",
  prefShowMainText: true,
  prefShowGlossText: "ON_HINT",
  prefShowGlossEmoji: "ON_HINT",
};

export type UserLingoPrefsContextType = {
  // Spelling System
  userPreferredSpellingSystems: Record<string, SpellingSystem>;
  setUserPreferredSpellingSystem: (input: {
    lang: string;
    spellingSystem: SpellingSystem;
  }) => void;
  /** @deprecated Use setUserPreferredSpellingSystem. */
  setUserPrefferedSpellingSystem: (input: {
    lang: string;
    spellingSystem: SpellingSystem;
  }) => void;
  spellingSystemsInfo: Record<string, SpellingSystemInfo>;
  showMainTextReadingGuide: boolean;
  setShowMainTextReadingGuide: (show: boolean) => void;

  // NonCore
  fadeNonCoreWords: boolean;
  setFadeNonCoreWords: (fade: boolean) => void;
  showNonCoreSpelling: TripleDisplayState;
  setShowNonCoreSpelling: (value: TripleDisplayState) => void;
  showNonCoreGlossEmoji: TripleDisplayState;
  setShowNonCoreGlossEmoji: (value: TripleDisplayState) => void;
  showNonCoreGlossText: TripleDisplayState;
  setShowNonCoreGlossText: (value: TripleDisplayState) => void;

  // General Language/Annotation Display Prefs
  prefShowSpelling: TripleDisplayState;
  setPrefShowSpelling: (value: TripleDisplayState) => void;
  prefShowMainText: boolean;
  setPrefShowMainText: (value: boolean) => void;
  prefShowGlossText: TripleDisplayState;
  setPrefShowGlossText: (value: TripleDisplayState) => void;
  prefShowGlossEmoji: TripleDisplayState;
  setPrefShowGlossEmoji: (value: TripleDisplayState) => void;
};

export type UserLingoPrefsDataProviderProps = {
  children: ReactNode;
  /**
   * The consumer owns site-specific defaults. Stored user preferences take
   * precedence over these values.
   */
  defaultPrefs?: Partial<UserLingoPrefsDefaults>;
  /**
   * Used only to preserve the invariant between English Camp Lingo
   * diacritics, spelling visibility, and main-text visibility.
   */
  focusLang?: string | null;
};

const UserLingoPrefsContext = createContext<
  UserLingoPrefsContextType | undefined
>(undefined);

export type UserTopicCoverage = {
  topic: string;
  covered: number;
  size: number;
};

// LOCALSTORE VARS
// - SPELLING SYSTEM
const LOCALSTORE_PREF_SPELLING_SYSTEMS = "UI_PREF_SPELLING_SYSTEMS";
// - NONCORE
const LOCALSTORE_PREF_FADE_NONCORE_WORDS = "UI_PREF_FADE_NONCORE_WORDS";
const LOCALSTORE_PREF_NONCORE_SPELLING = "UI_PREF_NONCORE_SPELLING";
const LOCALSTORE_PREF_NONCORE_GLOSS_EMOJI = "UI_PREF_NONCORE_GLOSS_EMOJI";
const LOCALSTORE_PREF_NONCORE_GLOSS_TEXT = "UI_PREF_NONCORE_GLOSS_TEXT";
// - GENERAL DISPLAY PREFS
const LOCALSTORE_PREF_SHOW_MAIN_TEXT_READING_GUIDE =
  "UI_PREF_SHOW_MAIN_TEXT_READING_GUIDE";
const LOCALSTORE_PREF_SHOW_SPELLING = "UI_PREF_SHOW_SPELLING";
const LOCALSTORE_PREF_SHOW_MAIN_TEXT = "UI_PREF_SHOW_MAIN_TEXT";
const LOCALSTORE_PREF_SHOW_GLOSS_EMOJI = "UI_PREF_SHOW_GLOSS_EMOJI";
const LOCALSTORE_PREF_SHOW_GLOSS_TEXT = "UI_PREF_SHOW_GLOSS_TEXT";

function readStorage(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences remain usable in memory when browser storage is unavailable.
  }
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  const stored = readStorage(key);
  if (stored === null) return fallback;
  return ilike(stored, "true");
}

function readTripleDisplayPreference(
  key: string,
  fallback: TripleDisplayState,
): TripleDisplayState {
  const stored = readStorage(key);
  return isTripleDisplayState(stored) ? stored : fallback;
}

export function UserLingoPrefsDataProvider({
  children,
  defaultPrefs,
  focusLang,
}: UserLingoPrefsDataProviderProps) {
  const { OAT } = useOAT();
  const resolvedDefaults = {
    ...DEFAULT_USER_LINGO_PREFS,
    ...defaultPrefs,
  } satisfies UserLingoPrefsDefaults;

  const [userPreferredSpellingSystems, setUserPreferredSpellingSystems] =
    useState<Record<string, SpellingSystem>>({}); // localStorage is browser-only, so it is set in useEffect.
  const [showMainTextReadingGuide, setShowMainTextReadingGuideState] =
    useState(resolvedDefaults.showMainTextReadingGuide);
  const [fadeNonCoreWords, setFadeNonCoreWordsState] = useState(
    resolvedDefaults.fadeNonCoreWords,
  );
  const [showNonCoreSpelling, setShowNonCoreSpellingState] = useState(
    resolvedDefaults.showNonCoreSpelling,
  );
  const [showNonCoreGlossEmoji, setShowNonCoreGlossEmojiState] = useState(
    resolvedDefaults.showNonCoreGlossEmoji,
  );
  const [showNonCoreGlossText, setShowNonCoreGlossTextState] = useState(
    resolvedDefaults.showNonCoreGlossText,
  );

  const [prefShowSpelling, setPrefShowSpellingState] = useState(
    resolvedDefaults.prefShowSpelling,
  );
  const [prefShowMainText, setPrefShowMainTextState] = useState(
    resolvedDefaults.prefShowMainText,
  );
  const [prefShowGlossText, setPrefShowGlossTextState] = useState(
    resolvedDefaults.prefShowGlossText,
  );
  const [prefShowGlossEmoji, setPrefShowGlossEmojiState] = useState(
    resolvedDefaults.prefShowGlossEmoji,
  );

  // ------------------------------------------------
  // SPELLING SYSTEMS
  const spellingSystemsInfo = useMemo<Record<string, SpellingSystemInfo>>(
    () => ({
      // JA
      [SpellingSystem.JA_ROMAJI]: {
        label: "romaji (ローマ字)",
        tagline: OAT("For Beginners"),
      },
      [SpellingSystem.JA_HIRAGANA]: {
        label: "ひらがな (Hiragana)",
        tagline: OAT("Official Spelling"),
      },
      [SpellingSystem.JA_KATAKANA]: {
        label: "カタカナ (Katakana)",
        tagline: OAT("For Practice"),
      },
      // YUE
      [SpellingSystem.YUE_JYUTPING]: {
        label: "jyut⁶ ping³ (粵拼)",
        tagline: OAT("Popular Spelling"),
      },
      [SpellingSystem.YUE_JYUTPING_DIACRITICS_TZW]: {
        label: "jyu̱t ping (粵拼) – Ta̖amZíWa̖ng Diacritics (談梓泓分音符號)",
        shortLabel: "jyu̱t ping",
        tagline: OAT("Popular Spelling with diacritics"),
      },
      [SpellingSystem.YUE_SLWONG_ROMAN_DIACRITICS]: {
        label:
          "ˌwong ¯sek ˌling (S. L. Wong / 黃錫凌) – Romanization + Diacritics",
        shortLabel: "S. L. Wong",
        tagline: OAT("Designed for English speakers"),
      },
      [SpellingSystem.YUE_IPA]: {
        label: "IPA",
        tagline: OAT("International Phonetic Alphabet"),
      },
      [SpellingSystem.YUE_IPA_SLWONG_DIACRITCS]: {
        label: "IPA - S. L. Wong Diacritics",
        tagline: OAT("International Phonetic Alphabet"),
      },
      [SpellingSystem.YUE_IPA_TONE_NUMBERS]: {
        label: "IPA - " + OAT("Tone Numbers"),
        tagline: OAT("International Phonetic Alphabet"),
      },
      [SpellingSystem.YUE_YALE]: {
        label: "yèh lóuh (Yale / 耶魯拼法)",
        tagline: OAT("Designed for English speakers"),
      },
      // CMN
      [SpellingSystem.CMN_PINYIN]: {
        label: "hàn yǔ pīn yīn (漢語拼音)",
      },
      [SpellingSystem.CMN_BOPOMOFO]: {
        label: "ㄅㄆㄇㄈ (Bopomofo) (注音符號/Zhuyin)",
      },
      // EN
      [SpellingSystem.EN_ARPABET_CMU]: {
        label: "ARPAbet",
        tagline: OAT("For Advanced Users"),
      },
      [SpellingSystem.EN_IPA]: {
        label: "IPA",
        tagline: OAT("International Phonetic Alphabet"),
      },
      [SpellingSystem.EN_WIKI]: {
        label: "English Wikipedia Style",
        shortLabel: "Wiki",
        tagline: OAT("For Beginners"),
      },
      [SpellingSystem.EN_CL_DIACRITICS]: {
        label: "Camp Lingo Diacritics - U.S. English 🇺🇸",
        shortLabel: "Camp Lingo Ǖ.S.",
        tagline: OAT("For Beginners"),
      },
      [SpellingSystem.EN_CL_DIACRITICS_BRE]: {
        label: "Camp Lingo Diacritics - UK English 🇬🇧",
        tagline: OAT("Rule-Based Spelling Guide"),
      },
      [SpellingSystem.EN_CL_DIACRITICS_RP]: {
        label:
          "Camp Lingo Diacritics - BBC English \n🇮🇳🇵🇰🇿🇦🇭🇰🇸🇬🇳🇬🇲🇾🇧🇩🇰🇪🇿🇼🇹🇿🇺🇬🇿🇲🇱🇰🇬🇭🇫🇯",
        tagline: OAT("Rule-Based Spelling Guide"),
      },
      [SpellingSystem.EN_CL_DIACRITICS_SCOTLAND]: {
        label: "Camp Lingo Diacritics - Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        tagline: OAT("Rule-Based Spelling Guide"),
      },
      [SpellingSystem.EN_CL_DIACRITICS_CARIBBEAN]: {
        label:
          "Camp Lingo Diacritics - Caribbean \n🇯🇲🇹🇹🇧🇸🇬🇾🇧🇧🇧🇿🇬🇩🇱🇨🇦🇬🇻🇨🇩🇲🇰🇳🇰🇾🇹🇨🇻🇬🇲🇸🇦🇮",
        tagline: OAT("Rule-Based Spelling Guide"),
      },
      [SpellingSystem.EN_CL_DIACRITICS_LANCASTER]: {
        label: "Camp Lingo Diacritics - Lancastrian (Northern England)",
        tagline: OAT("Rule-Based Spelling Guide"),
      },
      [SpellingSystem.EN_CL_DIACRITICS_WEST_MIDLANDS]: {
        label: "Camp Lingo Diacritics - West Midlands (Central England)",
        tagline: OAT("Rule-Based Spelling Guide"),
      },
      // More spelling systems can be added alongside their rendering support.
    }),
    [OAT],
  );

  useEffect(() => {
    const stored = readStorage(LOCALSTORE_PREF_SPELLING_SYSTEMS);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setUserPreferredSpellingSystems(
          parsed as Record<string, SpellingSystem>,
        );
      }
    } catch {
      // Ignore malformed preference data and retain the consumer defaults.
    }
  }, []);

  const setUserPreferredSpellingSystem = useCallback(
    ({
      lang,
      spellingSystem,
    }: {
      lang: string;
      spellingSystem: SpellingSystem;
    }) => {
      // If EN: if EN_CL_DIACRITICS* then turn off prefShowMainText, if other EN then turn it on.
      if (ilike(lang, "en")) {
        const showMainText = !spellingSystem.startsWith("EN_CL_DIACRITICS");
        // Prevent MainText + Spelling from both being invisible.
        if (!showMainText && prefShowSpelling === "NEVER") {
          writeStorage(LOCALSTORE_PREF_SHOW_SPELLING, "ALWAYS");
          setPrefShowSpellingState("ALWAYS");
        }
        writeStorage(
          LOCALSTORE_PREF_SHOW_MAIN_TEXT,
          JSON.stringify(showMainText),
        );
        setPrefShowMainTextState(showMainText);
      }

      setUserPreferredSpellingSystems((previous) => {
        const next = { ...previous, [lang]: spellingSystem };
        writeStorage(
          LOCALSTORE_PREF_SPELLING_SYSTEMS,
          JSON.stringify(next),
        );
        return next;
      });
    },
    [prefShowSpelling],
  );

  // ------------------------------------------------
  // NONCORE
  useEffect(() => {
    setFadeNonCoreWordsState(
      readBooleanPreference(
        LOCALSTORE_PREF_FADE_NONCORE_WORDS,
        resolvedDefaults.fadeNonCoreWords,
      ),
    );
    setShowNonCoreSpellingState(
      readTripleDisplayPreference(
        LOCALSTORE_PREF_NONCORE_SPELLING,
        resolvedDefaults.showNonCoreSpelling,
      ),
    );
    setShowNonCoreGlossEmojiState(
      readTripleDisplayPreference(
        LOCALSTORE_PREF_NONCORE_GLOSS_EMOJI,
        resolvedDefaults.showNonCoreGlossEmoji,
      ),
    );
    setShowNonCoreGlossTextState(
      readTripleDisplayPreference(
        LOCALSTORE_PREF_NONCORE_GLOSS_TEXT,
        resolvedDefaults.showNonCoreGlossText,
      ),
    );
  }, [
    resolvedDefaults.fadeNonCoreWords,
    resolvedDefaults.showNonCoreGlossEmoji,
    resolvedDefaults.showNonCoreGlossText,
    resolvedDefaults.showNonCoreSpelling,
  ]);

  const setFadeNonCoreWords = useCallback((fade: boolean) => {
    writeStorage(LOCALSTORE_PREF_FADE_NONCORE_WORDS, JSON.stringify(fade));
    setFadeNonCoreWordsState(fade);
  }, []);

  const setShowNonCoreSpelling = useCallback(
    (value: TripleDisplayState) => {
      writeStorage(LOCALSTORE_PREF_NONCORE_SPELLING, value);
      setShowNonCoreSpellingState(value);
    },
    [],
  );

  const setShowNonCoreGlossEmoji = useCallback(
    (value: TripleDisplayState) => {
      writeStorage(LOCALSTORE_PREF_NONCORE_GLOSS_EMOJI, value);
      setShowNonCoreGlossEmojiState(value);
    },
    [],
  );

  const setShowNonCoreGlossText = useCallback(
    (value: TripleDisplayState) => {
      writeStorage(LOCALSTORE_PREF_NONCORE_GLOSS_TEXT, value);
      setShowNonCoreGlossTextState(value);
    },
    [],
  );

  // ------------------------------------------------
  // GENERAL DISPLAY PREFS
  useEffect(() => {
    setPrefShowSpellingState(
      readTripleDisplayPreference(
        LOCALSTORE_PREF_SHOW_SPELLING,
        resolvedDefaults.prefShowSpelling,
      ),
    );
    setPrefShowMainTextState(
      readBooleanPreference(
        LOCALSTORE_PREF_SHOW_MAIN_TEXT,
        resolvedDefaults.prefShowMainText,
      ),
    );
    setShowMainTextReadingGuideState(
      readBooleanPreference(
        LOCALSTORE_PREF_SHOW_MAIN_TEXT_READING_GUIDE,
        resolvedDefaults.showMainTextReadingGuide,
      ),
    );
    setPrefShowGlossEmojiState(
      readTripleDisplayPreference(
        LOCALSTORE_PREF_SHOW_GLOSS_EMOJI,
        resolvedDefaults.prefShowGlossEmoji,
      ),
    );

    // Backup check retained from OmniAccess for the old LingoDex key.
    const storedGlossText =
      readStorage(LOCALSTORE_PREF_SHOW_GLOSS_TEXT) ??
      readStorage("LINGODEX_UI_SHOW_GLOSS_TEXT");
    setPrefShowGlossTextState(
      isTripleDisplayState(storedGlossText)
        ? storedGlossText
        : resolvedDefaults.prefShowGlossText,
    );
  }, [
    resolvedDefaults.prefShowGlossEmoji,
    resolvedDefaults.prefShowGlossText,
    resolvedDefaults.prefShowMainText,
    resolvedDefaults.prefShowSpelling,
    resolvedDefaults.showMainTextReadingGuide,
  ]);

  const setPrefShowSpelling = useCallback(
    (value: TripleDisplayState) => {
      // If spelling changes to Never, turn MainText on again. This especially
      // matters after selecting an EN_CL_DIACRITICS spelling system.
      const preferredEnglishSpelling = userPreferredSpellingSystems.en;
      if (
        value === "NEVER" &&
        ilike(focusLang, "en") &&
        preferredEnglishSpelling?.startsWith("EN_CL_DIACRITICS") &&
        !prefShowMainText
      ) {
        writeStorage(LOCALSTORE_PREF_SHOW_MAIN_TEXT, JSON.stringify(true));
        setPrefShowMainTextState(true);
      }
      writeStorage(LOCALSTORE_PREF_SHOW_SPELLING, value);
      setPrefShowSpellingState(value);
    },
    [focusLang, prefShowMainText, userPreferredSpellingSystems],
  );

  const setShowMainTextReadingGuide = useCallback((show: boolean) => {
    writeStorage(
      LOCALSTORE_PREF_SHOW_MAIN_TEXT_READING_GUIDE,
      JSON.stringify(show),
    );
    setShowMainTextReadingGuideState(show);
  }, []);

  const setPrefShowMainText = useCallback(
    (value: boolean) => {
      // Prevent MainText + Spelling from both being invisible.
      if (!value && prefShowSpelling === "NEVER") {
        writeStorage(LOCALSTORE_PREF_SHOW_SPELLING, "ALWAYS");
        setPrefShowSpellingState("ALWAYS");
      }
      writeStorage(LOCALSTORE_PREF_SHOW_MAIN_TEXT, JSON.stringify(value));
      setPrefShowMainTextState(value);
    },
    [prefShowSpelling],
  );

  const setPrefShowGlossEmoji = useCallback(
    (value: TripleDisplayState) => {
      writeStorage(LOCALSTORE_PREF_SHOW_GLOSS_EMOJI, value);
      setPrefShowGlossEmojiState(value);
    },
    [],
  );

  const setPrefShowGlossText = useCallback(
    (value: TripleDisplayState) => {
      writeStorage(LOCALSTORE_PREF_SHOW_GLOSS_TEXT, value);
      setPrefShowGlossTextState(value);
    },
    [],
  );

  const value = useMemo<UserLingoPrefsContextType>(
    () => ({
      userPreferredSpellingSystems,
      setUserPreferredSpellingSystem,
      // Retain the misspelled OmniAccess name during consumer migration.
      setUserPrefferedSpellingSystem: setUserPreferredSpellingSystem,
      spellingSystemsInfo,
      showMainTextReadingGuide,
      setShowMainTextReadingGuide,
      fadeNonCoreWords,
      setFadeNonCoreWords,
      showNonCoreSpelling,
      setShowNonCoreSpelling,
      showNonCoreGlossEmoji,
      setShowNonCoreGlossEmoji,
      showNonCoreGlossText,
      setShowNonCoreGlossText,
      prefShowSpelling,
      setPrefShowSpelling,
      prefShowMainText,
      setPrefShowMainText,
      prefShowGlossText,
      setPrefShowGlossText,
      prefShowGlossEmoji,
      setPrefShowGlossEmoji,
    }),
    [
      fadeNonCoreWords,
      prefShowGlossEmoji,
      prefShowGlossText,
      prefShowMainText,
      prefShowSpelling,
      setFadeNonCoreWords,
      setPrefShowGlossEmoji,
      setPrefShowGlossText,
      setPrefShowMainText,
      setPrefShowSpelling,
      setShowMainTextReadingGuide,
      setShowNonCoreGlossEmoji,
      setShowNonCoreGlossText,
      setShowNonCoreSpelling,
      setUserPreferredSpellingSystem,
      showMainTextReadingGuide,
      showNonCoreGlossEmoji,
      showNonCoreGlossText,
      showNonCoreSpelling,
      spellingSystemsInfo,
      userPreferredSpellingSystems,
    ],
  );

  return (
    <UserLingoPrefsContext.Provider value={value}>
      {children}
    </UserLingoPrefsContext.Provider>
  );
}

export function useUserLingoPrefsData(): UserLingoPrefsContextType {
  const context = useContext(UserLingoPrefsContext);
  if (context === undefined) {
    throw new Error(
      "useUserLingoPrefsData must be used within a UserLingoPrefsDataProvider",
    );
  }
  return context;
}

/** Allows shared components to retain standalone explicit-prop behavior. */
export function useOptionalUserLingoPrefsData():
  | UserLingoPrefsContextType
  | undefined {
  return useContext(UserLingoPrefsContext);
}
