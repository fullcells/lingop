import lemmatize from "wink-lemmatizer";

// This is the conceptual successor to 'lemmatizeEnglishWord.ts' - it exists in 2 locations: 1:BE API. 2:FE.
/*
English Word Lemmatization Usage & Existence:
* Reason for being: For creating Emoji Gloss.
* Exists in 2 places: 1. Backend-API-Call-for-English-Words-to-Emojis, 2. FE-generateEmojis (used by OA:OS B2B product).
* The lemmatization code is the same in both.
* Reason for colocation: Internal efficiency since OA:OS emoji calls are high-frequency and need to be fast.
* Usage: For external applications like Games or Native Mobile Apps: B. If static/offline: they can export data from “OA:OS B2B” [2]. A. If online/custom-user-data-supported (e.g. custom user words → emojis): The BE API call [1] can be used (whilst dedicated iOS/Unity/… lemmatizers are nice and can help reduce api calls, it is not needed, especially pre-MVB for these products).
*/
// 20251218: FE Updated this so that any affixes are handled further up by parent. (To re-evaluate when re-updating BE to catch up with FE's 'emojify.ts' approach.)

export type MorphemeStringsByPos = {
  noun: string;
  verb: string;
  adjective: string;
};

export function getMorphemeStringsForEnWord(word: string): MorphemeStringsByPos {
  const morphemeStrings: MorphemeStringsByPos = {
    noun: lemmatize.noun(word),
    verb: lemmatize.verb(word),
    adjective: lemmatize.adjective(word),
  };
  return morphemeStrings;
  // parent will take these and find: shortest different one (based on lemma), (if any)
}

// Note: On 20250903: Confirmed old `function lemmatizeEnglishWord(word: string): string {…}` can be completely deprecated in favor of a standard lemmatizer like wink-Lemmatizer (any words that the lemmatizer missed have been encoded directly into supabase) (aka `getMorphemeStringsForWord`.
