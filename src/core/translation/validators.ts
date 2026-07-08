import type { TranslationDbRef, TranslationRow } from "./types.js";

export function isTranslationDbRef(value: unknown): value is TranslationDbRef {
  if (value === null || typeof value !== "object") return false;

  const ref = value as { db?: unknown };
  if (ref.db === undefined) return true;

  return ref.db !== null && typeof ref.db === "object";
}

export function isTranslationRow(value: unknown): value is TranslationRow {
  if (value === null || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.source_lang === "string" &&
    typeof row.source_text === "string" &&
    typeof row.target_lang === "string" &&
    typeof row.target_text === "string" &&
    typeof row.owner_id === "string" &&
    typeof row.created_at === "string" &&
    typeof row.translator === "string" &&
    (row.ref === null || isTranslationDbRef(row.ref))
  );
}

