import { generateEmoji, type SupabaseEmojiClient } from "./emojify.js";
import { ilike } from "./misc.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike } from "./supabase.js";
import type { OneWayWordExplicitations } from "./word-explicitations.js";

export type SBWordRow2 = {
  id: number;
  word_lang: string;
  word: string;
  gloss: string;
  gloss_lang: string;
  is_core: boolean;
  created_at: string;
  is_human_verified: boolean;
};

export type GlossOutputData = {
  targetWord: string;
  is_human_verified: boolean;
};

export type SupabaseSBWordsClient = SupabaseClientLike;

const SB_WORDS_COLUMNS =
  "id, word_lang, word, gloss, gloss_lang, is_core, created_at, is_human_verified";
const SB_WORDS_BATCH_SIZE = 1000;

// 1. NONCORE WORDS (0.5% the size of SBWords - so loaded first)
let nonCoreWordsPromise: Promise<SBWordRow2[]> | undefined;

// 2. CORE WORDS
let sbWordsCache: SBWordRow2[] = [];
const sbWordsCacheLoadedLangDirs: Set<string> = new Set();
const inflightFetchesForSbWordsByLangDir: Record<string, Promise<SBWordRow2[]>> = {};

export function clearSBWordsCache(): void {
  nonCoreWordsPromise = undefined;
  sbWordsCache = [];
  sbWordsCacheLoadedLangDirs.clear();
  for (const langDir of Object.keys(inflightFetchesForSbWordsByLangDir)) {
    delete inflightFetchesForSbWordsByLangDir[langDir];
  }
}

function langDirKey(word_lang: string, gloss_lang: string): string {
  return word_lang + "→" + gloss_lang;
}

// 1. NONCORE WORDS LOADING
export async function loadNonCoreWords({
  supabaseClient,
}: {
  supabaseClient?: SupabaseSBWordsClient | undefined;
} = {}): Promise<SBWordRow2[]> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (nonCoreWordsPromise) return nonCoreWordsPromise;

  nonCoreWordsPromise = (async () => {
    if (!runtimeSupabaseClient) {
      console.error("A Supabase client is required to load SBWords.");
      return [];
    }

    // 1. Load from Supabase
    const entries: SBWordRow2[] = [];
    let i = 0;
    while (true) {
      const { data, error } = await runtimeSupabaseClient
        .from("words2")
        .select(SB_WORDS_COLUMNS)
        .is("is_core", false)
        .order("id", { ascending: true })
        .range(i, i + SB_WORDS_BATCH_SIZE - 1);
      if (error) {
        console.error("Error getting sb data:", error);
        break;
      }
      const rows = (data ?? []).filter(isSBWordRow2);
      entries.push(...rows); // Add Entries
      if (rows.length < SB_WORDS_BATCH_SIZE) break; // Stop or Continue
      i += SB_WORDS_BATCH_SIZE;
    }
    // console.log(`🔹 initialized SBWords' NonCoreWords (all langs):`, entries);
    // Update sbWordsCache with nonCoreWords
    sbWordsCache = [...sbWordsCache, ...entries];
    // Return NonCoreWords
    return entries;
  })();

  return nonCoreWordsPromise;
}

export async function isNotCoreWord(
  word_lang: string,
  word: string,
  gloss?: string,
  {
    supabaseClient,
}: {
  supabaseClient?: SupabaseSBWordsClient | undefined;
} = {},
): Promise<boolean> {
  // 1. NonCore Word denoted by affix marker "‿" (KO)
  if (word.startsWith("‿")) return true;
  if (word.endsWith("‿")) return true;

  // 1b. NonCore based on Gloss
  if (gloss) {
    if (gloss.startsWith("ᴄʟ")) return true;
    const isAllSmallCaps = (s: string) =>
      [...s].every(
        (c) => /\p{P}/u.test(c) || "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ".includes(c),
      );
    if (isAllSmallCaps(gloss)) return true;
    if (gloss.startsWith("(") && gloss.endsWith(")")) return true;
  }

  // 2. NonCore Word defined by SB
  const nonCoreWords: SBWordRow2[] = await loadNonCoreWords({
    supabaseClient,
  });
  const nonCoreMatch: SBWordRow2 | undefined = nonCoreWords.find(
    (r) => ilike(r.word_lang, word_lang) && ilike(r.word, word),
  );
  if (nonCoreMatch) return true;
  return false;
}

