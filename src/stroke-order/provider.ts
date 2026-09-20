import { GENERATED_STROKE_BUCKET_LOADERS } from "./generated-loaders.js";
import type {
  StrokeBucketLoader,
  StrokeCharacterData,
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
};

export const STROKE_SOURCE_LABELS: Record<StrokeDataSource, string> = {
  KANJIVG: "KanjiVG",
  ANIMCJK_JA: "AnimCJK",
  ANIMCJK_ZH_HANT: "AnimCJK",
  MAKEMEAHANZI: "Make Me a Hanzi",
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
    return ["MAKEMEAHANZI", "ANIMCJK_ZH_HANT"];
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

export function createStrokeDataProvider(
  loaders: Record<
    StrokeDataSource,
    Readonly<Record<string, StrokeBucketLoader>>
  > = GENERATED_STROKE_BUCKET_LOADERS,
): StrokeDataProvider {
  return {
    async get(character, lang) {
      const bucket = bucketForCharacter(character);
      if (!bucket) return null;

      for (const source of sourceOrder(character, lang)) {
        const loader = loaders[source][bucket];
        if (!loader) continue;
        const paths = (await loader()).default[character];
        if (!paths?.length) continue;
        const presentation = SOURCE_PRESENTATION[source];
        return {
          character,
          source,
          strokes: paths,
          viewBox: presentation.viewBox,
          pathKind: presentation.pathKind,
          ...(presentation.transform
            ? { transform: presentation.transform }
            : {}),
        };
      }
      return null;
    },
  };
}

export const localStrokeDataProvider = createStrokeDataProvider();
