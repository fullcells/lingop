import { createWordListL10nResolverV3, type SBWordListV3Row } from './word-lists-v3.js';
import { segmentWordListTitle } from './word-lists.js';
import type { LingoDataClient } from './lingo-data-client.js';
import type { SBWordRow2 } from './sb-words.js';

export type WordListTitleGlossesV3 = ReadonlyMap<string, ReadonlyMap<string, string>>;
export type WordListTitleRequestV3 = { list: SBWordListV3Row; langs: readonly string[] };
const titleKey = (text: string) => text.trim().toLocaleLowerCase();
const directionKey = (source: string, target: string) => `${source}:${target}`;

/** Language-family titles are authoritative; saved glosses are only a fallback.
 * Missing translations remain null, never source-language text masquerading as a gloss.
 */
export function createWordListTitleResolverV3(metadata: readonly SBWordListV3Row[], glosses?: WordListTitleGlossesV3) {
  const related = createWordListL10nResolverV3(metadata);
  return (list: SBWordListV3Row, lang: string): string | null => {
    if (list.lang === lang) return list.title;
    const variant = related(list.id, lang);
    if (variant) return variant.title;
    const index = glosses?.get(directionKey(list.lang, lang));
    const exact = index?.get(titleKey(list.title));
    if (exact) return exact;
    const { titleLabel, titleCounter } = segmentWordListTitle(list.title);
    const gloss = index?.get(titleKey(titleLabel));
    return gloss ? gloss + (titleCounter === null ? '' : `#${titleCounter}`) : null;
  };
}

export function resolveWordListTitleV3(metadata: readonly SBWordListV3Row[], list: SBWordListV3Row, lang: string, glosses?: WordListTitleGlossesV3) {
  return createWordListTitleResolverV3(metadata, glosses)(list, lang);
}

/** Read saved fallback titles only for caller-selected lists and languages.
 * Variant titles need no words2 read. Lingop's existing per-direction cache
 * shares concurrent reads; this function retains only requested title glosses.
 * No translations or annotations are generated and no new persistent cache exists.
 */
export async function loadWordListTitleGlossesV3(
  client: Pick<LingoDataClient, 'getSBWordsForLangDir'>,
  metadata: readonly SBWordListV3Row[],
  requests: readonly WordListTitleRequestV3[],
): Promise<WordListTitleGlossesV3> {
  const resolve = createWordListTitleResolverV3(metadata);
  const directions = new Map<string, { source: string; target: string; titles: Set<string> }>();
  for (const { list, langs } of requests) for (const target of new Set(langs)) {
    if (resolve(list, target) !== null) continue;
    const source = list.lang;
    const key = directionKey(source, target);
    const request = directions.get(key) ?? { source, target, titles: new Set<string>() };
    request.titles.add(titleKey(list.title));
    request.titles.add(titleKey(segmentWordListTitle(list.title).titleLabel));
    directions.set(key, request);
  }
  return new Map(await Promise.all([...directions].map(async ([key, { source, target, titles }]) => {
    const rows = await client.getSBWordsForLangDir(source, target);
    const preferred = new Map<string, SBWordRow2>();
    for (const row of rows) {
      const word = titleKey(row.word);
      if (row.word_lang !== source || row.gloss_lang !== target || !titles.has(word) || !row.gloss.trim()) continue;
      const previous = preferred.get(word);
      const priority = previous ? Number(row.is_human_verified) - Number(previous.is_human_verified) ||
        Date.parse(row.created_at) - Date.parse(previous.created_at) || row.id - previous.id : 1;
      if (priority > 0) preferred.set(word, row);
    }
    return [key, new Map([...preferred].map(([word, row]) => [word, row.gloss.trim()]))] as const;
  })));
}
