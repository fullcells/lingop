// 20250904: Elements of this FE emojify are shared with the BE API english-words-to-emoji. FE emojify (originally a port from CampLingo) here has been updated to use MorphologizeEnWords as opposed to the deprecated 'lemmatizeEnglishWord'. no_emoji_words/study_word/study_lang should be abstracted to a higher 'display-oriented' level.
// 20251015: NOTE: This version is the most up-to-date version of 'emoji.ts'. (BE API english-words-to-emoji - should be updated to this one)

// 20251125: FYI: emojiDataPromise is SINGULAR for each FE BrowserTab the user has open.

import {
  getMorphemeStringsForEnWord,
  type MorphemeStringsByPos,
} from "./morphologize-en-word.js";
import { ilike } from "./misc.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike } from "./supabase.js";

export type EmojiRow = {
  // id: number;
  emoji: string;
  en_gloss: string;
  // created_at: string;
};

export type SupabaseEmojiClient = SupabaseClientLike;

export type IsNotCoreWord = (
  word_lang: string,
  word: string,
  gloss?: string,
) => Promise<boolean>;

const no_emoji_words: { [study_lang: string]: string[] /*study_words*/ } = {
  // - Note: no_emoji_words/study_word/study_lang should be moved higher upstream, in display-oriented code.
  yue: [
    "啊",
    "呀",
    "嘅",
    "過",
  ],
  ja: [
    "お",
    "は",
    "の",
    "を",
    "ます",
    "です",
    "て",
    "ござい",
    "ございます",
    "が",
    "います",
    "あります",
    "に",
    "で",
    "た",
  ],
  es: [
    "le",
  ],
  de: [
    "zu",
    "sein",
  ],
};

const EMOJI_BATCH_SIZE = 1000;

let emojiDataPromise: Promise<EmojiRow[]> | undefined;

async function defaultIsNotCoreWord(): Promise<boolean> {
  return false;
}

export async function loadEmojiData({
  supabaseClient,
  forceRefresh = false,
}: {
  supabaseClient?: SupabaseEmojiClient | undefined;
  forceRefresh?: boolean | undefined;
} = {}): Promise<EmojiRow[]> {
  const runtimeSupabaseClient = asSupabaseRuntimeClient(supabaseClient);
  if (!runtimeSupabaseClient) {
    console.error("A Supabase client is required to load emojis.");
    return [];
  }

  if (!forceRefresh && emojiDataPromise) return emojiDataPromise;

  emojiDataPromise = fetchEmojiData(runtimeSupabaseClient);
  return emojiDataPromise;
}

async function fetchEmojiData(
  supabaseClient: NonNullable<ReturnType<typeof asSupabaseRuntimeClient>>,
): Promise<EmojiRow[]> {
  // Get Total Count
  const { count, error: count_error } = await supabaseClient
    .from("emojis")
    .select("id", { count: "exact", head: true });
  if (count_error || count == null) {
    console.error(count_error);
    return [];
  }
  // console.log('Total Count: emojis:', count);
  // Bulk/Batch/Incremental Select
  const entries: EmojiRow[] = [];
  for (let i = 0; i < count; i += EMOJI_BATCH_SIZE) {
    const { data, error } = await supabaseClient
      .from("emojis")
      .select("emoji, en_gloss")
      .order("id", { ascending: true })
      .range(i, i + EMOJI_BATCH_SIZE - 1);
    if (error) {
      console.log("error", error);
      return [];
    }
    entries.push(...((data ?? []).filter(isEmojiRow)));
  }
  const uppercased_rows = entries.map((row) => ({
    ...row,
    en_gloss: row.en_gloss.toUpperCase(),
  }));
  // console.log("sb.emojis fetched", entries); // Uncomment to reverify this sb.fetch only happens once.
  return uppercased_rows;
}

// 1. `generateEmoji` is the main call root-level call for generating Emojis.
export async function generateEmoji(
  en_gloss: string,
  study_word?: string,
  study_lang?: string,
  {
    supabaseClient,
    isNotCoreWord = defaultIsNotCoreWord,
  }: {
    supabaseClient?: SupabaseEmojiClient | undefined;
    isNotCoreWord?: IsNotCoreWord | undefined;
  } = {},
): Promise<string | null> { // might be better renamed 'determineEmoji' (since 'generate' implies we're actually doing an API call to generate new emoji atm - which we're not)
  const cachedEmojisData: EmojiRow[] = await loadEmojiData({ supabaseClient });
  if (!cachedEmojisData || cachedEmojisData.length == 0) {
    console.error("cachedEmojisData was nonexistent");
    return null;
  }
  if (en_gloss.length == 0) return "";

  return generateEmojiFromRows(en_gloss, cachedEmojisData, {
    study_word,
    study_lang,
    isNotCoreWord,
  });
}

