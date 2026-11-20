import {
  GENERATED_STROKE_BUCKET_LOADERS,
  GENERATED_STROKE_CENTRELINE_LOADERS,
  GENERATED_STROKE_CONTINUATIONS,
} from "./generated-loaders.js";
import type {
  StrokeBucketLoader,
  StrokeCentreline,
  StrokeCentrelineBucketLoader,
  StrokeCharacterData,
  StrokeContinuations,
  StrokeDataProvider,
  StrokeDataSource,
} from "./types.js";

const HAN_PATTERN = /^\p{Script=Han}$/u;
const KANA_PATTERN = /^[\p{Script=Hiragana}\p{Script=Katakana}]$/u;
const JAPANESE_LANGS = new Set(["ja", "ja-jp"]);
const TRADITIONAL_CHINESE_LANGS = new Set([
  "cmn-hant",
  "zh-hk",
  "zh-hant",
  "zh-tw",
  "yue",
]);

const SOURCE_PRESENTATION: Record<
  StrokeDataSource,
  Pick<StrokeCharacterData, "viewBox" | "pathKind" | "transform">
> = {
  KANJIVG: {
    viewBox: "0 0 109 109",
    pathKind: "STROKE",
  },
  ANIMCJK_JA: {
    viewBox: "0 0 1024 1024",
    pathKind: "OUTLINE",
    transform: "translate(0 900) scale(1 -1)",
  },
  ANIMCJK_ZH_HANT: {
    viewBox: "0 0 1024 1024",
    pathKind: "OUTLINE",
    transform: "translate(0 900) scale(1 -1)",
  },
  MAKEMEAHANZI: {
    viewBox: "0 0 1024 1024",
    pathKind: "OUTLINE",
    transform: "translate(0 900) scale(1 -1)",
  },
  CANTONESE_GLYPHWIKI: {
    viewBox: "0 0 200 200",
    pathKind: "OUTLINE",
  },
};

export const STROKE_SOURCE_LABELS: Record<StrokeDataSource, string> = {
  KANJIVG: "KanjiVG",
  ANIMCJK_JA: "AnimCJK",
  ANIMCJK_ZH_HANT: "AnimCJK",
  MAKEMEAHANZI: "Make Me a Hanzi",
  CANTONESE_GLYPHWIKI: "CNS11643/Rime + GlyphWiki",
};

export function supportsStrokeOrder(lang: string | undefined): boolean {
  const normalized = lang?.trim().toLowerCase() ?? "";
  return (
    JAPANESE_LANGS.has(normalized) ||
    TRADITIONAL_CHINESE_LANGS.has(normalized)
  );
}

export function isPotentialStrokeCharacter(
  character: string,
  lang: string | undefined,
): boolean {
  const normalized = lang?.trim().toLowerCase() ?? "";
  if (TRADITIONAL_CHINESE_LANGS.has(normalized)) {
    return HAN_PATTERN.test(character);
  }
  return JAPANESE_LANGS.has(normalized)
    ? HAN_PATTERN.test(character) || KANA_PATTERN.test(character)
    : false;
}

export function getStrokeCharacters(text: string, lang: string): string[] {
  const seen = new Set<string>();
  const characters: string[] = [];
  for (const character of text.normalize("NFC")) {
    if (
      !seen.has(character) &&
      isPotentialStrokeCharacter(character, lang)
    ) {
      seen.add(character);
      characters.push(character);
    }
  }
  return characters;
}

function sourceOrder(character: string, lang: string): StrokeDataSource[] {
  const normalized = lang.trim().toLowerCase();
  if (JAPANESE_LANGS.has(normalized)) {
    if (KANA_PATTERN.test(character)) return ["ANIMCJK_JA"];
    if (HAN_PATTERN.test(character)) return ["KANJIVG", "ANIMCJK_JA"];
    return [];
  }
  if (TRADITIONAL_CHINESE_LANGS.has(normalized) && HAN_PATTERN.test(character)) {
    const sources: StrokeDataSource[] = [
      "MAKEMEAHANZI",
      "ANIMCJK_ZH_HANT",
    ];
    if (normalized === "yue" || normalized === "zh-hk") {
      sources.push("CANTONESE_GLYPHWIKI");
    }
    return sources;
  }
  return [];
}

function bucketForCharacter(character: string): string | null {
  const characters = [...character];
  if (characters.length !== 1) return null;
  const codePoint = character.codePointAt(0);
  return codePoint === undefined
    ? null
    : Math.floor(codePoint / 256).toString(16).padStart(2, "0");
}

/**
 * Groups stroke indexes into pen strokes: one group per stroke the learner
 * writes, with any continuation shapes joined to the stroke they continue.
 */
export function getPenStrokes(
  data: Pick<StrokeCharacterData, "strokes" | "continuations">,
): number[][] {
  const continued = new Set(data.continuations ?? []);
  const penStrokes: number[][] = [];
  data.strokes.forEach((_, index) => {
    const previous = penStrokes[penStrokes.length - 1];
    if (previous && continued.has(index)) previous.push(index);
    else penStrokes.push([index]);
  });
  return penStrokes;
}

/** Parses "x,y x,y" polyline points. */
export function parseStrokeCentreline(points: string): StrokeCentreline {
  const out: [number, number][] = [];
  for (const pair of points.trim().split(/\s+/u)) {
    const [x, y] = pair.split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([x!, y!]);
  }
  return out;
}

export type StrokeDataProviderOptions = {
  /** Shapes that continue the previous pen stroke, by source and character. */
  continuations?: StrokeContinuations;
  /** Lazily loaded centreline buckets, by source and code-point bucket. */
  centrelineLoaders?: Partial<
    Record<StrokeDataSource, Readonly<Record<string, StrokeCentrelineBucketLoader>>>
  >;
};

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
  return {
    async get(character, lang, options) {
      const bucket = bucketForCharacter(character);
      if (!bucket) return null;

      for (const source of sourceOrder(character, lang)) {
        const loader = loaders[source][bucket];
        if (!loader) continue;
        const centrelineLoader = options?.centrelines
          ? centrelineLoaders[source]?.[bucket]
          : undefined;
        // Load both buckets together; centrelines are only requested by views
        // that need them.
        const [pathModule, centrelineModule] = await Promise.all([
          loader(),
          centrelineLoader?.(),
        ]);
        const paths = pathModule.default[character];
        if (!paths?.length) continue;
        const presentation = SOURCE_PRESENTATION[source];
        const continued = continuations[source]?.[character]?.filter(
          (index) => index > 0 && index < paths.length,
        );
        const centrelines = centrelineModule?.default[character];
        return {
          character,
          source,
          strokes: paths,
          viewBox: presentation.viewBox,
          pathKind: presentation.pathKind,
          ...(presentation.transform
            ? { transform: presentation.transform }
            : {}),
          ...(continued?.length ? { continuations: continued } : {}),
          ...(centrelines?.length === paths.length
            ? { centrelines: centrelines.map(parseStrokeCentreline) }
            : {}),
        };
      }
      return null;
    },
  };
}

export const localStrokeDataProvider = createStrokeDataProvider();
