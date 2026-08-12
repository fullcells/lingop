export type OATConfig = {
  scanDirs: string[];
  guiLangsByScope: Record<string, string[]>;
  focusLangsByScope: Record<string, string[]>;
  allGuiLangs: string[];
  allFocusLangs: string[];
  generatedAssetsRoot: string;
};

export function defineOATConfig(config: OATConfig): OATConfig {
  return config;
}