export async function generateEmojiFromRows(
  en_gloss: string,
  cachedEmojisData: EmojiRow[],
  {
    study_word,
    study_lang,
    isNotCoreWord = defaultIsNotCoreWord,
  }: {
    study_word?: string | undefined;
    study_lang?: string | undefined;
    isNotCoreWord?: IsNotCoreWord | undefined;
  } = {},
): Promise<string | null> {
  // 0. IF FOUND IN NO_EMOJI_WORDS LIST, RETURN STUDY_WORD AS IS (e.g. "ja":"は")
  // - Note: no_emoji_words/study_word/study_lang should be moved higher upstream, in display-oriented code.
  if (study_word !== undefined && study_lang !== undefined) {
    if (no_emoji_words[study_lang] && no_emoji_words[study_lang].includes(study_word)) {
      return "\u00A0"; // return an empty space, so it's still editable, and differentiated from "no gloss found / lemmatizedOutput"
    }
  }

  // 1. EXACT-MATCH SEARCH
  const exact_match = findCaseInsensitiveEmojiRowMatch(en_gloss, cachedEmojisData);
  if (exact_match) {
    // console.log('generateEmoji: exact match:', en_gloss, exact_match.emoji);
    return exact_match.emoji;
  }

  // 2. SPLIT BY "/" DASH - Split the en_gloss, then by "word_sense | [explicitation,…]"
  const slashGroups: string[] = en_gloss.split("/").map((g) => g.trim());
  const slashGroupsEmoji: string[] = [];
  for (const slashGroup of slashGroups) {
    // 0. EXACT MATCH CHECK FIRST
    const exact_match = findCaseInsensitiveEmojiRowMatch(slashGroup, cachedEmojisData);
    if (exact_match) {
      slashGroupsEmoji.push(exact_match.emoji);
      continue;
    }

    // 1. Detect EXPLICITATIONS - e.g. "brother [honorific,older]"
    // 20251014: As of today, the introduction of this code no existing gloss uses "[", so the following logic will work.
    const word_sense: string = slashGroup.split("[")[0]!.trim();
    let explicitations_string: string = slashGroup.split("[")[1] || "";
    explicitations_string = explicitations_string.replace(/[\[\]]/g, "");
    let explicitations: string[] = [];
    if (explicitations_string.length) {
      explicitations = explicitations_string.split(",").map((e) => e.trim());
    }

    // 2. STANDARD GENERATE EMOJI ON WORD_SENSE
    const wordSenseEmoji = await generateEmoji_standard2(
      word_sense,
      cachedEmojisData,
      isNotCoreWord,
    );

    // 3. Emojis for EXPLICITATIONS:
    const explicitationsEmojis: string[] = [];
    for (const explicitation of explicitations) {
      // a. Look for Exact Match for Explicitation - with [Square Brackets notation]
      const exactMatch = cachedEmojisData.find(
        (row) => row.en_gloss === `[${explicitation.toUpperCase()}]`,
      );
      if (exactMatch) {
        explicitationsEmojis.push(exactMatch.emoji);
        continue;
      }
      // b. Standard Emoji Search for Explicitation
      const standardEmoji: string = await generateEmoji_standard2(
        explicitation,
        cachedEmojisData,
        isNotCoreWord,
      );
      explicitationsEmojis.push(standardEmoji);
    }
    let explicitationEmojisPrint: string = "";
    if (explicitationsEmojis.length > 0) {
      explicitationEmojisPrint = ` [${explicitationsEmojis.join(",")}]`;
    }

    // 4. Altogether
    const slashGroupEmoji: string = wordSenseEmoji + explicitationEmojisPrint;
    slashGroupsEmoji.push(slashGroupEmoji);
  }

  const output = slashGroupsEmoji.join(" / ");

  return output;
}

