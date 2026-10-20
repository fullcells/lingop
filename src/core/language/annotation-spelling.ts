import type { AnnotatedText } from "../annotation/types.js";
import type { SpellingSystem } from "./spelling-systems.js";
import { getSpellingContent } from "./spelling-content.js";

export type SpellingPart = {
  chars: string;
  spelling: string;
  /** Indices in the unchanged source token's phoneticToken (or [0] for its fallback). */
  sourcePartIndices: number[];
  unresolved: boolean;
};
export type AnnotatedSpelling = {
  lang: string;
  spellingSystem: SpellingSystem | null;
  /** Full pronunciation, independent of whether duplicate ruby is hidden. */
  text: string;
  tokens: SpellingPart[][];
};

/** Shared by renderers and build-time consumers. Never mutate source annotations. */
export async function getAnnotatedSpelling(
  annotation: Pick<AnnotatedText, "lang" | "tokens">,
  spellingSystem: SpellingSystem | null = null,
): Promise<AnnotatedSpelling> {
  const japanese = annotation.lang.toLowerCase() === "ja";
  const tokens = japanese
    ? (await import("./japanese-spelling.js")).formatJapaneseSpellings(annotation.tokens, spellingSystem)
    : await Promise.all(annotation.tokens.map(async token => Promise.all(
      (token.phoneticToken?.length ? token.phoneticToken : [[token.text]]).map(async (part, index) => ({
        chars: part[0]!,
        spelling: token.isWord !== 1 ? token.text : part.length > 1
          ? await getSpellingContent(annotation.lang, part as [string, string], spellingSystem, false)
          : part[0]!,
        sourcePartIndices: [index],
        unresolved: token.isWord === 1 && part.length < 2,
      })),
    )));
  return {
    lang: annotation.lang, spellingSystem, tokens,
    text: tokens.map(parts => parts.map(part => part.spelling || part.chars).join(japanese ? "" : " ")).join(japanese ? "" : " "),
  };
}

/** Hiding duplicate ruby is presentation only; copy/export retains the complete spelling. */
export function getSpellingPartDisplay(part: SpellingPart, lang: string, showMainText: boolean): string {
  if (part.unresolved && !part.spelling) return showMainText ? "\u00a0" : part.chars;
  if (showMainText && lang.toLowerCase() === "ja" && part.spelling === part.chars && part.chars !== "ー") return "\u00a0";
  return part.spelling;
}
