export type { OATBuildServices } from "./api.js";
export { defineOATConfig, type OATConfig } from "./config.js";
export { runOATPreflight } from "./preflight.js";
export {
  collectAllOATSourceData,
  collectOATSourceData,
  mergeOATSourceData,
  mergeOATTextsByScope,
} from "./source-data.js";