// 2. `generateEmoji_standard` is typically Run after splitting gloss by " / " and "[explicitations]"
// - "generateEmoji_standard" can be deprecated shortly after generateEmoji_standard2 (LLM code) has proven itself - 20260413 // generateEmoji_standard2 is same as generateEmoji_standard - except it prioritizes splits in a recursive traversal to find exactMatches. (e.g. to better handle "dad's older-brother")
async function generateEmoji_standard(
  en_gloss: string,
  cachedEmojisData: EmojiRow[],
  isNotCoreWord: IsNotCoreWord,
): Promise<string> {
  // 1. EXACT-MATCH SEARCH FOR GLOSS (e.g. "thank you")
  // - (this is actually also checked in Lemma search below, but we're bringing it up here in case it's faster)
  const exact_match = findCaseInsensitiveEmojiRowMatch(en_gloss, cachedEmojisData);
  if (exact_match) return exact_match.emoji;

  // 2. REPLACE FANCY DELIMS (like -,:,.,+,etc.) AND FIND EXACT MATCHES
  const en_gloss_normDelims: string = en_gloss.replace(/[\-:.+_]+/g, " ");
  const matchOnNormDelims = findCaseInsensitiveEmojiRowMatch(
    en_gloss_normDelims,
    cachedEmojisData,
  );
  if (matchOnNormDelims) return matchOnNormDelims.emoji;

  // 3. BREAK DOWN EN_GLOSS_PHRASE INTO EN_GLOSS_WORDS - EMOJIFY EACH
  const en_gloss_words: string[] = en_gloss.split(/[\s\-:.+_;]+/); // TODO: UPDATE THIS so that the split is done without "-" first, before trying again with a split based on "-"
  const en_gloss_words_emojis: (string | null)[] = [];
  // - First pass: check if ANY word is a core word
  let has_any_core_word = false;
  for (const en_word of en_gloss_words) {
    if (!(await isNotCoreWord("en", en_word))) {
      has_any_core_word = true;
      break;
    }
  }
  // - Second pass: generate emojis with appropriate logic
  for (const en_word of en_gloss_words) {
    const is_core_word = !(await isNotCoreWord("en", en_word));
    if (has_any_core_word && !is_core_word) {
      // If phrase has core words and this word is NOT core, use blank space - e.g. "on A plate", "A game", "on THE",
      en_gloss_words_emojis.push("\u2007"); // An explicit white-space so that it occupies space and is not compressed in html (as normal spaces are) // x. \u3164 (Hangul Filler - also shows depending on font)  x. \u2800 (Braille White Space - will still display something depending on font)
    } else {
      // Otherwise, generate emoji normally
      const word_emoji: string | null = generateEmoji_fromWord(en_word, cachedEmojisData);
      en_gloss_words_emojis.push(word_emoji);
    }
  }

  const en_gloss_phrase_emojified: string = en_gloss_words_emojis
    .filter(Boolean)
    .join(" ");
  return en_gloss_phrase_emojified;
}

