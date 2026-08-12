import type { OATSourceData, OATTextsByScope } from "../types.js";
import { lingopOATSourceData } from "../lingop-source-data.generated.js";
import type { OATConfig } from "./config.js";
import {
  extractOATCalleeStringsFromFile,
  getAllOATSourceFiles,
} from "./source-extractor.js";

function getScopeForFile(file: string, langsByScope: Record<string, string[]>): string {
  return Object.keys(langsByScope).find((scope) => file.includes(`${scope}/`)) ?? "_";
}

function addTexts(target: Record<string, Set<string>>, scope: string, texts: string[]): void {
  const scopedTexts = (target[scope] ??= new Set<string>());
  texts.forEach((text) => scopedTexts.add(text));
}

function setsToSortedTextsByScope(
  source: Record<string, Set<string>>,
): OATTextsByScope {
  return Object.fromEntries(
    Object.entries(source)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([scope, texts]) => [
        scope,
        [...texts].sort((a, b) => a.localeCompare(b)),
      ]),
  );
}

export function collectOATSourceData(config: OATConfig): OATSourceData {
  const guiTextsByScope: Record<string, Set<string>> = {};
  const focusTextsByScope: Record<string, Set<string>> = {};
  const staticFocusTextsByScope: Record<string, Set<string>> = {};

  for (const file of getAllOATSourceFiles(config.scanDirs)) {
    const guiScope = getScopeForFile(file, config.guiLangsByScope);
    const focusScope = getScopeForFile(file, config.focusLangsByScope);
    addTexts(
      guiTextsByScope,
      guiScope,
      extractOATCalleeStringsFromFile(file, "OAT"),
    );
    addTexts(
      focusTextsByScope,
      focusScope,
      extractOATCalleeStringsFromFile(file, "OAT2"),
    );
    addTexts(
      staticFocusTextsByScope,
      focusScope,
      extractOATCalleeStringsFromFile(file, "getStaticFocusLangAText"),
    );
  }

  return {
    guiTextsByScope: setsToSortedTextsByScope(guiTextsByScope),
    focusTextsByScope: setsToSortedTextsByScope(focusTextsByScope),
    staticFocusTextsByScope: setsToSortedTextsByScope(staticFocusTextsByScope),
  };
}

export function mergeOATTextsByScope(
  allTextsByScope: OATTextsByScope[],
): OATTextsByScope {
  const merged: Record<string, Set<string>> = {};
  for (const textsByScope of allTextsByScope) {
    for (const [scope, texts] of Object.entries(textsByScope)) {
      addTexts(merged, scope, texts);
    }
  }
  return setsToSortedTextsByScope(merged);
}

export function mergeOATSourceData(allSourceData: OATSourceData[]): OATSourceData {
  return {
    guiTextsByScope: mergeOATTextsByScope(
      allSourceData.map((data) => data.guiTextsByScope),
    ),
    focusTextsByScope: mergeOATTextsByScope(
      allSourceData.map((data) => data.focusTextsByScope),
    ),
    staticFocusTextsByScope: mergeOATTextsByScope(
      allSourceData.map((data) => data.staticFocusTextsByScope),
    ),
  };
}

export function collectAllOATSourceData(config: OATConfig): OATSourceData {
  return mergeOATSourceData([
    collectOATSourceData(config),
    lingopOATSourceData,
  ]);
}
