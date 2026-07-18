export type SupabaseClientLike = unknown;

export type SupabaseQueryResult<T = unknown[]> = {
  data: T | null;
  error: unknown | null;
  count?: number | null;
};

export type SupabaseQueryLike<T = unknown[]> =
  PromiseLike<SupabaseQueryResult<T>> & {
    eq(column: string, value: unknown): SupabaseQueryLike<T>;
    ilike(column: string, value: string): SupabaseQueryLike<T>;
    in(column: string, values: unknown[]): SupabaseQueryLike<T>;
    is(column: string, value: unknown): SupabaseQueryLike<T>;
    order(column: string, options?: { ascending?: boolean }): SupabaseQueryLike<T>;
    range(from: number, to: number): SupabaseQueryLike<T>;
    select(columns?: string): SupabaseQueryLike<T>;
    single(): PromiseLike<SupabaseQueryResult<T extends Array<infer U> ? U : T>>;
  };

export type SupabaseTableLike<T = unknown[]> = {
  select(
    columns: string,
    options?: { count?: "exact"; head?: boolean },
  ): SupabaseQueryLike<T>;
  insert(values: Record<string, unknown>): SupabaseQueryLike<T>;
  update(values: Record<string, unknown>): SupabaseQueryLike<T>;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): SupabaseQueryLike<T>;
  delete(): SupabaseQueryLike<unknown[]>;
};

export type SupabaseRuntimeClient = {
  from(table: string): SupabaseTableLike;
  auth?: {
    getSession?: () => Promise<{
      data: {
        session: {
          access_token: string;
        } | null;
      };
      error?: unknown;
    }>;
    getUser?: () => Promise<{
      data: {
        user: {
          id: string;
        } | null;
      };
      error?: unknown;
    }>;
  };
};

export function asSupabaseRuntimeClient(
  supabaseClient: SupabaseClientLike | null | undefined,
): SupabaseRuntimeClient | null {
  return (supabaseClient ?? null) as SupabaseRuntimeClient | null;
}