async function generateEmoji_standard2(
  en_gloss: string,
  rows: EmojiRow[],
  isNotCoreWord: IsNotCoreWord,
): Promise<string> {
  /**
   * - Progress through levels of splits: Nothing, then: space -> [:.+_;] -> '-' (hyphen last)
   * - Always try exact match (raw + normalized-delims) at each level
   * - When a piece can’t split further: fall back to generateEmoji_fromWord
   */

  // Exact-match (raw + "fancy delim" normalization)
  const exactEmoji = (s: string): string | null => {
    const a = findCaseInsensitiveEmojiRowMatch(s, rows);
    if (a) return a.emoji;

    const norm = s.replace(/[\-:.+_]+/g, " ");
    const b = findCaseInsensitiveEmojiRowMatch(norm, rows);
    return b?.emoji ?? null;
  };

  // We build "atoms" so we can do core-word logic after we know all leaf-words.
  type Atom = { emoji?: string; word?: string };

  // Split order (spaces first, hyphen last)
  const splitters: RegExp[] = [/\s+/, /[.:+_;]+/, /-+/];

  // Recursively: exact-match first; else split in required order; else leaf word
  const recursiveSplitToAtomsWithExactMatchSearch = (raw: string): Atom[] => {
    const s = raw.trim();
    if (!s) return [];

    const exactMatchEmoji = exactEmoji(s);
    if (exactMatchEmoji) return [{ emoji: exactMatchEmoji }];

    for (const re of splitters) {
      if (!re.test(s)) continue; // Only try splitting if delimiter exists (avoids useless split to [s])
      const parts = s.split(re).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) return parts.flatMap(recursiveSplitToAtomsWithExactMatchSearch);
    }

    return [{ word: s }];
  };

  const atoms = recursiveSplitToAtomsWithExactMatchSearch(en_gloss);

  // Cache isNotCoreWord (async + repeated tokens), expose a simple isCore(word)
  const notCoreCache = new Map<string, boolean>();
  const isCore = async (word: string): Promise<boolean> => {
    const key = word.toLowerCase();
    // Use cached value if present; otherwise compute + cache it
    const notCore = notCoreCache.get(key) ?? (await isNotCoreWord("en", word));
    notCoreCache.set(key, notCore);
    return !notCore;
  };

  // 1) Determine if ANY leaf-word is core (done in parallel)
  const hasCore = (
    await Promise.all(atoms.flatMap((a) => (a.word ? [isCore(a.word)] : [])))
  ).some(Boolean);

  // 2) Render atoms (also in parallel; order preserved by Promise.all)
  const prints: string[] = await Promise.all(
    atoms.map(async (a) => {
      if (a.emoji) return a.emoji; // exact-match emoji atom
      if (!a.word) return ""; // safety (shouldn't happen much)
      // If phrase has core words, hide non-core words via visible whitespace
      if (hasCore && !(await isCore(a.word))) return "\u2007";
      // Otherwise generate emoji from word (or empty string if null)
      return generateEmoji_fromWord(a.word, rows) ?? "";
    }),
  );

  let output: string = prints.filter(Boolean).join(" ");
  output = output.replaceAll("  ", " ");
  output = output.replaceAll("» →", "→"); // Condense "to {verb}" e.g. "to ask"'s emoji should just show as "ask", since "ask" is a verb (i.e. emojifies as "→💬❓").

  return output;
}

