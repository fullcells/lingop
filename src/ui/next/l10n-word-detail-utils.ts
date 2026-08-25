import { linearizeTemplaticAText } from "../../core/annotation/converters.js";
import type {
  AnnotatedText,
  ATokenSubMorphemes,
} from "../../core/annotation/types.js";

export type FormattedL10nWordDetail = {
  annotatedText: AnnotatedText;
  wordSubMorphemes: ATokenSubMorphemes;
};

/**
 * Narrows an annotation to the selected word. Raw root-and-pattern annotation
 * must be linearized before indexing because one displayed token can represent
 * multiple stored morphemes.
 */
export function formatL10nWordAsAnnotatedText(
  annotatedText: AnnotatedText,
  tokenIndex = 0,
): FormattedL10nWordDetail | null {
  const { linearizedAText, morphemesPerLinearToken } =
    linearizeTemplaticAText(annotatedText);
  const token = linearizedAText.tokens[tokenIndex];
  if (!token) return null;

  // Direct raw-word callers historically omitted wordSubMorphemes. Preserve
  // the detail/action path by treating the selected token as one morpheme.
  const wordSubMorphemes = morphemesPerLinearToken[tokenIndex] ?? [
    { morpheme: token.text, gloss: token.gloss ?? "" },
  ];

  return {
    annotatedText: {
      ...linearizedAText,
      lang_text: token.text,
      tokens: [token],
    },
    wordSubMorphemes,
  };
}
