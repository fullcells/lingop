#!/usr/bin/env node

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import type { OATConfig } from "./config.js";
import { runOATPreflight } from "./preflight.js";

const CONFIG_FILENAMES = [
  "oat.config.ts",
  "oat.config.mts",
  "oat.config.cts",
  "oat.config.js",
  "oat.config.mjs",
  "oat.config.cjs",
];

function findConsumerConfig(): string {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.resolve(process.cwd(), filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `oat-preflight could not find ${CONFIG_FILENAMES.join(", ")} in ${process.cwd()}.`,
  );
}

function isOATConfig(value: unknown): value is OATConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<OATConfig>;
  return (
    Array.isArray(config.scanDirs) &&
    typeof config.guiLangsByScope === "object" &&
    typeof config.focusLangsByScope === "object" &&
    Array.isArray(config.allGuiLangs) &&
    Array.isArray(config.allFocusLangs) &&
    typeof config.generatedAssetsRoot === "string" &&
    Array.isArray(config.additionalSourceData)
  );
}

async function loadConsumerConfig(): Promise<OATConfig> {
  const configPath = findConsumerConfig();
  const jiti = createJiti(pathToFileURL(import.meta.url).href);
  const loaded = (await jiti.import(configPath)) as Record<string, unknown>;
  const config = loaded.default ?? loaded.oatConfig ?? loaded;
  if (!isOATConfig(config)) {
    throw new Error(`${configPath} does not export a valid OAT config.`);
  }
  return config;
}

async function main(): Promise<void> {
  const privateOverrideKey = process.env._H_PERSONAL_OVERRIDE_KEY;
  if (!privateOverrideKey) {
    throw new Error("oat-preflight requires _H_PERSONAL_OVERRIDE_KEY.");
  }
  await runOATPreflight(await loadConsumerConfig(), { privateOverrideKey });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