// 3. `generateEmoji_fromWord` is run after splitting gloss by 'spaces'.
function generateEmoji_fromWord(
  enWord: string,
  cachedEmojisData: EmojiRow[],
): string | null {
  // 1. EXACT-MATCH SEARCH
  const exact_match = findCaseInsensitiveEmojiRowMatch(enWord, cachedEmojisData);
  if (exact_match) return exact_match.emoji;

  // 20251218: NOTE: Compared to the BE version of 'emojify.ts'. `generateEmoji_fromWord` has now been drastically updated so that AFFIX Catching is up in generateEmoji_fromWord, and Morpheme lemmatization is drastically simplified.

  // 2A. ["…ING"] AFFIX CATCHING
  if (enWord.toUpperCase().endsWith("ING")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/ING$/, ""); // HIDING→HID, SWIMMING→SWIMM
    const _ingEmoji: string = cachedEmojisData.find((row) => row.en_gloss === "-ING")?.emoji ?? ""; // "-ing" emoji
    // A. Check for exact match with split 'prefix -suffix'
    const word__ing: string = enWordPrefix + " -ing";
    const exact_match = findCaseInsensitiveEmojiRowMatch(word__ing, cachedEmojisData);
    if (exact_match) return exact_match.emoji;

    // B. Split up so we emojify {baseWord} + "-ing" separately.
    const hasDouble = /([A-Z])\1$/.test(enWordPrefix); // True for e.g. SWIMM, RUNN
    const dedup = hasDouble ? enWordPrefix.slice(0, -1) : ""; // SWIMM→SWIM, RUNN→RUN
    let exact;
    let plusOne;
    let dedupMatch;
    for (const row of cachedEmojisData) {
      const gloss = (row.en_gloss || "").toUpperCase();
      // exact: HIDING→HID, SWIMMING→SWIMM
      if (!exact && gloss === enWordPrefix) exact = row;
      // plus-one: HID→HIDE, SWIMM→SWIMME
      if (!plusOne && gloss.startsWith(enWordPrefix) && gloss.length === enWordPrefix.length + 1) {
        plusOne = row;
      }
      // dedup: SWIMM→SWIM, RUNN→RUN
      if (hasDouble && !dedupMatch && gloss === dedup) {
        dedupMatch = row;
      }
      if (exact || plusOne || dedupMatch) break; // This will return as soon as any match is found, rather than prioritizing exact > plusOne > dedupMatch. // If want to prioritize order, do something like: `if (exact && plusOne && (!hasDouble || dedupMatch)) break; // short-circuit if all found`
    }
    if (exact || plusOne || dedupMatch) {
      return (exact || plusOne || dedupMatch)?.emoji + _ingEmoji;
    }
  }
  // 2B. ["…'S"] AFFIX CATCHING
  if (enWord.toUpperCase().endsWith("'S")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/\'S$/, ""); // ~
    const __sEmoji: string = cachedEmojisData.find((row) => row.en_gloss === "'S")?.emoji ?? "";
    void __sEmoji;
    // A. Check for exact base match of prefix
    const exact_match = findCaseInsensitiveEmojiRowMatch(enWordPrefix, cachedEmojisData);
    if (exact_match) return exact_match.emoji; // + ` ${__sEmoji}`; // <- Decided not to add the emoji in this case, as at this point, it's likely that there's too many emojis (e.g. "mom's dad")
  }
  // 2C. ["…SIDE"]
  if (enWord.toUpperCase().endsWith("SIDE")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/SIDE$/, "");
    const _suffixEmoji: string =
      cachedEmojisData.find((row) => row.en_gloss === "-SIDE")?.emoji ?? "";
    // A. Check for exact match with split 'prefix -suffix'
    const exact_split_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix + " -SIDE",
      cachedEmojisData,
    );
    if (exact_split_match) return exact_split_match.emoji;
    // B. Search for exact prefix match
    const exact_prefix_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix,
      cachedEmojisData,
    );
    if (exact_prefix_match) return exact_prefix_match.emoji + _suffixEmoji;
  }
  // 2D. ["…?"]
  if (enWord.endsWith("?")) {
    const enWordPrefix: string = enWord.slice(0, -1); // Remove the "?"
    const _suffixEmoji: string = cachedEmojisData.find((row) => row.en_gloss === "-?")?.emoji ?? "";
    // A. Check for exact match with split 'prefix -suffix'
    const exact_split_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix + " ?",
      cachedEmojisData,
    );
    if (exact_split_match) return exact_split_match.emoji;
    // B. Search for exact prefix match
    const exact_prefix_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix,
      cachedEmojisData,
    );
    if (exact_prefix_match) return exact_prefix_match.emoji + _suffixEmoji;
  }
  // 2E. ["…LY"]
  if (enWord.toUpperCase().endsWith("LY")) {
    const enWordPrefix: string = enWord.toUpperCase().replace(/LY$/, "");
    // B. Search for exact prefix match
    const exact_prefix_match = findCaseInsensitiveEmojiRowMatch(
      enWordPrefix,
      cachedEmojisData,
    );
    if (exact_prefix_match) return `【${exact_prefix_match.emoji}】`;
  }
  // 2E. ["-…"] (e.g. ["fly","-over"])
  if (enWord.startsWith("-")) {
    const enWordMain: string = enWord.slice(1);
    // A. Check for exact base match
    const exact_match = findCaseInsensitiveEmojiRowMatch(enWordMain, cachedEmojisData);
    if (exact_match) return exact_match.emoji;
  }
  // 2F. ["(…)"]
  if (enWord.startsWith("(") && enWord.endsWith(")")) {
    const enWordMain: string = enWord.slice(1, -1);
    // A. Check for exact base match
    const exact_match = findCaseInsensitiveEmojiRowMatch(enWordMain, cachedEmojisData);
    if (exact_match) return `(${exact_match.emoji})`;
  }

  // 3. Fallback on Matches on LEMMAS.
  // Extract possible lemma forms for a given word (that aren't the same as enWord)
  const posKeys: (keyof MorphemeStringsByPos)[] = ["noun", "verb", "adjective"];
  let morphemes: MorphemeStringsByPos = getMorphemeStringsForEnWord(enWord);
  // - Try LowerCase if no lemmaCandidates found
  if (
    enWord !== enWord.toLowerCase() &&
    posKeys.every((key) => ilike(morphemes[key], enWord))
  ) {
    morphemes = getMorphemeStringsForEnWord(enWord.toLowerCase());
  }
  // - Filter out if it's the same word
  const lemmaCandidates: string[] = posKeys
    .map((p) => morphemes[p])
    .filter((lemma) => lemma && !ilike(lemma, enWord))
    .sort((a, b) => a.length - b.length); // - Sort, so the shortest lemma comes first (for priority)

  // Tries to find a lemma or morpheme-string match in the emoji cache. Returns joined emoji string or null.
  for (const lemma of lemmaCandidates) {
    const match: EmojiRow | undefined = findCaseInsensitiveEmojiRowMatch(
      lemma.toUpperCase(),
      cachedEmojisData,
    );
    if (match) return match.emoji;
  }
  return null;
}

