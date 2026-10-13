import { loadWordListTitleGlossesV3, createWordListTitleResolverV3 } from '../../core/word-list-titles-v3.js';
import { translatePrebakeTexts, type PrebakeBuildServices } from "./api.js";
import type { LingoDataClient } from '../../core/lingo-data-client.js';
import { createWordListGlossTipLangResolverV3, createWordListL10nResolverV3, type WordListV3 } from '../../core/word-lists-v3.js';
import type { AnnotatedText } from '../../core/annotation/types.js';

export type WordListsV3Enrichment = {
  annotations: Record<string, Record<string, AnnotatedText>>;
  glosses: Record<string, Record<string, string>>;
  emojis: Record<string, string>;
};
export type PreparedWordV3 = { id: number; text: string; annotation: AnnotatedText; glosses: Record<string, string>; emoji: string };
export type PreparedListV3 = { id: number; familyId: number; lang: string; title: string; titles: Record<string, string>; glossTipLangs: string[]; updatedAt: string; words: PreparedWordV3[]; children: number[] };
export type PreparedWordListsV3 = { version: 3; languages: Record<string, { roots: number[]; lists: Record<string, PreparedListV3> }> };

/** Curated structural roots may be shared across languages. Content lists never
 * borrow another language's words, order, or child relationships. */
export function collectPublicWordListsV3(all: WordListV3[], lang: string, rootId: number) {
  const byId = new Map(all.map(list => [list.id, list]));
  const resolve = createWordListL10nResolverV3(all);
  const resolved = new Map<number, WordListV3>();
  function visit(id: number, path: Set<number>): number | null {
    const source = byId.get(id);
    if (!source) throw new Error(`Missing V3 child ${id}`);
    const match = resolve(id, lang);
    const list = match ? byId.get(match.id)! : source.words.length === 0 && source.title.startsWith('_') ? source : null;
    if (!list) return null;
    if (path.has(list.id)) throw new Error(`V3 cycle at ${list.id}`);
    if (resolved.has(list.id)) return list.id;
    const next = new Set(path).add(list.id);
    const sublists = list.sublists.flatMap(edge => {
      const child = visit(edge.child_list_id, next);
      return child === null ? [] : [{ ...edge, child_list_id: child }];
    });
    resolved.set(list.id, { ...list, sublists });
    return list.id;
  }
  const root = visit(rootId, new Set());
  if (!root) throw new Error(`No public root for ${lang}`);
  return { roots: resolved.get(root)!.sublists.map(e => e.child_list_id), lists: [...resolved.values()].filter(l => l.id !== root) };
}
export const getWordListAnnotationGlosses = (annotation: AnnotatedText): string[] => annotation.tokens.filter(t => t.isWord && t.gloss?.trim()).map(t => t.gloss!.replace(/^TO /, ''));

/** V3 build-time API. Uses only V3 list readers; no V2 cache/table fallback.
 * Cache keys use exact stored text and language, never an aligned source-word
 * position. Row identity, duplicates, explicitations and homonym glosses survive.
 * Pass a persisted enrichment cache to avoid regenerating unchanged annotations
 * and glosses. Clear selected entries for an editorial refresh. The list graph
 * itself is read afresh. Save checkpoints only to consumer-controlled storage. */
