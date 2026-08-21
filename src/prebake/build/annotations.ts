import path from "node:path";
import type { AnnotatedText } from "../../core/annotation/types.js";
import {
  PREBAKE_ASSET_DIRS,
  PREBAKE_DEFAULT_ASSETS_DIR,
  PREBAKE_METADATA_FILENAME,
} from "../constants.js";
import {
  annotatePrebakeTexts,
  resetPrebakeCoreWordsCache,
  type PrebakeBuildServices,
} from "./api.js";
import type { PrebakeConfig } from "./config.js";
import { readPrebakeJsonFile, writePrebakeJsonFile } from "./file-io.js";
import type { PrebakeNeeds } from "./word-list-needs.js";

const ANNOTATION_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const ANNOTATION_BATCH_SIZE = 10;
type PrebakedAnnotations = Record<string, AnnotatedText>;

// Running full annotation refreshes during a production server start caused
// live-server crashes in OmniAccess. Keep prebake-preflight in predev/prebuild,
// not prestart. Confirmed 20260728.
//
// These annotation assets are still required by OmniAccess; only the unused
// React-context annotation API was removed from the Lingop port.
export async function runPrebakeAnnotations(
  config: PrebakeConfig,
  services: PrebakeBuildServices,
  needs: PrebakeNeeds,
  translationsWereFullyRefreshed: boolean,
): Promise<void> {
  const assetsRoot = path.join(
    config.generatedAssetsRoot,
    PREBAKE_DEFAULT_ASSETS_DIR,
  );
  const outputDir = path.join(assetsRoot, PREBAKE_ASSET_DIRS.annotations);
  const metadataPath = path.join(assetsRoot, PREBAKE_METADATA_FILENAME);
  const metadata = await readPrebakeJsonFile<Record<string, string>>(
    metadataPath,
    {},
  );
  const now = services.now?.() ?? new Date();
  const refreshKey = "annotations_last_full_refresh";
  const lastRefresh = metadata[refreshKey]
    ? new Date(metadata[refreshKey])
    : null;
  const needsFullRefresh =
    translationsWereFullyRefreshed ||
    !lastRefresh ||
    lastRefresh.getTime() < now.getTime() - ANNOTATION_REFRESH_INTERVAL_MS;

  if (needsFullRefresh) {
    console.log("🍳 Prebaked Annotations are stale — running full refresh...");
  } else {
    console.log(
      "🍳 Prebaked Annotations are fresh — generating only missing values...",
    );
  }

  for (const [lang, texts] of Object.entries(needs.annotationsByLang)) {
    const outPath = path.join(outputDir, `a.${lang}.json`);
    const existing = needsFullRefresh
      ? {}
      : await readPrebakeJsonFile<PrebakedAnnotations>(outPath, {});
    const textsToAnnotate = needsFullRefresh
      ? texts
      : texts.filter((text) => !(text in existing));

    if (textsToAnnotate.length === 0) {
      if (needsFullRefresh) writePrebakeJsonFile(outPath, {});
      continue;
    }

    console.log(` - - Prebaking new in ${lang.toUpperCase()} …`);
    // OmniAccess previously reset only the first language by accident. Each
    // language has its own backend cache direction, so reset every language
    // before its full/missing annotation batch.
    await resetPrebakeCoreWordsCache(lang, services);
    console.log(" - - - √ reset-core-sbwords successful …");

    const newAnnotationsByText: Record<string, AnnotatedText> = {};
    const remainingTexts = [...textsToAnnotate];
    while (remainingTexts.length > 0) {
      const textsBatch = remainingTexts.splice(0, ANNOTATION_BATCH_SIZE);
      console.log(" - - - remaining to annotate:", remainingTexts.length);
      const annotations = await annotatePrebakeTexts({
        lang,
        texts: textsBatch,
        ref: { dev: "prebake" },
        services,
      });
      Object.assign(
        newAnnotationsByText,
        Object.fromEntries(
          annotations.map((annotation) => [annotation.lang_text, annotation]),
        ),
      );
    }

    console.log(
      " - 🧁 Prebaked Annotations: Fresh Run:",
      lang,
      Object.keys(newAnnotationsByText),
    );
    const output = sortRecord(
      needsFullRefresh
        ? newAnnotationsByText
        : { ...existing, ...newAnnotationsByText },
    );
    writePrebakeJsonFile(outPath, output);
  }

  if (needsFullRefresh) {
    metadata[refreshKey] = now.toISOString();
    writePrebakeJsonFile(metadataPath, metadata);
    console.log("✅ Prebaked Annotations - Full Refresh Completed");
  } else {
    console.log("✅ Prebaked Annotations - Done");
  }
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );
}
