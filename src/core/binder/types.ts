import type { AnnotatedText } from "../annotation/types.js";
import type { Localization } from "../misc.js";

export type BinderRow = {
  id: number;
  name: string;
  lang: string;
  updated_at: string;
  owner_id?: string | null;
  focus_langs?: string[] | null;
};

export type BinderDocRow = {
  id: number;
  binder_id: number;
  name: string;
  text: string;
  updated_at: string;
};

export type BinderDocL10nCacheRow = {
  lang: string;
  doc_id: number;
  l10ns: string[];
  updated_at: string;
};

export type BinderDocL10nCacheInsert = Pick<
  BinderDocL10nCacheRow,
  "doc_id" | "lang" | "l10ns"
>;

export type MarkdownSegment = {
  isMd: boolean;
  text: string;
};

export type AnnotatedMarkdownSegment = MarkdownSegment & {
  atext?: AnnotatedText | null;
};

export type BinderDocLocalizationInput = {
  l10n_lang: string;
  sourceContent: Localization["sourceContent"];
};

