import type {
  SupabaseTranslationClient,
  TranslationRow,
} from "./types.js";
import { isTranslationRow } from "./validators.js";

const BATCH_WAIT_MS = 50;
// Postgres IN can handle hundreds to thousands of ids here, so no hard max batch
// size is enforced unless real-world traces show this query needs one.
const TRANSLATION_COLUMNS =
  "id, source_lang, source_text, target_lang, target_text, owner_id, created_at, translator, ref";

export type SelectTranslationsByRefInput = {
  supabaseClient: SupabaseTranslationClient;
  owner_id: string | null;
  source_lang: string;
  target_lang: string;
  db_table: string;
  db_column: string;
  dbIds: number[];
};

export type SelectTranslationsByRefResult = {
  data: TranslationRow[] | null;
  error: unknown | null;
};

type QueuedSelectTranslationsByRefRequest = SelectTranslationsByRefInput & {
  resolve: (value: SelectTranslationsByRefResult) => void;
  reject: (reason?: unknown) => void;
};

const inflightRequests = new Map<string, Promise<SelectTranslationsByRefResult>>();
const batches = new Map<string, QueuedSelectTranslationsByRefRequest[]>();
const batchTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getBatchKey({
  owner_id,
  source_lang,
  target_lang,
  db_table,
  db_column,
}: Omit<SelectTranslationsByRefInput, "supabaseClient" | "dbIds">): string {
  return [owner_id, source_lang, target_lang, db_table, db_column].join(":");
}

function getRequestKey(input: SelectTranslationsByRefInput): string {
  return `${getBatchKey(input)}:${input.dbIds.join(",")}`;
}

function dbRefId(row: TranslationRow): unknown {
  return row.ref?.db?.id;
}

function hasRequestedDbRefId(row: TranslationRow, dbIds: number[]): boolean {
  const rowId = dbRefId(row);
  if (rowId === undefined || rowId === null) return false;

  return dbIds.some((dbId) => String(dbId) === String(rowId));
}

export async function __sbSelectTranslationsByRef({
  supabaseClient,
  owner_id,
  source_lang,
  target_lang,
  db_table,
  db_column,
  dbIds,
}: SelectTranslationsByRefInput): Promise<SelectTranslationsByRefResult> {
  const { data, error } = await supabaseClient
    .from("translations")
    .select(TRANSLATION_COLUMNS)
    .eq("owner_id", owner_id)
    .eq("source_lang", source_lang)
    .eq("target_lang", target_lang)
    .eq("ref->db->>table", db_table)
    .eq("ref->db->>column", db_column)
    .in("ref->db->>id", dbIds);

  return {
    data: data?.filter(isTranslationRow) ?? null,
    error,
  };
}

async function flushBatch(batchKey: string): Promise<void> {
  const requests = batches.get(batchKey);
  if (!requests) return;

  batches.delete(batchKey);

  const timer = batchTimers.get(batchKey);
  if (timer) {
    clearTimeout(timer);
    batchTimers.delete(batchKey);
  }

  const firstRequest = requests[0];
  if (!firstRequest) return;

  const allDbIds = Array.from(new Set(requests.flatMap((request) => request.dbIds)));

  try {
    const { data, error } = await __sbSelectTranslationsByRef({
      supabaseClient: firstRequest.supabaseClient,
      owner_id: firstRequest.owner_id,
      source_lang: firstRequest.source_lang,
      target_lang: firstRequest.target_lang,
      db_table: firstRequest.db_table,
      db_column: firstRequest.db_column,
      dbIds: allDbIds,
    });

    for (const request of requests) {
      request.resolve({
        data: data?.filter((row) => hasRequestedDbRefId(row, request.dbIds)) ?? null,
        error,
      });
    }
  } catch (error) {
    for (const request of requests) {
      request.reject(error);
    }
  }
}

export default function callSBSelectTranslationsByRef(
  input: SelectTranslationsByRefInput,
): Promise<SelectTranslationsByRefResult> {
  const batchKey = getBatchKey(input);
  const requestKey = getRequestKey(input);
  const inflightRequest = inflightRequests.get(requestKey);
  if (inflightRequest) return inflightRequest;

  const request = new Promise<SelectTranslationsByRefResult>((resolve, reject) => {
    if (!batches.has(batchKey)) {
      batches.set(batchKey, []);
      batchTimers.set(
        batchKey,
        setTimeout(() => {
          void flushBatch(batchKey);
        }, BATCH_WAIT_MS),
      );
    }

    batches.get(batchKey)?.push({
      ...input,
      resolve,
      reject,
    });
  });

  inflightRequests.set(requestKey, request);
  void request.finally(() => {
    inflightRequests.delete(requestKey);
  });

  return request;
}
