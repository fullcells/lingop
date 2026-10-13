import type { OATBuildServices } from "./api.js";
import type { OATConfig } from "./config.js";
import { extractOATAnnotations } from "./extract-annotations.js";
import { extractOATTranslations } from "./extract-translations.js";
import { collectAllOATSourceData } from "./source-data.js";

export async function runOATPreflight(
  config: OATConfig,
  services: OATBuildServices,
): Promise<void> {
  const sourceData = collectAllOATSourceData(config);
  await extractOATTranslations(config, services, sourceData);
  await extractOATAnnotations(config, services, sourceData);
}
