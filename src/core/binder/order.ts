import { asSupabaseRuntimeClient, type SupabaseClientLike } from "../supabase.js";

export type BinderDocL10nsInput = {
  doc_id: string | number;
  l10ns: readonly string[];
};

export type BinderDocMinL10nsOrderItem = {
  doc_id: string | number;
  newL10ns: string[];
  l10ns: string[];
};

export type SupabaseBinderDocsOrderClient = SupabaseClientLike;

export type FetchBinderDocsByMinL10nsOrderInput = {
  supabaseClient: SupabaseBinderDocsOrderClient;
  binder_id: number;
  lang: string;
  priorityDocIds?: readonly (string | number)[];
};

const DEFAULT_PRIORITY_DOC_IDS: readonly (string | number)[] = [179]; // 179 for LingoTrivia.
const LARGE_VOCABULARY_SIZE = 1_000;

function docIdKey(docId: string | number): string {
  return String(docId);
}

function isBinderDocL10nsInput(value: unknown): value is BinderDocL10nsInput {
  if (value === null || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;
  return (
    (typeof row.doc_id === "string" || typeof row.doc_id === "number") &&
    Array.isArray(row.l10ns) &&
    row.l10ns.every((l10n) => typeof l10n === "string")
  );
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return JSON.stringify(error);
}

/**
 * Recommends a binder doc order using minimum new l10ns as its baseline.
 *
 * Despite the historical name, this is conceptually closer to
 * `BinderDocsByRecL10nsOrder`: priority docs are recommended first, and for
 * vocabularies above 1,000 unique l10ns a one-off rare singleton may be
 * replaced by a doc containing exactly two recurring new l10ns.
 *
 * Omitting `priorityDocIds` uses the default priority doc IDs. Passing any
 * array, including an empty one, explicitly replaces those defaults.
 */
export function getBinderDocsByMinL10nsOrder(
  docs: readonly BinderDocL10nsInput[],
  priorityDocIds?: readonly (string | number)[],
): BinderDocMinL10nsOrderItem[] {
  const usesDefaultPriorityDocs = priorityDocIds === undefined;
  const resolvedPriorityDocIds = priorityDocIds ?? DEFAULT_PRIORITY_DOC_IDS;
  if (!usesDefaultPriorityDocs) {
    console.info("Using consumer-specified binder priority doc IDs:", priorityDocIds);
  }

  const remainingDocs = docs.map((doc) => ({
    doc_id: doc.doc_id,
    l10ns: [...doc.l10ns],
  }));
  const priorityDocIdKeys = new Set(resolvedPriorityDocIds.map(docIdKey));
  const defaultPriorityDocIdKeys = new Set(DEFAULT_PRIORITY_DOC_IDS.map(docIdKey));
  const orderedResult: BinderDocMinL10nsOrderItem[] = [];
  const seenL10ns = new Set<string>();
  const uniqueInputL10ns = new Set<string>();

  const l10nByNumDocs: Record<string, number> = {};
  for (const doc of remainingDocs) {
    for (const l10n of new Set(doc.l10ns)) {
      uniqueInputL10ns.add(l10n);
      l10nByNumDocs[l10n] = (l10nByNumDocs[l10n] ?? 0) + 1;
    }
  }

  while (remainingDocs.length > 0) {
    let bestDoc: { doc_id: string | number; l10ns: string[] } | null = null;
    let bestNewL10ns: string[] = [];
    let bestIndex = -1;
    let bestNewL10nsDocCoverage = -1;
    let selectedPriorityDoc = false;
    let bestRecurringPairDoc: { doc_id: string | number; l10ns: string[] } | null = null;
    let bestRecurringPairNewL10ns: string[] = [];
    let bestRecurringPairIndex = -1;
    let bestRecurringPairCoverage = -1;

    for (let index = 0; index < remainingDocs.length; index++) {
      const doc = remainingDocs[index]!;
      const newL10ns = [...new Set(doc.l10ns.filter((l10n) => !seenL10ns.has(l10n)))];
      const newL10nsDocCoverage = newL10ns.reduce(
        (sum, l10n) => sum + (l10nByNumDocs[l10n] ?? 1),
        0,
      );
      const isPriorityDoc = priorityDocIdKeys.has(docIdKey(doc.doc_id));

      if (
        newL10ns.length === 2 &&
        newL10ns.every((l10n) => (l10nByNumDocs[l10n] ?? 1) > 1) &&
        newL10nsDocCoverage > bestRecurringPairCoverage
      ) {
        bestRecurringPairDoc = doc;
        bestRecurringPairNewL10ns = newL10ns;
        bestRecurringPairIndex = index;
        bestRecurringPairCoverage = newL10nsDocCoverage;
      }

      const isBetter =
        bestDoc === null ||
        newL10ns.length < bestNewL10ns.length ||
        (newL10ns.length === bestNewL10ns.length &&
          newL10nsDocCoverage > bestNewL10nsDocCoverage);

      if (isBetter || isPriorityDoc) {
        bestDoc = doc;
        bestNewL10ns = newL10ns;
        bestIndex = index;
        bestNewL10nsDocCoverage = newL10nsDocCoverage;
        selectedPriorityDoc = isPriorityDoc;
      }

      if (isPriorityDoc) break;
    }

    if (!bestDoc) break;

    // This is the only frequency-based override: for a large vocabulary, trade
    // one new l10n seen in one doc for exactly two new l10ns each seen in 2+ docs.
    // - Added due to LingoTrivia - 20260725
    const replacesRareSingleton =
      !selectedPriorityDoc &&
      uniqueInputL10ns.size > LARGE_VOCABULARY_SIZE &&
      bestNewL10ns.length === 1 &&
      (l10nByNumDocs[bestNewL10ns[0]!] ?? 1) === 1 &&
      bestRecurringPairDoc !== null;

    if (replacesRareSingleton) {
      bestDoc = bestRecurringPairDoc;
      bestNewL10ns = bestRecurringPairNewL10ns;
      bestIndex = bestRecurringPairIndex;
    }

    if (!bestDoc) break;

    if (
      usesDefaultPriorityDocs &&
      selectedPriorityDoc &&
      defaultPriorityDocIdKeys.has(docIdKey(bestDoc.doc_id))
    ) {
      console.info("Using default binder priority doc ID:", bestDoc.doc_id);
    }

    for (const l10n of bestDoc.l10ns) {
      seenL10ns.add(l10n);
    }

    orderedResult.push({
      doc_id: bestDoc.doc_id,
      newL10ns: bestNewL10ns,
      l10ns: bestDoc.l10ns,
    });
    remainingDocs.splice(bestIndex, 1);
  }

  return orderedResult;
}

export async function fetchBinderDocsByMinL10nsOrder({
  supabaseClient,
  binder_id,
  lang,
  priorityDocIds,
}: FetchBinderDocsByMinL10nsOrderInput): Promise<BinderDocMinL10nsOrderItem[] | null> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to fetch binder doc l10n caches.");
    return null;
  }

  const { data, error } = await runtimeSupabaseClient
    .from("cache_binder_doc_l10ns")
    .select("doc_id, l10ns, user_binder_docs!inner(binder_id)")
    .eq("lang", lang)
    .eq("user_binder_docs.binder_id", binder_id);

  if (error) {
    console.error("Error fetching binder doc l10n caches:", errorMessage(error));
    return null;
  }

  const docs = (data ?? []).filter(isBinderDocL10nsInput);
  if (docs.length !== (data ?? []).length) {
    console.warn("Some cache_binder_doc_l10ns rows had invalid doc_id/l10ns shape.");
  }

  return getBinderDocsByMinL10nsOrder(docs, priorityDocIds);
}
