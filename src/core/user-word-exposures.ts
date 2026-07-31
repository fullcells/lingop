import {
  asSupabaseRuntimeClient,
  type SupabaseClientLike,
  type SupabaseRuntimeClient,
} from "./supabase.js";

export type SBUserWordExposure = {
  id: number;
  user_id: string;
  word_lang: string;
  word: string;
  user_gloss: string;
  user_gloss_lang: string;
  exposures: number;
  recent_exposures: string[];
  created_at: string;
};

export type SupabaseUserWordExposuresClient = SupabaseClientLike;

export const userWordExposureColumns =
  "id, user_id, word_lang, word, user_gloss, user_gloss_lang, exposures, recent_exposures, created_at";

type SupabaseError = { message?: string } | unknown | null;

type WordExposureKey = {
  word_lang: string;
  word: string;
  user_gloss_lang: string;
};

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
  supabaseClient: SupabaseRuntimeClient;
  supabaseUserID?: string | undefined;
}): Promise<string | null> {
  if (supabaseUserID) return supabaseUserID;

  const userResult = await supabaseClient.auth?.getUser?.();
  return userResult?.data.user?.id ?? null;
}

function isSBUserWordExposure(data: unknown): data is SBUserWordExposure {
  return (
    data !== null &&
    typeof data === "object" &&
    typeof (data as SBUserWordExposure).id === "number" &&
    typeof (data as SBUserWordExposure).user_id === "string" &&
    typeof (data as SBUserWordExposure).word_lang === "string" &&
    typeof (data as SBUserWordExposure).word === "string" &&
    typeof (data as SBUserWordExposure).user_gloss === "string" &&
    typeof (data as SBUserWordExposure).user_gloss_lang === "string" &&
    Number.isInteger((data as SBUserWordExposure).exposures) &&
    Array.isArray((data as SBUserWordExposure).recent_exposures) &&
    (data as SBUserWordExposure).recent_exposures.every(
      (exposure) => typeof exposure === "string",
    ) &&
    typeof (data as SBUserWordExposure).created_at === "string"
  );
}

async function getExactWORDExposureRow({
  supabaseClient,
  supabaseUserID,
  word_lang,
  word,
  user_gloss_lang,
}: {
  supabaseClient: SupabaseUserWordExposuresClient;
  supabaseUserID?: string | undefined;
} & WordExposureKey): Promise<SBUserWordExposure | null> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load a word exposure.");
    return null;
  }

  const userID = await resolveSupabaseUserID({
    supabaseClient: runtimeSupabaseClient,
    supabaseUserID,
  });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return null;
  }

  const { data, error } = await runtimeSupabaseClient
    .from("user_word_exposures")
    .select(userWordExposureColumns)
    .eq("user_id", userID)
    .eq("user_gloss_lang", user_gloss_lang)
    .eq("word_lang", word_lang)
    .ilike("word", word);

  if (error) {
    console.error("Error getting user_word_exposures:", errorMessage(error));
    return null;
  }

  const row = data?.[0];
  return isSBUserWordExposure(row) ? row : null;
}

export async function createWordExposureRow({
  supabaseClient,
  supabaseUserID,
  word_lang,
  word,
  user_gloss_lang,
  user_gloss,
}: {
  supabaseClient: SupabaseUserWordExposuresClient;
  supabaseUserID?: string | undefined;
  word_lang: string;
  word: string;
  user_gloss_lang: string;
  user_gloss: string;
}): Promise<SBUserWordExposure | null> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to create a word exposure.");
    return null;
  }

  const userID = await resolveSupabaseUserID({
    supabaseClient: runtimeSupabaseClient,
    supabaseUserID,
  });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return null;
  }

  const { data: matchingRows, error: matchingError } =
    await runtimeSupabaseClient
      .from("user_word_exposures")
      .select("id")
      .eq("user_id", userID)
      .eq("user_gloss_lang", user_gloss_lang)
      .eq("word_lang", word_lang)
      .ilike("word", word);

  if (matchingError) {
    console.error(
      "Error checking user_word_exposures:",
      errorMessage(matchingError),
    );
    return null;
  }
  if (matchingRows && matchingRows.length > 0) {
    console.error(
      "A case-insensitive matching user_word_exposures row already exists.",
    );
    return null;
  }

  const row = {
    user_id: userID,
    word_lang,
    word,
    user_gloss_lang,
    user_gloss,
    exposures: 0,
    recent_exposures: [],
  };
  const { data, error } = await runtimeSupabaseClient
    .from("user_word_exposures")
    .insert(row)
    .select(userWordExposureColumns);

  if (error) {
    console.error("Error creating user_word_exposures:", errorMessage(error));
    return null;
  }

  const createdRow = data?.[0];
  return isSBUserWordExposure(createdRow) ? createdRow : null;
}

