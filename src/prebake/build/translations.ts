import path from "node:path";
import {
  PREBAKE_ASSET_DIRS,
  PREBAKE_DEFAULT_ASSETS_DIR,
  PREBAKE_METADATA_FILENAME,
} from "../constants.js";
import type { PrebakedTranslations } from "../types.js";
import { translatePrebakeTexts, type PrebakeBuildServices } from "./api.js";
import type { PrebakeConfig } from "./config.js";
import { readPrebakeJsonFile, writePrebakeJsonFile } from "./file-io.js";
import type { PrebakeNeeds } from "./word-list-needs.js";

const TRANSLATION_REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

// Word-list title labels change infrequently. A three-day full refresh keeps
// existing translations current; intervening prebuilds request only new labels.
// This is the same refresh policy used by OmniAccess.
export async function runPrebakeTranslations(
  config: PrebakeConfig,
  services: PrebakeBuildServices,
  needs: PrebakeNeeds,
): Promise<boolean> {
  const assetsRoot = path.join(
    config.generatedAssetsRoot,
    PREBAKE_DEFAULT_ASSETS_DIR,
  );
  const outputDir = path.join(assetsRoot, PREBAKE_ASSET_DIRS.translations);
  const metadataPath = path.join(assetsRoot, PREBAKE_METADATA_FILENAME);
  const metadata = await readPrebakeJsonFile<Record<string, string>>(
    metadataPath,
    {},
  );
  const now = services.now?.() ?? new Date();
  const refreshKey = "translations_last_full_refresh";
  const lastRefresh = metadata[refreshKey]
    ? new Date(metadata[refreshKey])
    : null;
  const needsFullRefresh =
    !lastRefresh ||
    lastRefresh.getTime() < now.getTime() - TRANSLATION_REFRESH_INTERVAL_MS;

  if (needsFullRefresh) {
    console.log("🍳 Prebaked Translations are stale — running full refresh...");
  } else {
    console.log(
      "🍳 Prebaked Translations are fresh — generating only missing values...",
    );
  }

  for (const [langPair, sourceTexts] of Object.entries(
    needs.translationsByLangPair,
  )) {
    const parsedLangPair = parseLangPair(langPair);
    if (!parsedLangPair) {
      throw new Error(
        `Invalid prebake language pair ${langPair}; expected source-to-target.`,
      );
    }
    const { sourceLang, targetLang } = parsedLangPair;
    const outPath = path.join(outputDir, `t.${langPair}.json`);
    const existing = needsFullRefresh
      ? {}
      : await readPrebakeJsonFile<PrebakedTranslations>(outPath, {});
    const sourceTextsToTranslate = needsFullRefresh
      ? sourceTexts
      : sourceTexts.filter((text) => !(text in existing));

    if (sourceTextsToTranslate.length === 0) {
      if (needsFullRefresh) writePrebakeJsonFile(outPath, {});
      continue;
    }

    const translations = await translatePrebakeTexts({
      sourceLang,
      sourceTexts: sourceTextsToTranslate,
      targetLang,
      refs: Array(sourceTextsToTranslate.length).fill({ dev: "prebake" }),
      services,
    });
    console.log(
      " - 🥮 Prebaked Translations: Fresh Run:",
      langPair,
      translations,
    );

    const output = sortRecord(
      needsFullRefresh ? translations : { ...existing, ...translations },
    );
    writePrebakeJsonFile(outPath, output);
  }

  if (needsFullRefresh) {
    metadata[refreshKey] = now.toISOString();
    writePrebakeJsonFile(metadataPath, metadata);
    console.log("✅ Prebaked Translations - Full Refresh Completed");
  } else {
    console.log("✅ Prebaked Translations - Done");
  }
  return needsFullRefresh;
}

function parseLangPair(
  langPair: string,
): { sourceLang: string; targetLang: string } | null {
  const match = /^(.+)-to-(.+)$/.exec(langPair);
  return match?.[1] && match[2]
    ? { sourceLang: match[1], targetLang: match[2] }
    : null;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );
}
