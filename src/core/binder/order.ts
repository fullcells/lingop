export type BinderDocL10nsInput = {
  doc_id: string | number;
  l10ns: readonly string[];
};

export type BinderDocMinL10nsOrderItem = {
  doc_id: string | number;
  newL10ns: string[];
  l10ns: string[];
};

export type BinderDocsByMinL10nsOrderOptions = {
  priorityDocIds?: readonly (string | number)[];
};

export type SupabaseBinderDocsOrderQueryResult = {
  data: unknown[] | null;
  error: unknown | null;
};

export type SupabaseBinderDocsOrderQuery =
  PromiseLike<SupabaseBinderDocsOrderQueryResult> & {
    eq(column: string, value: unknown): SupabaseBinderDocsOrderQuery;
  };

export type SupabaseBinderDocsOrderClient = {
  from(table: "cache_binder_doc_l10ns"): {
    select(columns: string): SupabaseBinderDocsOrderQuery;
  };
};

export type FetchBinderDocsByMinL10nsOrderInput =
  BinderDocsByMinL10nsOrderOptions & {
    supabaseClient: SupabaseBinderDocsOrderClient;
    binder_id: number;
    lang: string;
  };

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

export function getBinderDocsByMinL10nsOrder(
  docs: readonly BinderDocL10nsInput[],
  options: BinderDocsByMinL10nsOrderOptions = {},
): BinderDocMinL10nsOrderItem[] {
  const remainingDocs = docs.map((doc) => ({
    doc_id: doc.doc_id,
    l10ns: [...doc.l10ns],
  }));
  const priorityDocIds = new Set((options.priorityDocIds ?? []).map(docIdKey));
  const orderedResult: BinderDocMinL10nsOrderItem[] = [];
  const seenL10ns = new Set<string>();

  const l10nByNumDocs: Record<string, number> = {};
  for (const doc of remainingDocs) {
    for (const l10n of new Set(doc.l10ns)) {
      l10nByNumDocs[l10n] = (l10nByNumDocs[l10n] ?? 0) + 1;
    }
  }

  while (remainingDocs.length > 0) {
    let bestDoc: { doc_id: string | number; l10ns: string[] } | null = null;
    let bestNewL10ns: string[] = [];
    let bestIndex = -1;
    let bestNewL10nsDocCoverage = -1;

    for (let index = 0; index < remainingDocs.length; index++) {
      const doc = remainingDocs[index]!;
      const newL10ns = doc.l10ns.filter((l10n) => !seenL10ns.has(l10n));
      const newL10nsDocCoverage = newL10ns.reduce(
        (sum, l10n) => sum + (l10nByNumDocs[l10n] ?? 1),
        0,
      );
      const isPriorityDoc = priorityDocIds.has(docIdKey(doc.doc_id));

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
      }

      if (isPriorityDoc) break;
    }

    if (!bestDoc) break;

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
  const { data, error } = await supabaseClient
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

  return getBinderDocsByMinL10nsOrder(docs, {
    ...(priorityDocIds === undefined ? {} : { priorityDocIds }),
  });
}