function findCaseInsensitiveEmojiRowMatch(
  enGlossText: string,
  cachedEmojisData: EmojiRow[],
): EmojiRow | undefined {
  // 1. Exact Match
  let match = cachedEmojisData.find(
    (row) => row.en_gloss === enGlossText.toUpperCase(),
  ); // future: would be faster if emojisData was a dictionary. with en_gloss.upperCase as a key
  // 2. Attempt Match without trailing "s".
  if (!match && enGlossText.toUpperCase().endsWith("S")) {
    match = cachedEmojisData.find(
      (row) => row.en_gloss === enGlossText.slice(0, -1).toUpperCase(),
    );
  }
  return match;
}

// -------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------

/* 20250925: Color Emoji Replacements
	Replacing Emoji rather than Gloss - since Emojis can exist in other words:
	replacements:
		red - 🔴->[🎨🍓] - used by "Mars"=🪐🔴, "Red Light"=🔴🚦.
		yellow - 🟡->[🎨🧀] - used by "🟡$" (gold coins).
		green - 🟢->[🎨🌳] - used by "🟢🚦" (green light).
		blue - 🔵->[🎨🌊] - used by none. // 🫐 = alt
		black - ⚫️->[🎨♟] - used by none. // 🕶️ not found in bw-notoemoji // alts = 🐦‍⬛(black bird) 🐈‍⬛(black cat) ♟🐈‍⬛🦨🎬♣🏴
		white - ⚪️->[🎨🦷] - used by none.
		purple - 🟣->[🎨🍆] - used by none.
		brown - 🟤->[🎨🦌] - used by none. // in bw-notoemoji 🥔 isn't clear enough
		orange (color) 🟠->[🎨🥕] - used by "🪐🟠✨" (Venus). // in bw-notoemoji 🍊 isn't clear enough
		//orange 🍊
	pre-existing:
		⟦🎨⟧ color
		🎨💕 pink

		// 20251019 - note if replacing '🩸' with '🩸(🆎)' it needs to be a strict replacement, since '🩸' is used in many places.
*/
export function convertEmojiTextToBlackWhiteCompatibleEmojiText(
  emojiText: string,
): string {
  const replacements: { [original_emoji: string]: string } = {
    "🔴": "🎨🍓",
    "🟡": "🎨🧀",
    "🟢": "🎨🌲",
    "🔵": "🎨🌊",
    "⚫️": "🎨🐈‍⬛",
    "⚪️": "🎨🦷",
    "🟣": "🎨🍆",
    "🟤": "🎨🦌",
    "🟠": "🎨🥕",
    "☀️": "☀",
    "0️⃣": "⓪",
    "1️⃣": "①",
    "2️⃣": "②",
    "3️⃣": "③",
    "4️⃣": "④",
    "5️⃣": "⑤",
    "6️⃣": "⑥",
    "7️⃣": "⑦",
    "8️⃣": "⑧",
    "9️⃣": "⑨",
    "🔟": "⑩",
    "🍎": "🍏",
    "🎨🩵": "🎨🧊",
    "🔵▓": "🎨🌊",
    // --- Below Has been left as Color Emoji originals with `shouldBlackWhiteEmojiUseColorEmojiFont`
    // "👩‍🍼":"🧑‍🍼♀",
    // "👨‍🍼":"🧑‍🍼♂",
    // "👨‍🍼↰":"🧑‍🍼↰♂",
    // "👩‍🍼↰":"🧑‍🍼↰♀",
    // "👬":"🧑‍🤝‍🧑♂",
    // "👭":"🧑‍🤝‍🧑♀",
  };
  // Get all the emojis as a regex alternation
  const emojiKeys = Object.keys(replacements)
    .sort((a, b) => b.length - a.length) // sorted by longest key first
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(emojiKeys, "g");

  let output = emojiText.replace(regex, (match) => {
    // Surround Multi-Grapheme Replacements with [], if it isn't a direct replacement.
    let replacement = replacements[match] || match;
    // Check if the match isn't a direct match & replacement is >1 visual char
    // (Visual char: count code points, not just string length)
    // If replacement is not the same and has more than 1 code point
    if (match !== emojiText && numGraphemeClusters(replacement) > 1) {
      // if (!replacement.startsWith('[') && !replacement.endsWith(']')) { // // Only surround if not already surrounded by []
      replacement = `[${replacement}]`;
      // }
    }
    return replacement;
  });

  // Remove "U+FE0F (VARIATION SELECTOR-16) (base character)" (which can cause NotoMoji to not render the Emoji)
  output = cleanEmojiForNoto(output);

  // Replace " " (spaces) - since Noto Emoji (issue with BW-Font only, Color-Font is fine), makes the spaces ridiculously large
  output = output.replaceAll(" ", "\u2009");

  return output;
}