// 2. ALL WORDS LOADING (INCLUDING CORE WORDS)
export async function getSBWordsForLangDir(
  word_lang: string,
  gloss_lang: string,
  {
    supabaseClient,
}: {
  supabaseClient?: SupabaseSBWordsClient | undefined;
} = {},
): Promise<SBWordRow2[]> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  const langDir: string = langDirKey(word_lang, gloss_lang);
  // 0. Ensure NonCore Words are loaded
  await loadNonCoreWords({ supabaseClient });
  // A.
  if (sbWordsCacheLoadedLangDirs.has(langDir)) {
    return sbWordsCache.filter(
      (r) => r.word_lang == word_lang && r.gloss_lang == gloss_lang,
    );
  }
  // B1.
  if (!inflightFetchesForSbWordsByLangDir[langDir]) {
    async function fetchAndCache() {
      if (!runtimeSupabaseClient) {
        console.error("A Supabase client is required to load SBWords.");
        return sbWordsCache.filter(
          (r) => r.word_lang == word_lang && r.gloss_lang == gloss_lang,
        );
      }

      // 1. Load from Supabase (needs to do bulk/batch)
      const entries: SBWordRow2[] = [];
      let i = 0;
      while (true) {
        const { data, error } = await runtimeSupabaseClient
          .from("words2")
          .select(SB_WORDS_COLUMNS)
          .eq("word_lang", word_lang)
          .eq("gloss_lang", gloss_lang)
          .is("is_core", true) // Only getting Core Words, since NonCore should've been gotten already.
          .order("id", { ascending: true })
          .range(i, i + SB_WORDS_BATCH_SIZE - 1);
        if (error) {
          console.error("Error getting sb data:", error);
          return sbWordsCache.filter(
            (r) => r.word_lang == word_lang && r.gloss_lang == gloss_lang,
          );
        }
        const rows = (data ?? []).filter(isSBWordRow2);
        entries.push(...rows); // Add Entries
        if (rows.length < SB_WORDS_BATCH_SIZE) break; // Stop or Continue
        i += SB_WORDS_BATCH_SIZE;
      }

      // 2. setSbWordsCache
      sbWordsCache = [...sbWordsCache, ...entries];
      console.log(`🔵 initialized SBWords' CoreWords For LangDir:`, word_lang, gloss_lang, entries);

      // 3. Return SBWords for WordLang
      return sbWordsCache.filter(
        (r) => r.word_lang == word_lang && r.gloss_lang == gloss_lang,
      );
    }
    inflightFetchesForSbWordsByLangDir[langDir] = fetchAndCache().finally(() => {
      delete inflightFetchesForSbWordsByLangDir[langDir];
      sbWordsCacheLoadedLangDirs.add(langDir);
    });
  }
  // B2.
  return inflightFetchesForSbWordsByLangDir[langDir];
}

// --------------------------------------------------------------------------

export async function refreshCoreSBWordsCache(
  word_lang: string,
  gloss_lang: string,
  {
    supabaseClient,
  }: {
    supabaseClient?: SupabaseSBWordsClient | undefined;
  } = {},
): Promise<void> {
  const langDir: string = langDirKey(word_lang, gloss_lang);

  // 1. Remove stale core entries for this langDir
  sbWordsCache = sbWordsCache.filter(
    (r) => !(r.word_lang == word_lang && r.gloss_lang == gloss_lang && r.is_core),
  );
  sbWordsCacheLoadedLangDirs.delete(langDir);

  // 2. Re-fetch
  await getSBWordsForLangDir(word_lang, gloss_lang, {
    supabaseClient,
  });

  console.log(`🔄 refreshed FE SBWords' CoreWords For LangDir:`, word_lang, gloss_lang);
}

// --------------------------------------------------------------------------

