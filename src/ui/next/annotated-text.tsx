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

// 20260821: AnnotatedTextView is being ported gradually from OmniAccess.
// This first pass only ports the render-component structure. Action Buttons,
// TTS, ON_HINT state (including l10nWordDetailHandler, isWordUnfamiliar, and
// userWordStreaks), useUserLingoPrefsData, download-as-image, and the other
// OmniAccess behavior are intentionally not ported yet.
type TokenSpellingAndMainViewProps = {
  token: AnnotatedToken;
  tokenIndex: number;
  lang: string;
  showSpelling: boolean;
  renderTokenText:
    | ((token: AnnotatedToken, index: number) => ReactNode)
    | undefined;
  renderSpelling:
    | ((token: AnnotatedToken, index: number) => ReactNode)
    | undefined;
};

function TokenSpellingAndMainView({
  token,
  tokenIndex,
  lang,
  showSpelling,
  renderTokenText,
  renderSpelling,
}: TokenSpellingAndMainViewProps): ReactNode {
  if (!isWordToken(token)) {
    return (
      <>
        <TokenSpellingTextSpan>{visuallyEmpty}</TokenSpellingTextSpan>
        <TokenMainTextSpan>{token.text}</TokenMainTextSpan>
      </>
    );
  }

  const prefShowMainText = true;
  const spelling = showSpelling
    ? phoneticTokenToSpelling(token, lang, prefShowMainText)
    : null;
  const customTokenText = renderTokenText?.(token, tokenIndex);
  const customSpelling = renderSpelling?.(token, tokenIndex);

  if (customTokenText !== undefined || customSpelling !== undefined) {
    return (
      <>
        <TokenSpellingTextSpan>
          {customSpelling ?? spelling ?? visuallyEmpty}
        </TokenSpellingTextSpan>
        <TokenMainTextSpan>{customTokenText ?? token.text}</TokenMainTextSpan>
      </>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
      }}
    >
      {tokenToPhoneticParts(token).map((part, partIndex) => {
        const [chars] = part;
        const partSpelling = showSpelling
          ? phoneticPartToSpelling(part, lang, prefShowMainText)
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
            <TokenSpellingTextSpan>{partSpelling}</TokenSpellingTextSpan>
            <TokenMainTextSpan>{chars}</TokenMainTextSpan>
          </span>
        );
      })}
    </span>
  );
}

function TokenSpellingTextSpan({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <span style={annotationSlotStyle}>{children}</span>;
}

function TokenMainTextSpan({ children }: { children: ReactNode }): ReactNode {
  return <span>{children}</span>;
}

type TokenGlossViewProps = {
  token: AnnotatedToken;
  tokenIndex: number;
  showGloss: boolean;
  renderGloss:
    | ((token: AnnotatedToken, index: number) => ReactNode)
    | undefined;
};

function TokenGlossView({
  token,
  tokenIndex,
  showGloss,
  renderGloss,
}: TokenGlossViewProps): ReactNode {
  if (!isWordToken(token)) {
    return <span style={annotationSlotStyle}>{visuallyEmpty}</span>;
  }

  const gloss = showGloss ? token.gloss : null;

  return (
    <span style={annotationSlotStyle}>
      {renderGloss?.(token, tokenIndex) ?? gloss ?? visuallyEmpty}
    </span>
  );
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

        return (
          <span
            key={key}
            className={isWordToken(token) ? tokenClassName : undefined}
            aria-hidden={
              !isWordToken(token) && token.text.trim() === "" ? true : undefined
            }
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              minWidth: "max-content",
              ...(isWordToken(token) ? tokenStyle : undefined),
            }}
          >
            <TokenSpellingAndMainView
              token={token}
              tokenIndex={index}
              lang={annotatedText.lang}
              showSpelling={showSpelling}
              renderTokenText={renderTokenText}
              renderSpelling={renderSpelling}
            />
            <TokenGlossView
              token={token}
              tokenIndex={index}
              showGloss={showGloss}
              renderGloss={renderGloss}
            />
          </span>
        );
      })}
    </span>
  );
}
