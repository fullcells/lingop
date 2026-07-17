import type { CSSProperties, ReactNode } from "react";

import type {
  AnnotatedText,
  AnnotatedToken,
  PhoneticPart,
} from "../../core/annotation/types.js";
import { ilike } from "../../core/misc.js";

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

const annotationSlotStyle: CSSProperties = {
  minHeight: "1em",
  fontSize: "0.72em",
  opacity: 0.75,
  lineHeight: 1,
};

function phoneticTokenToSpelling(
  token: AnnotatedToken,
  lang: string,
  prefShowMainText: boolean,
): string | null {
  if (!token.phoneticToken?.length) return null;

  return token.phoneticToken
    .map((part) => phoneticPartToSpelling(part, lang, prefShowMainText))
    .join("");
}

function isWordToken(token: AnnotatedToken): boolean {
  return token.isWord === 1;
}

function phoneticPartToSpelling(
  [chars, spelling]: PhoneticPart,
  lang: string,
  prefShowMainText: boolean,
): string {
  let phoneticPartSpelling = spelling ?? chars;

  if (ilike("ja", lang)) {
    // BE default is Hiragana. Hide duplicates when the main text already shows it.
    if (phoneticPartSpelling === chars && chars !== "ー" && prefShowMainText) {
      phoneticPartSpelling = visuallyEmpty;
    }
  }

  return phoneticPartSpelling;
}

function tokenToPhoneticParts(token: AnnotatedToken): PhoneticPart[] {
  return token.phoneticToken?.length ? token.phoneticToken : [[token.text]];
}

/**
 * Renders annotated text as horizontally wrapping token blocks.
 *
 * Each word token is a small vertical stack. Its phonetic parts render as
 * character groups with spelling directly above, with token gloss below.
 * Punctuation/non-word tokens keep the same vertical slots so the main text
 * baseline stays aligned with word tokens.
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
            <span
              key={key}
              aria-hidden={token.text.trim() === "" ? true : undefined}
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                minWidth: "max-content",
              }}
            >
              <span style={annotationSlotStyle}>{visuallyEmpty}</span>
              <span>{token.text}</span>
              <span style={annotationSlotStyle}>{visuallyEmpty}</span>
            </span>
          );
        }

        const prefShowMainText = true;
        const spelling = showSpelling
          ? phoneticTokenToSpelling(token, annotatedText.lang, prefShowMainText)
          : null;
        const gloss = showGloss ? token.gloss : null;
        const phoneticParts = tokenToPhoneticParts(token);
        const customTokenText = renderTokenText?.(token, index);
        const customSpelling = renderSpelling?.(token, index);

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
            {customTokenText !== undefined || customSpelling !== undefined ? (
              <>
                <span style={annotationSlotStyle}>
                  {customSpelling ?? spelling ?? visuallyEmpty}
                </span>
                <span>{customTokenText ?? token.text}</span>
              </>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "flex-end",
                }}
              >
                {phoneticParts.map((part, partIndex) => {
                  const [chars] = part;
                  const partSpelling = showSpelling
                    ? phoneticPartToSpelling(part, annotatedText.lang, prefShowMainText)
                    : visuallyEmpty;

                  return (
                    <span
                      key={`${partIndex}-${chars}`}
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        minWidth: "max-content",
                      }}
                    >
                      <span style={annotationSlotStyle}>{partSpelling}</span>
                      <span>{chars}</span>
                    </span>
                  );
                })}
              </span>
            )}
            <span style={annotationSlotStyle}>
              {renderGloss?.(token, index) ?? gloss ?? visuallyEmpty}
            </span>
          </span>
        );
      })}
    </span>
  );
}
