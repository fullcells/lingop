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
};

export type StrokeContinuations = Partial<
  Record<StrokeDataSource, Readonly<Record<string, readonly number[]>>>
>;

export type StrokeDataProvider = {
  get(character: string, lang: string): Promise<StrokeCharacterData | null>;
};

export type StrokePathBucket = Readonly<Record<string, readonly string[]>>;

export type StrokeBucketModule = {
  default: StrokePathBucket;
};

export type StrokeBucketLoader = () => Promise<StrokeBucketModule>;
