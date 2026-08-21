export type PrebakeConfig = {
  /** Consumer directory containing the generated `i18n/var` assets. */
  generatedAssetsRoot: string;
  /** Word-list tree whose descendants supply the titles to translate. */
  translationRootListTitle: string;
  /** Languages used for universal-title translations and static annotations. */
  allLangs: string[];
  /** Target languages used by language-specific word-list titles. */
  guiLangs: string[];
};

export function definePrebakeConfig(config: PrebakeConfig): PrebakeConfig {
  return config;
}
