import { asSupabaseRuntimeClient, type SupabaseClientLike } from "./supabase.js";
import { userWordStreaksColumns, type SBUserWordStreaks, type WordStreaksForLang } from "./user-word-streaks.js";

export type WordStreaksRemote = {
  read(lang: string): Promise<SBUserWordStreaks | null>;
  /** null means another writer changed the row; read again before retrying. */
  compareAndSet(lang: string, previous: SBUserWordStreaks | null, words: WordStreaksForLang): Promise<SBUserWordStreaks | null>;
};

/** Uses existing table/RLS; every operation is bound to this specific account. */
export function createWordStreaksRemote(supabaseClient: SupabaseClientLike, userID: string): WordStreaksRemote {
  const client = asSupabaseRuntimeClient(supabaseClient);
  if (!client) throw new Error("A Supabase client is required.");
  return {
    async read(lang) {
      const { data, error } = await client.from("user_word_streaks")
        .select(userWordStreaksColumns).eq("lang", lang).eq("user_id", userID);
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      const value = row as SBUserWordStreaks;
      if (value.user_id !== userID || value.lang !== lang || typeof value.updated_at !== "string" || !value.word_streaks || typeof value.word_streaks !== "object") {
        throw new Error("Invalid word-streak response.");
      }
      return value;
    },
    async compareAndSet(lang, previous, words) {
      const row = {
        user_id: userID, lang, word_streaks: words,
        updated_at: new Date(Math.max(Date.now(), (Date.parse(previous?.updated_at ?? "") || 0) + 1)).toISOString(),
      };
      const table = client.from("user_word_streaks");
      const query = previous
        ? table.update(row).eq("user_id", userID).eq("lang", lang).eq("updated_at", previous.updated_at)
        : table.insert(row);
      const { data, error } = await query.select(userWordStreaksColumns);
      if (error) {
        if (!previous && (error as { code?: string }).code === "23505") return null;
        throw error;
      }
      return (data?.[0] as SBUserWordStreaks | undefined) ?? null;
    },
  };
}
