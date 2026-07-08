import type { CSSProperties, ReactNode } from "react";

import type { AnnotatedText, AnnotatedToken } from "../../core/annotation/types.js";

export type AnnotatedTextViewProps = {
  annotatedText: AnnotatedText;
  className?: string;
  style?: CSSProperties;
  tokenClassName?: string;
  tokenStyle?: CSSProperties;
  showSpelling?: boolean;
  showGloss?: boolean;
  renderTokenText?: (token: AnnotatedToken, index: number) => ReactNode;
  renderSpelling?: (token: AnnotatedToken, index: number) => ReactNode;
  renderGloss?: (token: AnnotatedToken, index: number) => ReactNode;
};

const visuallyEmpty = "\u00a0";

function phoneticTokenToSpelling(token: AnnotatedToken): string | null {
  if (!token.phoneticToken?.length) return null;

  return token.phoneticToken
    .map(([chars, spelling]) => spelling ?? chars)
    .join("");
}

function isWordToken(token: AnnotatedToken): boolean {
  return token.isWord === 1;
}

/**
 * Renders annotated text as horizontally wrapping token blocks.
 *
 * Each word token is a small vertical stack:
 *   spelling/phonetic text above, source token in the middle, gloss below.
 * Punctuation/non-word tokens render as plain inline text so they stay tight.
 */
export function AnnotatedTextView({
  annotatedText,
  className,
  style,
  tokenClassName,
  tokenStyle,
  showSpelling = true,
  showGloss = true,
  renderTokenText,
  renderSpelling,
  renderGloss,
}: AnnotatedTextViewProps): ReactNode {
  return (
    <span
      className={className}
      lang={annotatedText.lang}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        columnGap: "0.35em",
        rowGap: "0.25em",
        lineHeight: 1.2,
        ...style,
      }}
    >
      {annotatedText.tokens.map((token, index) => {
        const key = `${index}-${token.text}`;

        if (!isWordToken(token)) {
          return (
            <span key={key} aria-hidden={token.text.trim() === "" ? true : undefined}>
              {token.text}
            </span>
          );
        }

        const spelling = showSpelling ? phoneticTokenToSpelling(token) : null;
        const gloss = showGloss ? token.gloss : null;

        return (
          <span
            key={key}
            className={tokenClassName}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              minWidth: "max-content",
              ...tokenStyle,
            }}
          >
            <span
              style={{
                minHeight: "1em",
                fontSize: "0.72em",
                opacity: 0.75,
                lineHeight: 1,
              }}
            >
              {renderSpelling?.(token, index) ?? spelling ?? visuallyEmpty}
            </span>
            <span>{renderTokenText?.(token, index) ?? token.text}</span>
            <span
              style={{
                minHeight: "1em",
                fontSize: "0.72em",
                opacity: 0.75,
                lineHeight: 1,
              }}
            >
              {renderGloss?.(token, index) ?? gloss ?? visuallyEmpty}
            </span>
          </span>
        );
      })}
    </span>
  );
}
