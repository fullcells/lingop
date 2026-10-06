export { definePrebakeConfig, type PrebakeConfig } from "./config.js";

// Explicit opt-in: existing V2 Prebake consumers keep their current behavior.
export { prepareWordListsV3, collectPublicWordListsV3, getWordListAnnotationGlosses,
  type WordListsV3Enrichment, type PreparedWordV3, type PreparedListV3,
  type PreparedWordListsV3 } from './word-lists-v3.js';
