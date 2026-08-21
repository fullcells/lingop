import type { CSSProperties, ReactNode } from "react";

import type {
  AnnotatedText,
  AnnotatedToken,
  PhoneticPart,
} from "../../core/annotation/types.js";
import { ilike } from "../../core/misc.js";

export type AnnotatedTextViewProps = {
  annotatedText: AnnotatedText;
  showSpelling?: "NEVER" | "ALWAYS"; // ON_HINT state is not ported yet.
  showMainText?: boolean;
  showGloss?: "NEVER" | "ALWAYS"; // ON_HINT state is not ported yet.
};

const visuallyEmpty = "\u00a0";

const annotationSlotStyle: CSSProperties = {
  minHeight: "1em",
  fontSize: "0.72em",
  opacity: 0.75,
  lineHeight: 1,
};

function isWordToken(token: AnnotatedToken): boolean {
  return token.isWord === 1;
}

function phoneticPartToSpelling(
  [chars, spelling]: PhoneticPart,
  lang: string,
  showMainText: boolean,
): string {
  let phoneticPartSpelling = spelling ?? chars;

  if (ilike("ja", lang)) {
    // BE default is Hiragana. Hide duplicates when the main text already shows it.
    if (phoneticPartSpelling === chars && chars !== "ー" && showMainText) {
      phoneticPartSpelling = visuallyEmpty;
    }
  }

  return phoneticPartSpelling;
}

function tokenToPhoneticParts(token: AnnotatedToken): PhoneticPart[] {
  return token.phoneticToken?.length ? token.phoneticToken : [[token.text]];
}

// 20260821: AnnotatedTextView is being ported gradually from OmniAccess.
// The current port only includes the basic render-component structure and
// visibility inputs. Action Buttons, TTS, ON_HINT state (including
// l10nWordDetailHandler, isWordUnfamiliar, and userWordStreaks),
// useUserLingoPrefsData, download-as-image, and the other OmniAccess behavior
// are intentionally not ported yet.
type TokenSpellingAndMainViewProps = {
  _showSpelling: "NEVER" | "ALWAYS";
  _showMainText: boolean;
  annotatedText: AnnotatedText;
  token: AnnotatedToken;
};

function TokenSpellingAndMainView({
  _showSpelling,
  _showMainText,
  annotatedText,
  token,
}: TokenSpellingAndMainViewProps): ReactNode {
  if (!_showMainText && _showSpelling === "NEVER") return null;

  if (!isWordToken(token)) {
    return (
      <>
        <TokenSpellingTextSpan>
          {_showSpelling === "ALWAYS" && !_showMainText
            ? token.text
            : visuallyEmpty}
        </TokenSpellingTextSpan>
        {_showMainText && <TokenMainTextSpan>{token.text}</TokenMainTextSpan>}
      </>
    );
  }

  return (
    <span
      className="token-phonics"
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
      }}
    >
      {tokenToPhoneticParts(token).map((part, partIndex) => {
        const [chars] = part;
        const partSpelling = _showSpelling === "ALWAYS"
          ? phoneticPartToSpelling(part, annotatedText.lang, _showMainText)
          : visuallyEmpty;

        return (
          <span
            key={`${partIndex}-${chars}`}
            className="phonic"
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: "max-content",
            }}
          >
            <TokenSpellingTextSpan>{partSpelling}</TokenSpellingTextSpan>
            {_showMainText && <TokenMainTextSpan>{chars}</TokenMainTextSpan>}
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
  return (
    <span className="phonic-spelling" style={annotationSlotStyle}>
      {children}
    </span>
  );
}

function TokenMainTextSpan({ children }: { children: ReactNode }): ReactNode {
  return <span className="main-text">{children}</span>;
}

type TokenGlossViewProps = {
  token: AnnotatedToken;
  showGloss: "NEVER" | "ALWAYS";
};

function TokenGlossView({
  token,
  showGloss,
}: TokenGlossViewProps): ReactNode {
  if (!isWordToken(token)) {
    return (
      <span className="gloss" style={annotationSlotStyle}>
        {visuallyEmpty}
      </span>
    );
  }

  const gloss = showGloss === "ALWAYS" ? token.gloss : null;

  return (
    <span className="gloss" style={annotationSlotStyle}>
      {gloss ?? visuallyEmpty}
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
  showSpelling = "ALWAYS",
  showMainText = true,
  showGloss = "ALWAYS",
}: AnnotatedTextViewProps): ReactNode {
  return (
    <span
      className="annotated-text-view"
      lang={annotatedText.lang}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        columnGap: "0.35em",
        rowGap: "0.25em",
        lineHeight: 1.2,
      }}
    >
      <span className="tokens" style={{ display: "contents" }}>
        {annotatedText.tokens.map((token, index) => {
          const key = `${index}-${token.text}`;

          return (
            <span
              key={key}
              className="token"
              aria-hidden={
                !isWordToken(token) && token.text.trim() === ""
                  ? true
                  : undefined
              }
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                minWidth: "max-content",
              }}
            >
              <TokenSpellingAndMainView
                _showSpelling={showSpelling}
                _showMainText={showMainText}
                annotatedText={annotatedText}
                token={token}
              />
              <TokenGlossView token={token} showGloss={showGloss} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