export async function addWORDExposureNow({
  supabaseClient,
  supabaseUserID,
  word_lang,
  word,
  user_gloss_lang,
}: {
  supabaseClient: SupabaseUserWordExposuresClient;
  supabaseUserID?: string | undefined;
} & WordExposureKey): Promise<SBUserWordExposure | null> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to update a word exposure.");
    return null;
  }

  const userID = await resolveSupabaseUserID({
    supabaseClient: runtimeSupabaseClient,
    supabaseUserID,
  });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentRow = await getExactWORDExposureRow({
      supabaseClient: runtimeSupabaseClient,
      supabaseUserID: userID,
      word_lang,
      word,
      user_gloss_lang,
    });
    if (!currentRow) return null;

    const now = new Date().toISOString();
    const updates = {
      exposures: currentRow.exposures + 1,
      recent_exposures: [now, ...currentRow.recent_exposures].slice(0, 10),
    };
    const { data, error } = await runtimeSupabaseClient
      .from("user_word_exposures")
      .update(updates)
      .eq("id", currentRow.id)
      .eq("user_id", userID)
      .eq("exposures", currentRow.exposures)
      .select(userWordExposureColumns);

    if (error) {
      console.error("Error updating user_word_exposures:", errorMessage(error));
      return null;
    }

    const updatedRow = data?.[0];
    if (isSBUserWordExposure(updatedRow)) return updatedRow;
  }

  console.error(
    "Could not update user_word_exposures after concurrent changes.",
  );
  return null;
}

export async function deleteWORDExposureRow({
  supabaseClient,
  supabaseUserID,
  word_lang,
  word,
  user_gloss_lang,
}: {
  supabaseClient: SupabaseUserWordExposuresClient;
  supabaseUserID?: string | undefined;
} & WordExposureKey): Promise<boolean> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to delete a word exposure.");
    return false;
  }

  const userID = await resolveSupabaseUserID({
    supabaseClient: runtimeSupabaseClient,
    supabaseUserID,
  });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return false;
  }

  const { data, error } = await runtimeSupabaseClient
    .from("user_word_exposures")
    .delete()
    .eq("user_id", userID)
    .eq("user_gloss_lang", user_gloss_lang)
    .eq("word_lang", word_lang)
    .ilike("word", word)
    .select("id");

  if (error) {
    console.error("Error deleting user_word_exposures:", errorMessage(error));
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function getWORDExposureRow({
  supabaseClient,
  supabaseUserID,
  word_lang,
  word,
}: {
  supabaseClient: SupabaseUserWordExposuresClient;
  supabaseUserID?: string | undefined;
  word_lang: string;
  word: string;
}): Promise<SBUserWordExposure | null> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load a word exposure.");
    return null;
  }

  const userID = await resolveSupabaseUserID({
    supabaseClient: runtimeSupabaseClient,
    supabaseUserID,
  });
  if (!userID) {
    console.error("Supabase User Id not found.");
    return null;
  }

  const { data, error } = await runtimeSupabaseClient
    .from("user_word_exposures")
    .select(userWordExposureColumns)
    .eq("user_id", userID)
    .eq("word_lang", word_lang)
    .ilike("word", word)
    .order("created_at", { ascending: false })
    .range(0, 0);

  if (error) {
    console.error("Error getting user_word_exposures:", errorMessage(error));
    return null;
  }

  const row = data?.[0];
  return isSBUserWordExposure(row) ? row : null;
}
