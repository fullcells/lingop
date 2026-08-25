import {
  buildWordListMetaTree,
  getListPksInWordListsMetaTree,
  loadPublicSBCacheWordListsForLang,
  loadPublicWordListMetaData,
  segmentWordListTitle,
} from "../../core/word-lists.js";
import { getPrebakedLangPairKey } from "../runtime.js";
import type { PrebakeBuildServices } from "./api.js";
import type { PrebakeConfig } from "./config.js";

export type PrebakeNeeds = {
  translationsByLangPair: Record<string, string[]>;
  annotationsByLang: Record<string, string[]>;
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
  const tree = buildWordListMetaTree(
    wordLists,
    config.translationRootListTitle,
    "_ANY",
    { throwOnCycle: true },
  );
  if (!tree) {
    throw new Error(
      `Prebake word-list root ${config.translationRootListTitle} was not found.`,
    );
  }

  const descendantTitles = new Set(getListPksInWordListsMetaTree(tree));
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
        segmentWordListTitle(entry.title).titleLabel,
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
