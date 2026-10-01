import { linearizeTemplaticAText } from "../../core/annotation/converters.js";
import type { AnnotatedText, AnnotatedToken } from "../../core/annotation/types.js";
import { getLang, getLangScript } from "../../core/language/utils.js";
import { stripDisambiguatorFromToken } from "../../core/misc.js";
import { groupAnnotatedTokensToPreventWidows } from "../annotated-text-utils.js";

/** Keep source indices across explicit line breaks and templatic linearization. */
export function prepareAnnotatedText(annotatedText: AnnotatedText) {
  const { linearizedAText, morphemesPerLinearToken } =
    linearizeTemplaticAText(annotatedText);
  const tokens = linearizedAText.tokens.map(stripDisambiguatorFromToken);
  const lines: { token: AnnotatedToken; index: number }[][] = [[]];

  tokens.forEach((token, index) => {
    const fragments = token.text.split(/\r\n|\r|\n/);
    fragments.forEach((text, fragmentIndex) => {
      if (fragmentIndex > 0) lines.push([]);
      if (!text) return;
      // Multi-line source tokens cannot retain phonetics aligned to the entire
      // original token. Preserve their surface text instead of duplicating it.
      const fragment = fragments.length === 1
        ? token
        : { ...token, text, phoneticToken: null };
      lines[lines.length - 1]!.push({ token: fragment, index });
    });
  });

  const lang = getLang(annotatedText.lang);
  const direction: "ltr" | "rtl" = lang && getLangScript(lang.g_script)?.is_ltr === false
    ? "rtl"
    : "ltr";

  return {
    direction,
    tokens,
    morphemesPerLinearToken,
    lines: lines.map((line) =>
      groupAnnotatedTokensToPreventWidows(line.map(({ token }) => token))
        .map((group) => group.map(({ index }) => line[index]!)),
    ),
  };
}
