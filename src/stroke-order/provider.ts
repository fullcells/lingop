import {
  GENERATED_STROKE_BUCKET_LOADERS,
  GENERATED_STROKE_CENTRELINE_LOADERS,
  GENERATED_STROKE_CONTINUATIONS,
} from "./generated-loaders.js";
import { providerFromBuckets, type StrokeDataProviderOptions } from "./provider-core.js";
import type { StrokeBucketLoader, StrokeDataProvider, StrokeDataSource } from "./types.js";

export {
  getPenStrokes,
  getStrokeCharacters,
  isPotentialStrokeCharacter,
  parseStrokeCentreline,
  STROKE_SOURCE_LABELS,
  supportsStrokeOrder,
  type StrokeDataProviderOptions,
} from "./provider-core.js";

export function createStrokeDataProvider(
  loaders: Record<
    StrokeDataSource,
    Readonly<Record<string, StrokeBucketLoader>>
  > = GENERATED_STROKE_BUCKET_LOADERS,
  {
    continuations = GENERATED_STROKE_CONTINUATIONS,
    centrelineLoaders = GENERATED_STROKE_CENTRELINE_LOADERS,
  }: StrokeDataProviderOptions = {},
): StrokeDataProvider {
  return providerFromBuckets(loaders, continuations, centrelineLoaders);
}

export const localStrokeDataProvider = createStrokeDataProvider();
