import { providerFromBuckets } from "./provider-core.js";
import {
  GENERATED_STROKE_BUCKET_LOADERS,
  GENERATED_STROKE_CENTRELINE_LOADERS,
  GENERATED_STROKE_CONTINUATIONS,
} from "./generated-browser-loaders.js";

export const localStrokeDataProvider = providerFromBuckets(
  GENERATED_STROKE_BUCKET_LOADERS,
  GENERATED_STROKE_CONTINUATIONS,
  GENERATED_STROKE_CENTRELINE_LOADERS,
);
