import type { AnnotatedText } from "../core/annotation/types.js";

export type OATranslations = Record<string, { t: string }>;
export type OATranslationsByLang = Record<string, OATranslations>;
export type OATStaticAnnotations = Record<string, AnnotatedText>;

export type OATDataLoaders = {
  loadTranslations: (lang: string) => Promise<OATranslations | null>;
  loadStaticAnnotations: (lang: string) => Promise<OATStaticAnnotations | null>;
};

export type OATTextsByScope = Record<string, string[]>;

export type OATSourceData = {
  guiTextsByScope: OATTextsByScope;
  focusTextsByScope: OATTextsByScope;
  staticFocusTextsByScope: OATTextsByScope;
};
