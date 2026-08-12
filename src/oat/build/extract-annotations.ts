import fsp from "node:fs/promises";
import path from "node:path";
import type { AnnotatedText } from "../../core/annotation/types.js";
import { OAT_ASSET_DIRS, OAT_SOURCE_LANG } from "../constants.js";
import {
  annotateOATTexts,
  resetOATCoreWordsCache,
  type OATBuildServices,
} from "./api.js";
import type { OATConfig } from "./config.js";
import { readOATJsonFile, writeOATJsonFile } from "./file-io.js";
import { collectAllOATSourceData } from "./source-data.js";

export async function extractOATAnnotations(
  config: OATConfig,
  services: OATBuildServices,
): Promise<void> {
  const translationsOutputDir = path.join(
    config.generatedAssetsRoot,
    OAT_ASSET_DIRS.translations,
  );
  const staticAnnotationsOutputDir = path.join(
    config.generatedAssetsRoot,
    OAT_ASSET_DIRS.staticAnnotations,
  );

  // Get list of 'enTexts' (for Requested AText) from code files' getStaticFocusLangAText.
  const enTextsByFocusLangPath = collectAllOATSourceData(config).staticFocusTextsByScope;

  // Get enTexts (sourceTexts of the Requested AText) by FocusLang.
  const enTextsByTargetLang: Record<string, Set<string>> = {};
  for (const [scope, siteTexts] of Object.entries(enTextsByFocusLangPath)) {
    const langsForScope = config.focusLangsByScope[scope] ?? config.allFocusLangs;
    for (const lang of langsForScope) {
      for (const text of siteTexts) {
        (enTextsByTargetLang[lang] ??= new Set<string>()).add(text);
      }
    }
  }

  // Create/Refresh /static-a8ns/a.{lang}.json
  // - :{[text:string]:AnnotatedText} <- keyed by atext.text, not enText.langText
  console.log("🏁 extract-oat-a8n function");

  // FULL-REFRESH NECESSITY CHECK:
  // - based on extract-oat's last-full-refresh, and if it recently occurred
  const refreshKey = "translations_last_full_refresh";
  const metadataPath = path.join(translationsOutputDir, "oa._metadata.json");
  const metadata = await fsp
    .readFile(metadataPath, "utf-8")
    .then((text) => JSON.parse(text) as Record<string, string>)
    .catch((): Record<string, string> => ({}));
  const lastRefresh = metadata[refreshKey] ? new Date(metadata[refreshKey]) : null;
  const oneMinAgo = new Date(Date.now() - 60 * 1000);
  const needsFullRefresh = !lastRefresh || lastRefresh > oneMinAgo;

  let haveClearedBECoreWordsCache = false;

  for (const [targetLang, enTextsSet] of Object.entries(enTextsByTargetLang)) {
    // GET L10NS MATCHING ENTEXTS
    const enTexts = [...enTextsSet];
    const localizationFilePath = path.join(
      translationsOutputDir,
      `oa.${targetLang}.json`,
    );
    const rawLocalizations = await readOATJsonFile<Record<string, { t: string }>>(
      localizationFilePath,
      {},
    );
    let matchedLocalizations = enTexts
      .filter((text) => text in rawLocalizations)
      .map((text) => rawLocalizations[text]?.t)
      .filter((text): text is string => text !== undefined);
    const missingEnTexts = enTexts.filter((text) => !(text in rawLocalizations));
    if (targetLang !== OAT_SOURCE_LANG && missingEnTexts.length > 0) {
      console.warn(
        `> ⚠️  ${targetLang.toUpperCase()}: MissingEnTexts: ${missingEnTexts}.`,
      );
    }
    // Source-language case (where /i18n/oat/oa.en.json will not exist).
    if (targetLang === OAT_SOURCE_LANG) matchedLocalizations = enTexts;

    // GET EXISTING A8NS MATCHING L10NS
    const outPath = path.join(staticAnnotationsOutputDir, `a.${targetLang}.json`);
    const existingAnnotations = await readOATJsonFile<Record<string, AnnotatedText>>(
      outPath,
      {},
    );
    let localizationsToAnnotate: string[] = [];
    if (needsFullRefresh) localizationsToAnnotate = matchedLocalizations;
    if (!needsFullRefresh) {
      localizationsToAnnotate = matchedLocalizations.filter(
        (text) => !(text in existingAnnotations),
      );
    }
    if (localizationsToAnnotate.length === 0) continue;

    console.log(
      `>> ${targetLang.toUpperCase()}: Generating/Refreshing L10n A8Ns (${localizationsToAnnotate.length}/${enTexts.length})`,
    );

    // Clear SB.Words-Cache-from-BE.
    if (!haveClearedBECoreWordsCache) {
      await resetOATCoreWordsCache(targetLang, services);
      console.log(" - - - √ reset-core-sbwords successful …");
      haveClearedBECoreWordsCache = true;
    }

    // Perform Annotation.
    const newAnnotationsByText: Record<string, AnnotatedText> = {};
    const remainingTexts = [...localizationsToAnnotate];
    while (remainingTexts.length > 0) {
      const textsBatch = remainingTexts.splice(0, 10);
      const annotations = await annotateOATTexts(targetLang, textsBatch, services);
      Object.assign(
        newAnnotationsByText,
        Object.fromEntries(
          annotations.map((annotation) => [annotation.lang_text, annotation]),
        ),
      );
    }
    console.log(
      " - 🌱 New Static Annotations:",
      targetLang,
      Object.keys(newAnnotationsByText),
    );

    // Output New + Existing A8ns, and Write to File.
    const combinedAnnotations = needsFullRefresh
      ? newAnnotationsByText
      : { ...existingAnnotations, ...newAnnotationsByText };
    const output = Object.fromEntries(
      Object.entries(combinedAnnotations).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeOATJsonFile(outPath, output);
  }

  console.log("✅ OAT-A8NS - Complete");

  // throw new Error('DEV: Stop after OAT annotation extraction.'); // DEV: Used whilst debugging/developing.
}
