import type { PrebakeBuildServices } from "./api.js";
import type { PrebakeConfig } from "./config.js";
import { runPrebakeAnnotations } from "./annotations.js";
import { runPrebakeTranslations } from "./translations.js";
import { collectWordListPrebakeNeeds } from "./word-list-needs.js";

export async function runPrebakePreflight(
  config: PrebakeConfig,
  services: PrebakeBuildServices,
): Promise<void> {
  // Collect once so both generators use the same public word-list snapshot.
  const needs = await collectWordListPrebakeNeeds({ config, services });
  const translationsWereFullyRefreshed = await runPrebakeTranslations(
    config,
    services,
    needs,
  );

  // OmniAccess originally coupled annotation freshness to the translation
  // timestamp. We keep separate metadata keys (fixing that bug) while retaining
  // the useful behavior: a full translation refresh also refreshes annotations.
  await runPrebakeAnnotations(
    config,
    services,
    needs,
    translationsWereFullyRefreshed,
  );
}