export async function prepareWordListsV3({ client, rootListId, focusLangs, guiLangs, enrichment = { annotations: {}, glosses: {}, emojis: {} }, checkpoint = async () => {}, report = () => {}, services }: {
  /** Existing privileged batch-translation API for build-time cache misses. */
  services?: PrebakeBuildServices;
  client: Pick<LingoDataClient, 'loadWordListMetaDataV3' | 'loadWordListsV3' | 'fetchAnnotation' | 'fetchAndGenGloss' | 'generateEmojis'> & Partial<Pick<LingoDataClient, 'getSBWordsForLangDir' | 'getSBWordsForWords'>>;
  rootListId: number; focusLangs: string[]; guiLangs: string[];
  enrichment?: WordListsV3Enrichment;
  checkpoint?: (cache: WordListsV3Enrichment) => Promise<void>;
  report?: (message: string) => void;
}): Promise<PreparedWordListsV3> {
  const meta = await client.loadWordListMetaDataV3({ forceRefresh: true });
  const all: WordListV3[] = [];
  for (const lang of [...new Set(meta.map(l => l.lang))]) all.push(...await client.loadWordListsV3(lang));
  const trees = Object.fromEntries(focusLangs.map(lang => [lang, collectPublicWordListsV3(all, lang, rootListId)]));
  const supported = createWordListGlossTipLangResolverV3(meta);
  // Plan before enrichment. Parents never grant support to their children, and
  // a hidden branch creates no translation work unless reachable elsewhere.
  const available = new Map<WordListV3, string[]>();
  for (const tree of Object.values(trees)) {
    const byId = new Map(tree.lists.map(list => [list.id, list]));
    for (const gui of new Set(guiLangs)) {
      const visited = new Map<number, boolean>();
      const visit = (id: number): boolean => {
        const list = byId.get(id);
        if (!list || !supported(id).includes(gui)) return false;
        if (visited.has(id)) return visited.get(id)!;
        const children = list.sublists.map(edge => visit(edge.child_list_id));
        const keep = !list.sublists.length || list.words.length > 0 || children.some(Boolean);
        visited.set(id, keep);
        if (!keep) return false; // Do not publish empty headings left by filtering.
        available.set(list, [...(available.get(list) ?? []), gui]);
        return true;
      };
      tree.roots.forEach(visit);
    }
    tree.lists = tree.lists.filter(list => available.has(list));
    const kept = new Set(tree.lists.map(list => list.id));
    tree.roots = tree.roots.filter(id => kept.has(id));
    tree.lists.forEach(list => { list.sublists = list.sublists.filter(edge => kept.has(edge.child_list_id)); });
  }
  // Use the same family-first title policy as runtime V3 consumers. Plan only
  // supported combinations, and validate titles before billable word enrichment.
  const requests = [...available].map(([list, langs]) => ({ list, langs }));
  const titleGlosses = await loadWordListTitleGlossesV3({
    ...(client.getSBWordsForWords ? { getSBWordsForWords: client.getSBWordsForWords.bind(client) } : {}),
    getSBWordsForLangDir: (source, target) => {
      if (!client.getSBWordsForLangDir) throw new Error('V3 title glosses require getSBWordsForLangDir.');
      return client.getSBWordsForLangDir(source, target);
    },
  }, meta, requests);
  const resolveTitle = createWordListTitleResolverV3(meta, titleGlosses);
  const titles = new Map<WordListV3, Record<string, string>>();
  for (const { list, langs } of requests) {
    titles.set(list, Object.fromEntries(langs.map(gui => {
      const title = resolveTitle(list, gui);
      if (title === null) throw new Error(`Missing stored V3 title gloss: ${list.lang}/${list.title} → ${gui}`);
      return [gui, title];
    })));
  }
  const cache = enrichment;
  async function batches<T>(items: T[], task: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += 6) {
      // Finish and persist successful peers even when one request fails, so the
      // next build does not pay to repeat their work.
      const results = await Promise.allSettled(items.slice(i, i + 6).map(task));
      await checkpoint(cache);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
    }
  }
  for (const lang of focusLangs) {
    const words = [...new Set(trees[lang]!.lists.flatMap(l => l.words.map(w => w.text)))];
    const annotations = cache.annotations[lang] ??= {};
    const missing = words.filter(w => !annotations[w]);
    report(`${lang}: ${words.length} texts; ${missing.length} missing annotations`);
    await batches(missing, async text => {
      const a = await client.fetchAnnotation({ localization: { text, l10n_lang: lang, sourceContent: { text, lang, ref: { file: 'WORDS' }, owner_id: null } } });
      if (!a || a.lang !== lang || a.lang_text !== text || !a.tokens.length) throw new Error(`Missing V3 annotation: ${lang}/${text}`);
      annotations[text] = { ...a, owner_id: null, ref: null };
    });
    // Validate before any downstream translation or emoji requests.
    for (const text of words) if (!getWordListAnnotationGlosses(annotations[text]!).length) {
      throw new Error(`Missing V3 English annotation gloss: ${lang}/${text}`);
    }
  }
  const glosses = [...new Set(focusLangs.flatMap(lang => trees[lang]!.lists.flatMap(l => l.words.flatMap(w => getWordListAnnotationGlosses(cache.annotations[lang]![w.text]!)))))];
  for (const lang of [...new Set(guiLangs)].filter(l => l !== 'en')) {
    const dictionary = cache.glosses[lang] ??= {};
    const required = [...new Set(Object.entries(trees).flatMap(([focus, tree]) => tree.lists
      .filter(list => available.get(list)!.includes(lang))
      .flatMap(list => list.words.flatMap(word => getWordListAnnotationGlosses(cache.annotations[focus]![word.text]!)))))];
    const missing = required.filter(g => !dictionary[g]);
    report(`${lang}: ${missing.length} missing interface glosses`);
    const unresolved: string[] = [];
    await batches(missing, async gloss => {
      const result = await client.fetchAndGenGloss({ source_lang: 'en', source_word: gloss, target_lang: lang, generateIfMissing: !services });
      if (result?.targetWord) dictionary[gloss] = result.targetWord;
      else if (services) unresolved.push(gloss);
      else throw new Error(`Missing V3 ${lang} gloss for ${gloss}`);
    });
    // Missing non-core glosses use the build API in bounded batches, rather than
    // saturating the anonymous per-word endpoint. Existing human-verified words
    // and explicitations always win; alternatives remain complete phrases.
    for (let start = 0; start < unresolved.length; start += 40) {
      const texts = unresolved.slice(start, start + 40);
      const translated = await translatePrebakeTexts({ sourceLang: 'en', targetLang: lang, sourceTexts: texts, refs: texts.map(() => ({dev:'prebake-v3-gloss'})), services: services! });
      for (const text of texts) {
        if (!translated[text]?.trim()) throw new Error(`Missing V3 ${lang} gloss for ${text}`);
        dictionary[text] = translated[text]!;
      }
      await checkpoint(cache);
    }
  }
  const missingEmoji = glosses.filter(g => !(g in cache.emojis));
  for (let i = 0; i < missingEmoji.length; i += 40) {
    const found = await client.generateEmojis(missingEmoji.slice(i, i + 40));
    for (const [g, emoji] of Object.entries(found)) cache.emojis[g] = emoji ?? '';
    await checkpoint(cache);
  }
  const output: PreparedWordListsV3 = { version: 3, languages: {} };
  for (const lang of focusLangs) {
    const tree = trees[lang]!;
    const lists: Record<string, PreparedListV3> = {};
    output.languages[lang] = { roots: tree.roots, lists };
    for (const list of tree.lists) lists[list.id] = {
      id: list.id, familyId: list.anchor_list_id ?? list.id, lang, title: list.title,
      glossTipLangs: available.get(list)!,
      titles: titles.get(list)!,
      updatedAt: list.updated_at, children: list.sublists.map(e => e.child_list_id),
      words: list.words.map(word => {
        const a = cache.annotations[lang]![word.text]!;
        const gs = getWordListAnnotationGlosses(a);
        return { id: word.id, text: word.text, annotation: { ...a, owner_id: null, ref: null },
          glosses: Object.fromEntries(available.get(list)!.map(gui => [gui, gs.map(g => gui === 'en' ? g : cache.glosses[gui]![g]).join(' · ')])),
          emoji: gs.map(g => cache.emojis[g] ?? '').join(' '),
        };
      }),
    };
  }
  return output;
}
