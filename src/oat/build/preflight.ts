import type { OATBuildServices } from "./api.js";
import type { OATConfig } from "./config.js";
import { extractOATAnnotations } from "./extract-annotations.js";
import { extractOATTranslations } from "./extract-translations.js";

export async function runOATPreflight(
  config: OATConfig,
  services: OATBuildServices,
): Promise<void> {
  await extractOATTranslations(config, services);
  await extractOATAnnotations(config, services);
}