// shouldBlackWhiteEmojiUseColorEmojiFont was introduced because some NotoEmoji(BW) renders/replacements are just better off as a grayscaled NotoColorEmoji.
export function shouldBlackWhiteEmojiUseColorEmojiFont(emojiText: string): boolean {
  const emojiList = ["👩‍🍼", "👨‍🍼", "👬", "👭", "👯"];
  return emojiList.some((emoji) => (emojiText ?? "").includes(emoji));
}

export function cleanEmojiForNoto(emojiString: string): string {
  if (["ȯ", "Ȯ"].includes(emojiString)) return emojiString;
  // NOTE: This should not be used if the intent is to display Apple Emojis as it can remove certain renderings like the KeyCap Emojis 5️⃣,➡️.
  // Remove "U+FE0F (VARIATION SELECTOR-16) (base character)" (which can cause "Noto EMoji" and "Noto Color Emoji" to not render the Emoji)
  return emojiString.replace(/\uFE0F/g, "");
}

function numGraphemeClusters(str: string): number { // i.e. visual length with emojis // :|| from "crossword.tsx"
  // If Intl.Segmenter is available
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments = Array.from(segmenter.segment(str));
    return segments.length;
  } else {
    // Fallback: counts code points, not graphemes (not perfect for emojis!). It's better than length but still sometimes wrong
    return Array.from(str).length;
  }
}

export function shouldFlipEmoji(grapheme: string): "IF_NOTO" | "YES" | "NO" {
  const TO_FLIP_NOTO_EMOJIS = new Set(["🤰", "🫄", "🫃", "🤾", "🦋"]);
  const TO_FLIP_GENERAL_EMOJIS = new Set([
    "🚗",
    "🚙",
    "🚕",
    "🚓",
    "🚑",
    "🚒",
    "🚌",
    "🚐",
    "🚚",
    "🚛",
    "🛻",
    "🚜",
    "🏍️",
    "🛵",
    "🛴",
    "🚲",
    "🛺",
    "🚤",
    "🚣",
    "🏇",
    "🐎",
    "🐢",
    "🐇",
    "🕊️",
    "🦅",
    "🦆",
    "🦜",
    "🪿",
    "🐛",
    "🐝",
    "🐜",
    "🐳",
    "🐋",
    "🦈",
    "🦐",
    "⛹",
    "⛹️‍♀️",
    "⛹️‍♂️",
    "🦗",
    "🐟",
    "🐬",
    "🐠",
    "🐡",
    "🦄",
    "🐴",
    "🐕",
    "🐩",
    "🦮",
    "🐕‍🦺",
    "🐈",
    "🐈‍⬛",
    "🪽",
    "🐦‍🔥",
    "🐉",
    "🦖",
    "🦕",
    "🐘",
    "🚴",
    "🚶",
    "🏃",
    "🏊",
    "🤔",
    "🧐",
    "👀",
    "✍️",
    "📣",
    "📢",
  ]);

  if (TO_FLIP_GENERAL_EMOJIS.has(grapheme)) return "YES";
  if (TO_FLIP_NOTO_EMOJIS.has(grapheme)) return "IF_NOTO";
  return "NO";
}

function isEmojiRow(row: unknown): row is EmojiRow {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Partial<EmojiRow>;
  return typeof candidate.emoji === "string" && typeof candidate.en_gloss === "string";
}

void generateEmoji_standard;
