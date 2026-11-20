export type StrokeDataSource =
  | "KANJIVG"
  | "ANIMCJK_JA"
  | "ANIMCJK_ZH_HANT"
  | "MAKEMEAHANZI"
  | "CANTONESE_GLYPHWIKI";

export type StrokeCharacterData = {
  character: string;
  source: StrokeDataSource;
  strokes: readonly string[];
  viewBox: string;
  pathKind: "OUTLINE" | "STROKE";
  /** Applied to source paths before display (Hanzi Writer uses a Y-up canvas). */
  transform?: string;
  /**
   * Indexes of `strokes` that continue the preceding pen stroke. Some sources
   * draw one pen stroke as several shapes (for example the loop of あ), so the
   * shapes can overlap in the right order. Show them as one step; see
   * `getPenStrokes`.
   */
  continuations?: readonly number[];
  /**
   * The pen path through each stroke, in viewBox coordinates (after
   * `transform`). Present only when requested with `{ centrelines: true }`.
   */
  centrelines?: readonly StrokeCentreline[];
};

export type StrokePoint = readonly [x: number, y: number];
export type StrokeCentreline = readonly StrokePoint[];

export type StrokeDataRequestOptions = {
  /** Also load stroke centrelines (needed by numbered, arrow, coloured and animated views). */
  centrelines?: boolean;
};

export type StrokeContinuations = Partial<
  Record<StrokeDataSource, Readonly<Record<string, readonly number[]>>>
>;

export type StrokeDataProvider = {
  get(
    character: string,
    lang: string,
    options?: StrokeDataRequestOptions,
  ): Promise<StrokeCharacterData | null>;
};

export type StrokePathBucket = Readonly<Record<string, readonly string[]>>;

/** Per character: one SVG polyline point list ("x,y x,y") per stroke. */
export type StrokeCentrelineBucket = Readonly<Record<string, readonly string[]>>;

export type StrokeCentrelineBucketModule = {
  default: StrokeCentrelineBucket;
};

export type StrokeCentrelineBucketLoader = () => Promise<StrokeCentrelineBucketModule>;

export type StrokeBucketModule = {
  default: StrokePathBucket;
};

export type StrokeBucketLoader = () => Promise<StrokeBucketModule>;
