import type { ContentReference, Localization } from "../misc.js";
import type { BinderDocLocalizationInput, BinderDocRow, BinderRow } from "./types.js";

export function normalizeBinderLang(lang: string): string {
  return lang.trim().toLowerCase();
}

export function normalizeBinderFocusLangs(
  focusLangs: readonly string[] | null | undefined,
): string[] {
  return (focusLangs ?? []).map(normalizeBinderLang).filter(Boolean);
}

export function addBinderFocusLang(
  focusLangs: readonly string[],
  lang: string,
): string[] {
  return Array.from(
    new Set([...focusLangs, normalizeBinderLang(lang)].filter(Boolean)),
  );
}

export function buildBinderDocRef({
  binderId,
  docId,
  lineIdx,
  segIdx,
}: {
  binderId: number;
  docId: number;
  lineIdx?: number;
  segIdx?: number;
}): ContentReference {
  return {
    db: {
      id: docId,
      table: "user_binder_docs",
      column: "text",
      binder_id: binderId,
      ...(lineIdx === undefined ? {} : { line_idx: lineIdx }),
      ...(segIdx === undefined ? {} : { seg_idx: segIdx }),
    },
  } as unknown as ContentReference;
}

export function buildTranslationTargetTextRef({
  translationId,
  lineIdx,
  segIdx,
}: {
  translationId: number;
  lineIdx?: number;
  segIdx?: number;
}): ContentReference {
  return {
    db: {
      id: translationId,
      table: "translations",
      column: "target_text",
      ...(lineIdx === undefined ? {} : { line_idx: lineIdx }),
      ...(segIdx === undefined ? {} : { seg_idx: segIdx }),
    },
  };
}

export function buildBinderDocLocalizationInput(
  binder: Pick<BinderRow, "id" | "lang"> & { owner_id?: string | null },
  doc: Pick<BinderDocRow, "id" | "text">,
  focusLang: string,
): BinderDocLocalizationInput {
  return {
    l10n_lang: normalizeBinderLang(focusLang),
    sourceContent: {
      owner_id: binder.owner_id ?? null,
      lang: binder.lang,
      text: doc.text,
      ref: buildBinderDocRef({ binderId: binder.id, docId: doc.id }),
    },
  };
}

export function buildBinderDocSegmentLocalization(
  input: {
    binder: Pick<BinderRow, "id" | "lang"> & { owner_id?: string | null };
    doc: Pick<BinderDocRow, "id">;
    text: string;
    lineIdx: number;
    segIdx: number;
    l10nLang?: string;
  },
): Localization {
  const l10nLang = input.l10nLang ?? input.binder.lang;
  return {
    text: input.text,
    l10n_lang: l10nLang,
    sourceContent: {
      owner_id: input.binder.owner_id ?? null,
      lang: input.binder.lang,
      text: input.text,
      ref: buildBinderDocRef({
        binderId: input.binder.id,
        docId: input.doc.id,
        lineIdx: input.lineIdx,
        segIdx: input.segIdx,
      }),
    },
  };
}

export function buildLocalizedBinderDocSegmentLocalization(
  input: {
    localization: Localization;
    text: string;
    l10nLang: string;
    lineIdx: number;
    segIdx: number;
    translationId?: number | null;
    binderId: number;
    docId: number;
    ownerId?: string | null;
  },
): Localization {
  const ref =
    input.translationId != null
      ? buildTranslationTargetTextRef({
          translationId: input.translationId,
          lineIdx: input.lineIdx,
          segIdx: input.segIdx,
        })
      : buildBinderDocRef({
          binderId: input.binderId,
          docId: input.docId,
          lineIdx: input.lineIdx,
          segIdx: input.segIdx,
        });

  return {
    ...input.localization,
    text: input.text,
    l10n_lang: input.l10nLang,
    sourceContent: {
      ...input.localization.sourceContent,
      owner_id: input.ownerId ?? input.localization.sourceContent.owner_id,
      lang: input.l10nLang,
      text: input.text,
      ref,
    },
  };
}

export function isBinderDocL10nCacheStale(
  doc: Pick<BinderDocRow, "updated_at">,
  localizedDoc:
    | {
        translationCreatedAt?: string | null;
      }
    | null
    | undefined,
  cache: { updated_at: string } | null | undefined,
): boolean {
  if (!cache) return true;
  const sourceUpdatedAt = localizedDoc?.translationCreatedAt ?? doc.updated_at;
  return new Date(cache.updated_at).getTime() < new Date(sourceUpdatedAt).getTime();
}
