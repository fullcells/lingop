#!/usr/bin/env node

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import type { PrebakeConfig } from "./config.js";
import { runPrebakePreflight } from "./preflight.js";

const CONFIG_FILENAMES = [
  "prebake.config.ts",
  "prebake.config.mts",
  "prebake.config.cts",
  "prebake.config.js",
  "prebake.config.mjs",
  "prebake.config.cjs",
];

function findConsumerConfig(): string {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.resolve(process.cwd(), filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `prebake-preflight could not find ${CONFIG_FILENAMES.join(", ")} in ${process.cwd()}.`,
  );
}

function isPrebakeConfig(value: unknown): value is PrebakeConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<PrebakeConfig>;
  return (
    typeof config.generatedAssetsRoot === "string" &&
    typeof config.translationRootListTitle === "string" &&
    Array.isArray(config.allLangs) &&
    Array.isArray(config.guiLangs)
  );
}

async function loadConsumerConfig(): Promise<PrebakeConfig> {
  const configPath = findConsumerConfig();
  const jiti = createJiti(pathToFileURL(import.meta.url).href);
  const loaded = (await jiti.import(configPath)) as Record<string, unknown>;
  const config = loaded.default ?? loaded.prebakeConfig ?? loaded;
  if (!isPrebakeConfig(config)) {
    throw new Error(`${configPath} does not export a valid Prebake config.`);
  }
  return config;
}

async function main(): Promise<void> {
  const privateOverrideKey = process.env._H_PERSONAL_OVERRIDE_KEY;
  if (!privateOverrideKey) {
    throw new Error("prebake-preflight requires _H_PERSONAL_OVERRIDE_KEY.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      "prebake-preflight requires NEXT_PUBLIC_SUPABASE_URL and a public Supabase key.",
    );
  }
  await runPrebakePreflight(await loadConsumerConfig(), {
    privateOverrideKey,
    supabaseUrl,
    supabasePublicKey,
    ...(process.env.LINGOP_USE_STAGING_BACKEND === "true"
      ? { useStagingBackend: true }
      : {}),
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
