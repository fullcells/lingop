export type TranslationInput = {
  source_lang: string;
  source_text: string;
  target_lang: string;
};

export type APIEditTranslationInput = {
  existing_id: string;
  existing_translator: string;
  new_target_text: string;
  // Future: new_translator, for multiple AI translator types and user edit history.
};

// Used by extract-oat and older server-only translation flows. Newer sites should
// prefer TranslationRow for reusable translation caches.
export type TranslationData = {
  id: string;
  target_text: string;
  ref: any | null;
  created_at: any;
  translator: string;
};

// Used by newer sites for flatter, reusable translation cache storage.
export type TranslationRow = {
  id: number;
  source_lang: string;
  source_text: string;
  target_lang: string;
  target_text: string;
  owner_id: string;
  created_at: string;
  translator: string;
  ref: any | null;
};

export type TranslationDbRef = {
  db?: {
    table?: unknown;
    column?: unknown;
    id?: unknown;
  };
  [key: string]: unknown;
};

export type SupabaseTranslationQueryResult = {
  data: unknown[] | null;
  error: unknown | null;
};

export type SupabaseTranslationQuery =
  PromiseLike<SupabaseTranslationQueryResult> & {
    eq(column: string, value: unknown): SupabaseTranslationQuery;
    in(column: string, values: unknown[]): SupabaseTranslationQuery;
  };

export type SupabaseTranslationUpdateQuery =
  PromiseLike<SupabaseTranslationQueryResult> & {
    eq(column: string, value: unknown): SupabaseTranslationUpdateQuery;
    select(columns?: string): PromiseLike<SupabaseTranslationQueryResult>;
  };

export type SupabaseTranslationClient = {
  from(table: "translations"): {
    select(columns: string): SupabaseTranslationQuery;
    update(values: Record<string, unknown>): SupabaseTranslationUpdateQuery;
  };
  auth?: {
    getSession(): Promise<{
      data: {
        session: {
          access_token: string;
        } | null;
      };
      error?: unknown;
    }>;
  };
};
