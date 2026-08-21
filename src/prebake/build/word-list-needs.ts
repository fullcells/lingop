import {
  loadPublicSBCacheWordListsForLang,
  loadPublicWordListMetaData,
  type WordListMeta,
} from "../../core/word-lists.js";
import { getPrebakedLangPairKey } from "../runtime.js";
import type { PrebakeBuildServices } from "./api.js";
import type { PrebakeConfig } from "./config.js";

export type PrebakeNeeds = {
  translationsByLangPair: Record<string, string[]>;
  annotationsByLang: Record<string, string[]>;
};

type WordListTreeNode = {
  meta: WordListMeta;
  children: WordListTreeNode[];
};

export async function collectWordListPrebakeNeeds({
  config,
  services,
}: {
  config: PrebakeConfig;
  services: PrebakeBuildServices;
}): Promise<PrebakeNeeds> {
  // These tables are deliberately readable by Supabase's anonymous/public
  // role. Prebake uses the Data API directly: no user session or injected
  // Supabase client is involved.
  const publicDataApi = {
    supabaseUrl: services.supabaseUrl,
    supabasePublicKey: services.supabasePublicKey,
    ...(services.fetchImpl ? { fetchImpl: services.fetchImpl } : {}),
  };
  const wordLists = await loadPublicWordListMetaData(publicDataApi);
  const tree = buildWordListTree(wordLists, config.translationRootListTitle);
  if (!tree) {
    throw new Error(
      `Prebake word-list root ${config.translationRootListTitle} was not found.`,
    );
  }

  const descendantTitles = new Set(getWordListTreeTitles(tree));
  descendantTitles.delete(config.translationRootListTitle);
  const translationsByLangPair: Record<string, string[]> = {};

  for (const entry of wordLists) {
    if (!descendantTitles.has(entry.title)) continue;
    const targetLangs =
      entry.type === "UNIVERSAL" ? config.allLangs : config.guiLangs;
    for (const targetLang of targetLangs) {
      if (targetLang.toLowerCase() === entry.lang.toLowerCase()) continue;
      const langPair = getPrebakedLangPairKey(entry.lang, targetLang);
      (translationsByLangPair[langPair] ??= []).push(
        segmentWordListTitle(entry.title),
      );
    }
  }

  const localizedRowsByLang = await Promise.all(
    config.allLangs.map((lang) =>
      loadPublicSBCacheWordListsForLang(lang, publicDataApi),
    ),
  );
  const annotationsByLang: Record<string, string[]> = {};
  for (const row of localizedRowsByLang.flat()) {
    (annotationsByLang[row.lang] ??= []).push(...row.l10n_words);
  }

  return normalizeNeeds({
    translationsByLangPair,
    annotationsByLang,
  });
}

function segmentWordListTitle(wordListTitle: string): string {
  const titleLabel = wordListTitle.split("#")[0]?.replaceAll("_", " ").trim();
  return titleLabel || wordListTitle;
  // Future: This may be elaborated further (for example, parenthesis removal
  // or additional splitting by `:`). Retained from OmniAccess - 20260424.
}

function normalizeNeeds(needs: PrebakeNeeds): PrebakeNeeds {
  const normalize = (record: Record<string, string[]>) =>
    Object.fromEntries(
      Object.entries(record)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, texts]) => [
          key.toLowerCase(),
          [...new Set(texts)].sort((a, b) => a.localeCompare(b)),
        ]),
    );
  return {
    translationsByLangPair: normalize(needs.translationsByLangPair),
    annotationsByLang: normalize(needs.annotationsByLang),
  };
}

function buildWordListTree(
  wordLists: WordListMeta[],
  title: string,
  visited = new Set<string>(),
): WordListTreeNode | null {
  const meta = wordLists.find((entry) => entry.title === title);
  if (!meta) return null;
  if (visited.has(title)) {
    throw new Error(`Infinite word-list ancestry loop detected at ${title}.`);
  }
  const branchVisited = new Set(visited).add(title);
  return {
    meta,
    children: (meta.sublists ?? [])
      .map((childTitle) => buildWordListTree(wordLists, childTitle, branchVisited))
      .filter((child): child is WordListTreeNode => child !== null),
  };
}

function getWordListTreeTitles(
  root: WordListTreeNode,
  visited = new Set<string>(),
): string[] {
  if (visited.has(root.meta.title)) return [];
  visited.add(root.meta.title);
  return [
    root.meta.title,
    ...root.children.flatMap((child) => getWordListTreeTitles(child, visited)),
  ];
}
