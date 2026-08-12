export const OAT_SOURCE_LANG = "en";

// OAT owns this relative asset layout. Consumers only choose its physical output root.
export const OAT_ASSET_DIRS = {
  translations: "i18n/oat",
  staticAnnotations: "i18n/static-a8ns",
} as const;
