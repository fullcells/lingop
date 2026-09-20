export type StrokeDataSource =
  | "KANJIVG"
  | "ANIMCJK_JA"
  | "ANIMCJK_ZH_HANT"
  | "MAKEMEAHANZI";

export type StrokeCharacterData = {
  character: string;
  source: StrokeDataSource;
  strokes: readonly string[];
  viewBox: string;
  pathKind: "OUTLINE" | "STROKE";
  /** Applied to source paths before display (Hanzi Writer uses a Y-up canvas). */
  transform?: string;
};

export type StrokeDataProvider = {
  get(character: string, lang: string): Promise<StrokeCharacterData | null>;
};

export type StrokePathBucket = Readonly<Record<string, readonly string[]>>;

export type StrokeBucketModule = {
  default: StrokePathBucket;
};

export type StrokeBucketLoader = () => Promise<StrokeBucketModule>;

