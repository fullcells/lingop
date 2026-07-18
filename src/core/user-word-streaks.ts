export type WordStreaksForLang = Record<string, number>;

export type UserWordStreaksByLang = Record<string, WordStreaksForLang>;

export type SBUserWordStreaks = {
  user_id: string;
  lang: string;
  word_streaks: WordStreaksForLang;
  updated_at: string;
};

type SupabaseError = { message?: string } | unknown | null;

type UserWordStreaksQueryResult = {
  data: unknown[] | null;
  error: SupabaseError;
};

export type SupabaseUserWordStreaksQuery =
  PromiseLike<UserWordStreaksQueryResult> & {
    eq(column: string, value: unknown): SupabaseUserWordStreaksQuery;
    select(columns?: string): PromiseLike<UserWordStreaksQueryResult>;
  };

export type SupabaseUserWordStreaksClient = {
  from(table: "user_word_streaks"): {
    select(columns: string): SupabaseUserWordStreaksQuery;
    upsert(values: Record<string, unknown>): SupabaseUserWordStreaksQuery;
  };
  auth?: {
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

export const userWordStreaksColumns =
  "user_id, lang, word_streaks, updated_at";

function errorMessage(error: SupabaseError): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return JSON.stringify(error);
}

async function resolveSupabaseUserID({
  supabaseClient,
  supabaseUserID,
}: {
  supabaseClient: SupabaseUserWordStreaksClient;
  supabaseUserID?: string | undefined;
}): Promise<string | null> {
  if (supabaseUserID) return supabaseUserID;

  const userResult = await supabaseClient.auth?.getUser?.();
  return userResult?.data.user?.id ?? null;
}

function isSBUserWordStreaks(data: unknown): data is SBUserWordStreaks {
  return (
    data !== null &&
    typeof data === "object" &&
    typeof (data as SBUserWordStreaks).user_id === "string" &&
    typeof (data as SBUserWordStreaks).lang === "string" &&
    typeof (data as SBUserWordStreaks).updated_at === "string" &&
    (data as SBUserWordStreaks).word_streaks !== null &&
    typeof (data as SBUserWordStreaks).word_streaks === "object" &&
    !Array.isArray((data as SBUserWordStreaks).word_streaks)
  );
}

export function setWordStreaksToValue(
  current: WordStreaksForLang | undefined,
  words: string[],
  streakValue: number,
): WordStreaksForLang {
  return {
    ...current,
    ...Object.fromEntries(words.map((word) => [word.toUpperCase(), streakValue])),
  };
}

export function setWordStreaksByDelta(
  current: WordStreaksForLang | undefined,
  wordStreakDeltas: { word: string; streakDelta: number }[],
): WordStreaksForLang {
  const updatedLang = { ...current };

  for (const { word, streakDelta } of wordStreakDeltas) {
    const WORD = word.toUpperCase();
    let streakValue = (updatedLang[WORD] ?? 0) + streakDelta;
    streakValue = Math.max(0, Math.min(100, streakValue));
    updatedLang[WORD] = streakValue;
  }

  return updatedLang;
}

export function deleteWordStreaks(
  current: WordStreaksForLang | undefined,
  words: string[],
): WordStreaksForLang {
  // Deletes all Words that case-insensitively match.
  const normalizedWords = new Set(words.map((word) => word.toUpperCase()));
  return Object.fromEntries(
    Object.entries(current ?? {}).filter(
      ([word]) => !normalizedWords.has(word.toUpperCase()),
    ),
  );
}

export function setWordStreaksToMin1(
  current: WordStreaksForLang | undefined,
  words: string[],
): { wordStreaks: WordStreaksForLang; newWords: string[] } {
  const wordStreaks = current ?? {};
  const WORDS = words.map((word) => word.toUpperCase());
  const coveredWords = Object.keys(wordStreaks);
  const newWords = WORDS.filter((WORD) => !coveredWords.includes(WORD));

  if (newWords.length === 0) return { wordStreaks, newWords };

  return {
    wordStreaks: setWordStreaksToValue(wordStreaks, newWords, 1),
    newWords,
  };
}

export function areWordStreaksDifferent(
  a: WordStreaksForLang,
  b: WordStreaksForLang,
): boolean {
  return (
    Object.keys(a).length !== Object.keys(b).length ||
    Object.entries(a).some(([word, streak]) => b[word] !== streak)
  );
}

export async function getSBUserWordStreaksForLang({
  supabaseClient,
  supabaseUserID,
  lang,
}: {
  supabaseClient: SupabaseUserWordStreaksClient;
  supabaseUserID?: string | undefined;
  lang: string;
}): Promise<SBUserWordStreaks | null> {
  const userID = await resolveSupabaseUserID({ supabaseClient, supabaseUserID });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return null;
  }

  const { data, error } = await supabaseClient
    .from("user_word_streaks")
    .select(userWordStreaksColumns)
    .eq("lang", lang)
    .eq("user_id", userID);

  if (error) {
    console.error("Error getting user_word_streaks:", errorMessage(error));
    return null;
  }

  const row = data?.[0];
  return isSBUserWordStreaks(row) ? row : null;
}

export async function upsertSBUserWordStreaksForLang({
  supabaseClient,
  supabaseUserID,
  lang,
  wordStreaks,
}: {
  supabaseClient: SupabaseUserWordStreaksClient;
  supabaseUserID?: string | undefined;
  lang: string;
  wordStreaks: WordStreaksForLang;
}): Promise<SBUserWordStreaks | null> {
  const userID = await resolveSupabaseUserID({ supabaseClient, supabaseUserID });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return null;
  }

  const row: SBUserWordStreaks = {
    user_id: userID,
    lang,
    word_streaks: wordStreaks,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("user_word_streaks")
    .upsert(row)
    .select(userWordStreaksColumns);

  if (error) {
    console.error("Error upserting user_word_streaks:", errorMessage(error));
    return null;
  }

  const returnedRow = data?.[0];
  return isSBUserWordStreaks(returnedRow) ? returnedRow : row;
}