export async function fetchAndGenGloss(
  {
    source_lang,
    source_word,
    target_lang,
  }: { source_lang: string; source_word: string; target_lang: string },
  {
    supabaseClient,
    getOneWayWordExplicitations,
    generateEmojiForGloss,
    requestFetch = globalThis.fetch?.bind(globalThis),
  }: {
    supabaseClient?: SupabaseSBWordsClient | undefined;
    getOneWayWordExplicitations(input: {
      source_lang: string;
      source_word: string;
      target_lang: string;
    }): Promise<OneWayWordExplicitations>;
    generateEmojiForGloss(en_gloss: string): Promise<string | null>;
    requestFetch?: typeof fetch | undefined;
  },
): Promise<GlossOutputData | null> {
  // (Note: 'Gloss' here is used in the abstract sense (meaning a 1:1 Word Translation) - rather than the '(en)Gloss' inside sbWords) - Better named as 'fetchNGenWordTranslation'
  // console.log('fetchAndGenGloss …', source_lang, source_word, target_lang);
  if (source_lang == target_lang) {
    return { targetWord: source_word, is_human_verified: true };
  }

  if (!ilike(source_lang, "en") && !ilike(target_lang, "en")) {
    console.error("fetchAndGenGloss requires source_lang/target_lang to be 'en' atm.");
    return null;
  }

  // 1. Explicitations Matches // Examples here: {source_lang: en, source_word: enGloss, target_lang: wordLang}
  // - i. When Multiple NonEn-WordSenses, for a Single En-WordSense:
  // -- ESL JA-Speakers: brother → 弟 / 兄 / お兄さん
  // -- ESL YUE-Speakers: brother → 哥哥 / 弟弟 | they → 佢 / 佢哋
  // - ii. When NonEn-Explicitations Exists: Show it. Show it emojified. (Combos with [i])
  // -- ESL YUE-Speakers: he → 佢 [♂]
  const oneWayWordExplicitations: OneWayWordExplicitations =
    await getOneWayWordExplicitations({
      source_lang,
      source_word,
      target_lang,
    });
  if (oneWayWordExplicitations.rows.length > 0) {
    // Create a Single Gloss // e.g. """哥哥 / 弟弟"""
    const targetWords: string[] = [];
    for (let i = 0; i < oneWayWordExplicitations.rows.length; i++) {
      const r = oneWayWordExplicitations.rows[i]!;
      const wordSense: string = r.word_sense;
      const wordExplicitations: string[] | null = r.explicitations;
      let wordExplicitationsPrint = "";
      if ((wordExplicitations || []).length > 0) {
        wordExplicitationsPrint = `[${wordExplicitations!.join(",")}]`;
        wordExplicitationsPrint = (await generateEmojiForGloss(wordExplicitationsPrint)) ?? "";
        wordExplicitationsPrint = " " + wordExplicitationsPrint;
      }
      const print: string = [wordSense, wordExplicitationsPrint].join("");
      targetWords.push(print);
    }
    const langGloss: string = targetWords.join(" / ");
    return { targetWord: langGloss, is_human_verified: true };
  }

  // 2. Standard SB.Word based Word
  const sbWord: SBWordRow2 | null = await directlyFetchAndGenSBWord(
    {
      source_lang,
      source_word,
      target_lang,
    },
    { supabaseClient, requestFetch },
  );
  if (!sbWord) return null;
  // console.log('fetchAndGenGloss: 2. Standard: directlyFetchAndGenSBWord:', 'INPUT:', source_lang, source_word, target_lang, 'OUTPUT:', sbWord);

  // A.
  // const targetWord:string = ilike(source_lang,'en') ? sbWord.gloss : sbWord.word; // Note: This was previously reversed, it also no longer works because sb.WORDS2 now supports 2 directions (instead of 1 direction which this was originally based on).
  // B.
  const targetWord: string = sbWord.word_lang == target_lang ? sbWord.word : sbWord.gloss; // This is because sbWord can be in either direction now that 'word_lang' and 'gloss_lang' has been introduced. // <- This should now be redundant with 'directlyFetchAndGenSBWord' updated. i.e. (sb.word_lang == target_lang) should ALWAYS be false and hence return sbWord.gloss .

  return {
    targetWord: targetWord,
    is_human_verified: sbWord.is_human_verified,
  };
}

