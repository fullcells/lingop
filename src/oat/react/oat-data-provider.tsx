import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ilike } from "../../core/misc.js";
import type { AnnotatedText } from "../../core/annotation/types.js";
import { OAT_SOURCE_LANG } from "../constants.js";
import type {
  OATDataLoaders,
  OATStaticAnnotations,
  OATranslationsByLang,
} from "../types.js";

type OATDataContextType = {
  OAT: (sourceText: string) => string;
  OAT2: (sourceText: string) => string;
  getStaticFocusLangAText: (enText: string) => AnnotatedText | null;
};

const OATDataContext = createContext<OATDataContextType | undefined>(undefined);

export function OATDataProvider({
  children,
  initialOATranslationsByLang,
  guiLang,
  focusLang,
  loaders,
}: {
  children: ReactNode;
  initialOATranslationsByLang: OATranslationsByLang | null;
  guiLang: string;
  focusLang: string | null;
  loaders: OATDataLoaders;
}) {
  const [oaTranslationsByLang, setOATranslationsByLang] =
    useState<OATranslationsByLang>(initialOATranslationsByLang ?? {});
  const oaTranslationsByLangRef = useRef<OATranslationsByLang>(
    initialOATranslationsByLang ?? {},
  );
  const pendingLangsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    oaTranslationsByLangRef.current = oaTranslationsByLang;
  }, [oaTranslationsByLang]);

  const ensureOATranslationsLoadForLang = useCallback(
    async (requestedLang: string) => {
      if (!requestedLang) return;
      const lang = requestedLang.toLowerCase();
      if (
        ilike(lang, OAT_SOURCE_LANG) ||
        oaTranslationsByLangRef.current[lang] ||
        pendingLangsRef.current.has(lang)
      ) {
        return;
      }

      pendingLangsRef.current.add(lang);
      try {
        const translations = await loaders.loadTranslations(lang);
        if (translations) {
          oaTranslationsByLangRef.current = {
            ...oaTranslationsByLangRef.current,
            [lang]: translations,
          };
          setOATranslationsByLang((previous) => ({
            ...previous,
            [lang]: translations,
          }));
        } else {
          console.warn(`OATDataProvider: Failed to load translations for ${lang}`);
          oaTranslationsByLangRef.current = {
            ...oaTranslationsByLangRef.current,
            [lang]: {},
          };
          setOATranslationsByLang((previous) => ({ ...previous, [lang]: {} }));
        }
      } catch (error) {
        console.warn(`OATDataProvider: Failed to load translations for ${lang}`, error);
      } finally {
        pendingLangsRef.current.delete(lang);
      }
    },
    [loaders],
  );

  useEffect(() => {
    void ensureOATranslationsLoadForLang(guiLang);
  }, [guiLang, ensureOATranslationsLoadForLang]);

  useEffect(() => {
    if (focusLang) void ensureOATranslationsLoadForLang(focusLang);
  }, [focusLang, ensureOATranslationsLoadForLang]);

  // ------------------------------------------------------------------
  // Memoized OAT function (never changes unless data does)
  const OAT = useCallback(
    // GUI LANG
    (text: string): string => {
      if (
        !ilike(guiLang, OAT_SOURCE_LANG) &&
        !oaTranslationsByLang[guiLang.toLowerCase()]
      ) {
        return "…";
      }
      // Return Translation if available
      const translation = oaTranslationsByLang[guiLang.toLowerCase()]?.[text]?.t;
      if (translation) return translation;
      // Return Original Text
      return text;
    },
    [oaTranslationsByLang, guiLang],
  );

  const OAT2 = useCallback(
    // FOCUS LANG
    (text: string): string => {
      if (!focusLang) return text;
      if (
        !ilike(focusLang, OAT_SOURCE_LANG) &&
        !oaTranslationsByLang[focusLang.toLowerCase()]
      ) {
        return "…";
      }
      // Return Translation if available
      const translation = oaTranslationsByLang[focusLang.toLowerCase()]?.[text]?.t;
      if (translation) return translation;
      // Return Original Text
      return text;
    },
    [oaTranslationsByLang, focusLang],
  );

  // ------------------------------------------------------------------
  const [staticAnnotationsByLang, setStaticAnnotationsByLang] = useState<
    Record<string, OATStaticAnnotations>
  >({});
  const pendingStaticAnnotationLangsRef = useRef<Set<string>>(new Set());
  const normalizedFocusLang = focusLang?.toLowerCase() ?? null;
  const focusLangA8ns = normalizedFocusLang
    ? staticAnnotationsByLang[normalizedFocusLang]
    : undefined;

  useEffect(() => {
    if (
      !normalizedFocusLang ||
      staticAnnotationsByLang[normalizedFocusLang] ||
      pendingStaticAnnotationLangsRef.current.has(normalizedFocusLang)
    ) {
      return;
    }

    pendingStaticAnnotationLangsRef.current.add(normalizedFocusLang);
    void loaders
      .loadStaticAnnotations(normalizedFocusLang)
      .then((data) => {
        setStaticAnnotationsByLang((previous) => ({
          ...previous,
          [normalizedFocusLang]: data ?? {},
        }));
      })
      .catch((error: unknown) =>
        console.warn(
          `OATDataProvider: Failed to load static annotations for ${normalizedFocusLang}`,
          error,
        ),
      )
      .finally(() => pendingStaticAnnotationLangsRef.current.delete(normalizedFocusLang));
  }, [loaders, normalizedFocusLang, staticAnnotationsByLang]);

  const getStaticFocusLangAText = useCallback(
    // ~ aka OAA2
    (enText: string): AnnotatedText | null => {
      // alternatively; could also output loading state and l10n:string while the annotations loader is running
      if (!focusLang || !focusLangA8ns) return null;
      let localization = oaTranslationsByLang[focusLang.toLowerCase()]?.[enText]?.t;
      if (ilike(focusLang, OAT_SOURCE_LANG)) localization = enText;
      if (!localization) return null;
      return (
        focusLangA8ns[localization] ??
        focusLangA8ns[localization.toLowerCase()] ??
        null
      );
    },
    [focusLangA8ns, oaTranslationsByLang, focusLang],
  );

  return (
    <OATDataContext.Provider value={{ OAT, OAT2, getStaticFocusLangAText }}>
      {children}
    </OATDataContext.Provider>
  );
}

export function useOAT(): OATDataContextType {
  const context = useContext(OATDataContext);
  if (context === undefined) {
    throw new Error("useOAT must be used within an OATDataProvider");
  }
  return context;
}
