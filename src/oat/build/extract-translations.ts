import fsp from "node:fs/promises";
import path from "node:path";
import { OAT_ASSET_DIRS, OAT_SOURCE_LANG } from "../constants.js";
import { translateOATTexts, type OATBuildServices } from "./api.js";
import type { OATConfig } from "./config.js";
import { readOATJsonFile, writeOATJsonFile } from "./file-io.js";
import { collectAllOATSourceData, mergeOATTextsByScope } from "./source-data.js";

// FUTURE: NonDefault Option to set useNextJSCachedTranslations:true to use existing oa.{lang}.json data - reducing load on API calls.

export async function extractOATTranslations(
  config: OATConfig,
  services: OATBuildServices,
): Promise<void> {
  const translationsOutputDir = path.join(
    config.generatedAssetsRoot,
    OAT_ASSET_DIRS.translations,
  );
  const sourceData = collectAllOATSourceData(config);
  const oat1TextsByGuiLangPath = sourceData.guiTextsByScope;
  const oat2TextsByFocusLangPath = mergeOATTextsByScope([
    sourceData.focusTextsByScope,
    sourceData.staticFocusTextsByScope,
  ]);

  // Optional logs of the GUI and focus source strings found by path.
  writeOATJsonFile(
    path.join(translationsOutputDir, "oa._log.sources_by_path.gui.json"),
    oat1TextsByGuiLangPath,
  );
  writeOATJsonFile(
    path.join(translationsOutputDir, "oa._log.sources_by_path.focus.json"),
    oat2TextsByFocusLangPath,
  );

  // Get OAT texts by target language.
  const oatTextsByTargetLang: Record<string, Set<string>> = {};
  for (const [scope, oatTexts] of Object.entries(oat1TextsByGuiLangPath)) {
    const langsForScope = config.guiLangsByScope[scope] ?? config.allGuiLangs;
    for (const lang of langsForScope) {
      if (lang === OAT_SOURCE_LANG) continue;
      for (const text of oatTexts) {
        (oatTextsByTargetLang[lang] ??= new Set<string>()).add(text);
      }
    }
  }
  for (const [scope, oatTexts] of Object.entries(oat2TextsByFocusLangPath)) {
    const langsForScope = config.focusLangsByScope[scope] ?? config.allFocusLangs;
    for (const lang of langsForScope) {
      if (lang === OAT_SOURCE_LANG) continue;
      for (const text of oatTexts) {
        (oatTextsByTargetLang[lang] ??= new Set<string>()).add(text);
      }
    }
  }

  console.time("- extract-oat function");
  console.log(
    `- extract-oat: running on ${Object.keys(oatTextsByTargetLang).length} target languages`,
  );

  // FULL-REFRESH NECESSITY CHECK:
  const refreshKey = "translations_last_full_refresh";
  const metadataPath = path.join(translationsOutputDir, "oa._metadata.json");
  const metadata = await fsp
    .readFile(metadataPath, "utf-8")
    .then((text) => JSON.parse(text) as Record<string, string>)
    .catch((): Record<string, string> => ({}));
  const lastRefresh = metadata[refreshKey] ? new Date(metadata[refreshKey]) : null;
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const needsFullRefresh = !lastRefresh || lastRefresh < threeDaysAgo;
  if (needsFullRefresh) console.log("🌾 OATs are stale — running full refresh...");
  if (!needsFullRefresh) {
    console.log("🌾 OATs are fresh — generating only missing values...");
  }

  for (const [targetLang, oatTexts] of Object.entries(oatTextsByTargetLang)) {
    const sourceTexts = [...oatTexts];
    let sourceTextsToTranslate = sourceTexts;
    let existingData: Record<string, { t: string }> = {};
    if (!needsFullRefresh) {
      const filePath = path.join(translationsOutputDir, `oa.${targetLang}.json`);
      existingData = await readOATJsonFile<Record<string, { t: string }>>(filePath, {});
      sourceTextsToTranslate = sourceTexts.filter((text) => !(text in existingData));
    }
    if (sourceTextsToTranslate.length === 0) continue;

    console.log(
      `- extract-oat: ${oatTexts.size} ${OAT_SOURCE_LANG} → ${targetLang.toUpperCase()} (translating ${sourceTextsToTranslate.length})  …`,
    );
    const refs: unknown[] = Array(sourceTextsToTranslate.length).fill({
      dev: "OA:extract-oat",
    });
    const translations = await translateOATTexts({
      sourceTexts: sourceTextsToTranslate,
      targetLang,
      refs,
      services,
    });

    const newEntries: Record<string, { t: string }> = {};
    for (const [sourceText, targetText] of Object.entries(translations)) {
      newEntries[sourceText] = { t: targetText };
    }
    const output = Object.fromEntries(
      Object.entries({ ...existingData, ...newEntries }).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    );
    writeOATJsonFile(
      path.join(translationsOutputDir, `oa.${targetLang.toLowerCase()}.json`),
      output,
    );
    console.timeLog("- extract-oat function");
  }
  console.timeEnd("- extract-oat function");

  if (needsFullRefresh) {
    metadata[refreshKey] = new Date().toISOString();
    writeOATJsonFile(metadataPath, metadata);
    console.log("✅ OAT - Full Refresh Completed");
  } else {
    console.log("✅ OAT - Done");
  }

  // throw new Error('DEV: Stop after OAT extraction.'); // DEV: Used whilst debugging/developing.
}
