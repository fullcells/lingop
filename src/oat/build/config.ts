import type { OATSourceData } from "../types.js";

export type OATConfig = {
  scanDirs: string[];
  guiLangsByScope: Record<string, string[]>;
  focusLangsByScope: Record<string, string[]>;
  allGuiLangs: string[];
  allFocusLangs: string[];
  generatedAssetsRoot: string;
  additionalSourceData: OATSourceData[];
};

type OATConfigInput = Omit<OATConfig, "additionalSourceData"> & {
  /**
   * OAT calls inside a shared package are not visible when only consumer source directories are scanned.
   * Such packages should publish extracted OATSourceData which consumers add here. In future, the shared
   * package could instead provide prebuilt translated assets (Option 4), but that is intentionally deferred:
   * keeping those assets fresh across package and consumer releases is harder and needs a more mature design.
   */
  additionalSourceData?: OATSourceData[];
};

export function defineOATConfig(config: OATConfigInput): OATConfig {
  return {
    ...config,
    additionalSourceData: config.additionalSourceData ?? [],
  };
}