export async function directlyFetchAndGenSBWord(
  {
    source_lang,
    source_word,
    target_lang,
  }: { source_lang: string; source_word: string; target_lang: string },
  {
    supabaseClient,
    requestFetch = globalThis.fetch?.bind(globalThis),
  }: {
    supabaseClient?: SupabaseSBWordsClient | undefined;
    requestFetch?: typeof fetch | undefined;
  } = {},
): Promise<SBWordRow2 | null> {
  // console.log('directlyFetchAndGenSBWord', source_lang, source_word, target_lang);
  if (!ilike(source_lang, "en") && !ilike(target_lang, "en")) {
    console.error("directlyFetchAndGenSBWord requires source_lang/target_lang to be 'en' atm.");
    return null;
  }

  const findPriorityRows = (
    rows: SBWordRow2[],
    isLowercaseTarget: (r: SBWordRow2) => boolean,
  ): SBWordRow2[] => {
    if (!rows.length) return [];
    const verified = rows.filter((r) => r.is_human_verified);
    // Prioritize B: 1. verified + lowercase, 2. verified, 3. lowercase, 4. any.
    const levels = [verified.filter(isLowercaseTarget), verified, rows.filter(isLowercaseTarget), rows];
    return levels.find((candidates) => candidates.length > 0) ?? [];
  };

  // 0. Normal Direction Attempt
  const sbWordRows_normDir: SBWordRow2[] = await getSBWordsForLangDir(
    source_lang,
    target_lang,
    { supabaseClient },
  );
  const cacheMatches_normDir: SBWordRow2[] = sbWordRows_normDir.filter((r) =>
    ilike(source_word, r.word),
  );
  if (cacheMatches_normDir.length) {
    // - Note: Future: May handle things differently when sourceLangIsEN vs when targetLangIsEN.
    // RETURN NormDir Row if available.
    const normDirRowsAt1stPriorityLvl = findPriorityRows(
      cacheMatches_normDir,
      (r) => r.gloss === r.gloss.toLowerCase(),
    );
    if (normDirRowsAt1stPriorityLvl.length > 0) return normDirRowsAt1stPriorityLvl[0]!;
  }

  // 1. Reverse Direction Attempt // Commented since a SB.WORDS2 Data Update should've handled this. // Keep code here a few weeks just in case it's needed. - 20260415
  // const sbWordRows_reverse:SBWordRow2[] = await getSBWordsForLangDir(target_lang, source_lang);
  // const cacheMatches_reverse:SBWordRow2[] = sbWordRows_reverse.filter(r => ilike(source_word, r.gloss));
  // if (cacheMatches_reverse.length) {
  // 	const reverseRowsAt1stPriorityLvl:SBWordRow2[] = findPriorityRows(cacheMatches_reverse, r => r.word  === r.word.toLowerCase());
  // 	// 1B. IF ReverseRows is EXACTLY ONE IF (whether it's 1. verified + lowercase, 2. verified, 3. lowercase, 4. any.) THEN PREPARE TO RETURN THAT. RETURN.
  // 	if (reverseRowsAt1stPriorityLvl.length === 1) {
  // 		// Need to call an admin level "/api/sb-reverse-fork-sb-word" - then use that in the return (as opposed to doing '2') // <- technically though, a SB query should've already been run to update all these.
  // 	}
  // }

  if (!requestFetch) {
    console.error("A fetch implementation is required to create SBWords.");
    return null;
  }

  // 2. Create New Gloss (via translate) and SB.Words Upsert
  const fetchUrl: string = `/api/sb-translate-and-upsert-sbword`; // uses BE:/translate-create-limited-anon
  const res = await requestFetch(fetchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_lang,
      source_word,
      target_lang,
    }),
  });
  if (!res.ok) {
    const data = await res.json();
    console.error("/api/sb-translate-and-upsert-sbword error:", data.error);
    return null;
  }
  const data = await res.json();
  const sbWordRow: SBWordRow2 | null = isSBWordRow2(data) ? data : null;
  if (!sbWordRow) return null;

  // 3. Upsert Locally
  sbWordsCache = [
    // remove any entries where lang+word+gloss matches the upsertedSBWord
    ...sbWordsCache.filter(
      (entry) =>
        !(
          entry.word_lang === sbWordRow.word_lang &&
          entry.word === sbWordRow.word &&
          entry.gloss === sbWordRow.gloss &&
          entry.gloss_lang === sbWordRow.gloss_lang
        ),
    ),
    // insert the upserted word at the end
    sbWordRow,
  ];

  return sbWordRow;
}

export async function generateEmojiUsingSBWords(
  en_gloss: string,
  {
    supabaseClient,
  }: {
    supabaseClient?: (SupabaseSBWordsClient & SupabaseEmojiClient) | undefined;
  } = {},
): Promise<string | null> {
  return generateEmoji(en_gloss, undefined, undefined, {
    supabaseClient,
    isNotCoreWord: (word_lang, word, gloss) =>
      isNotCoreWord(word_lang, word, gloss, { supabaseClient }),
  });
}

function isSBWordRow2(row: unknown): row is SBWordRow2 {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Partial<SBWordRow2>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.word_lang === "string" &&
    typeof candidate.word === "string" &&
    typeof candidate.gloss === "string" &&
    typeof candidate.gloss_lang === "string" &&
    typeof candidate.is_core === "boolean" &&
    typeof candidate.created_at === "string" &&
    typeof candidate.is_human_verified === "boolean"
  );
}
