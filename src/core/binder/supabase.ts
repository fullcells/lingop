import type {
  BinderDocL10nCacheInsert,
  BinderDocL10nCacheRow,
  BinderDocRow,
  BinderRow,
} from "./types.js";

export const binderColumns = "id, name, lang, focus_langs, owner_id, updated_at";
export const binderDocColumns = "id, binder_id, name, text, updated_at";
export const binderDocL10nCacheColumns = "lang, doc_id, l10ns, updated_at";

type SupabaseError = { message?: string } | unknown | null;

type QueryResult<T> = {
  data: T | null;
  error: SupabaseError;
};

type Query<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: unknown): Query<T>;
  in(column: string, values: unknown[]): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  select(columns?: string): Query<T>;
  single(): PromiseLike<QueryResult<T extends Array<infer U> ? U : T>>;
};

type TableQuery<T> = {
  select(columns: string): Query<T[]>;
  insert(values: Record<string, unknown>): Query<T[]>;
  update(values: Record<string, unknown>): Query<T[]>;
  upsert(
    values: Record<string, unknown>[],
    options?: { onConflict?: string },
  ): Query<T[]>;
  delete(): Query<unknown[]>;
};

export type SupabaseBinderClient = {
  from(table: "user_binders"): TableQuery<BinderRow>;
  from(table: "user_binder_docs"): TableQuery<BinderDocRow>;
  from(table: "cache_binder_doc_l10ns"): TableQuery<BinderDocL10nCacheRow>;
};

export type SupabaseBinderClientInput = {
  supabaseClient: SupabaseBinderClient;
};

export type CreateBinderInput = SupabaseBinderClientInput &
  Pick<BinderRow, "name" | "lang">;

export type UpdateBinderNameInput = SupabaseBinderClientInput & {
  id: number;
  name: string;
};

export type UpdateBinderFocusLangsInput = SupabaseBinderClientInput & {
  id: number;
  focusLangs: string[];
};

export type DeleteBinderInput = SupabaseBinderClientInput & {
  id: number;
};

export type GetBinderInput = SupabaseBinderClientInput & {
  id: number;
};

export type ListBinderDocsInput = SupabaseBinderClientInput & {
  binderId: number;
};

export type ListBinderDocL10nCachesInput = SupabaseBinderClientInput & {
  docIds: number[];
  lang: string;
};

export type UpsertBinderDocL10nCachesInput = SupabaseBinderClientInput & {
  rows: Array<Pick<BinderDocL10nCacheInsert, "doc_id" | "lang" | "l10ns">>;
};

export type CreateBinderDocInput = SupabaseBinderClientInput &
  Pick<BinderDocRow, "binder_id" | "name" | "text">;

export type UpdateBinderDocInput = SupabaseBinderClientInput & {
  id: number;
  values: Partial<Pick<BinderDocRow, "name" | "text">>;
};

export type DeleteBinderDocInput = SupabaseBinderClientInput & {
  id: number;
};

function throwIfError(error: SupabaseError): void {
  if (error) throw error;
}

function requireData<T>(data: T | null, message: string): T {
  if (data === null) {
    throw new Error(message);
  }

  return data;
}

export async function listBinders({
  supabaseClient,
}: SupabaseBinderClientInput): Promise<BinderRow[]> {
  const { data, error } = await supabaseClient
    .from("user_binders")
    .select(binderColumns)
    .order("updated_at", { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function createBinder({
  supabaseClient,
  name,
  lang,
}: CreateBinderInput): Promise<BinderRow> {
  const { data, error } = await supabaseClient
    .from("user_binders")
    .insert({ name: name.trim(), lang: lang.trim() })
    .select(binderColumns)
    .single();
  throwIfError(error);
  return requireData(data, "Supabase returned no binder after insert.");
}

export async function updateBinderName({
  supabaseClient,
  id,
  name,
}: UpdateBinderNameInput): Promise<BinderRow> {
  const { data, error } = await supabaseClient
    .from("user_binders")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(binderColumns)
    .single();
  throwIfError(error);
  return requireData(data, "Supabase returned no binder after update.");
}

export async function updateBinderFocusLangs({
  supabaseClient,
  id,
  focusLangs,
}: UpdateBinderFocusLangsInput): Promise<BinderRow> {
  const { data, error } = await supabaseClient
    .from("user_binders")
    .update({ focus_langs: focusLangs, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(binderColumns)
    .single();
  throwIfError(error);
  return requireData(data, "Supabase returned no binder after focus language update.");
}

export async function deleteBinder({
  supabaseClient,
  id,
}: DeleteBinderInput): Promise<void> {
  const { error } = await supabaseClient
    .from("user_binders")
    .delete()
    .eq("id", id);
  throwIfError(error);
}

export async function getBinder({
  supabaseClient,
  id,
}: GetBinderInput): Promise<BinderRow> {
  const { data, error } = await supabaseClient
    .from("user_binders")
    .select(binderColumns)
    .eq("id", id)
    .single();
  throwIfError(error);
  return requireData(data, `Supabase returned no binder for id ${id}.`);
}

export async function listBinderDocs({
  supabaseClient,
  binderId,
}: ListBinderDocsInput): Promise<BinderDocRow[]> {
  const { data, error } = await supabaseClient
    .from("user_binder_docs")
    .select(binderDocColumns)
    .eq("binder_id", binderId)
    .order("name", { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listBinderDocL10nCaches({
  supabaseClient,
  docIds,
  lang,
}: ListBinderDocL10nCachesInput): Promise<BinderDocL10nCacheRow[]> {
  if (docIds.length === 0) return [];

  const { data, error } = await supabaseClient
    .from("cache_binder_doc_l10ns")
    .select(binderDocL10nCacheColumns)
    .eq("lang", lang)
    .in("doc_id", docIds);
  throwIfError(error);
  return data ?? [];
}

export async function upsertBinderDocL10nCaches({
  supabaseClient,
  rows,
}: UpsertBinderDocL10nCachesInput): Promise<BinderDocL10nCacheRow[]> {
  if (rows.length === 0) return [];

  const now = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("cache_binder_doc_l10ns")
    .upsert(
      rows.map((row) => ({ ...row, updated_at: now })),
      { onConflict: "lang,doc_id" },
    )
    .select(binderDocL10nCacheColumns);
  throwIfError(error);
  return data ?? [];
}

export async function createBinderDoc({
  supabaseClient,
  binder_id,
  name,
  text,
}: CreateBinderDocInput): Promise<BinderDocRow> {
  const { data, error } = await supabaseClient
    .from("user_binder_docs")
    .insert({ binder_id, name: name.trim(), text })
    .select(binderDocColumns)
    .single();
  throwIfError(error);
  return requireData(data, "Supabase returned no binder doc after insert.");
}

export async function updateBinderDoc({
  supabaseClient,
  id,
  values,
}: UpdateBinderDocInput): Promise<BinderDocRow> {
  const payload = {
    ...values,
    name: values.name?.trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("user_binder_docs")
    .update(payload)
    .eq("id", id)
    .select(binderDocColumns)
    .single();
  throwIfError(error);
  return requireData(data, "Supabase returned no binder doc after update.");
}

export async function deleteBinderDoc({
  supabaseClient,
  id,
}: DeleteBinderDocInput): Promise<void> {
  const { error } = await supabaseClient
    .from("user_binder_docs")
    .delete()
    .eq("id", id);
  throwIfError(error);
}
