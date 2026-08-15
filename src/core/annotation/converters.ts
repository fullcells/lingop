import type {
  ATokenSubMorphemes,
  AnnotatedText,
  AnnotatedToken,
  AnnotationEntry,
  AnnotationEntry_LangTokens,
} from "./types.js";

type AnnotatedTokenConversionInput = {
  lang: string;
  lang_text: string;
  tokens: AnnotatedToken[];
  ref: unknown | null;
  owner_id: string | null;
};

function hasOwnOptionalField<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isAlignedLength(
  expectedLength: number,
  values: unknown[] | null | undefined,
): boolean {
  return !values || values.length === expectedLength;
}

function reportMalformedAnnotation(): null {
  console.error("Malformed annotation data.");
  return null;
}

export function convertAnnotatedEntryToAText(
  rawAnnotationEntry: AnnotationEntry,
): AnnotatedText | null {
  if (!rawAnnotationEntry) return null;

  const {
    lang,
    lang_text,
    lang_tokens,
    lang_gloss,
    lang_phonetics_2,
    ref,
    owner_id,
  } = rawAnnotationEntry;

  if (!lang_tokens?.texts || !lang_tokens?.isWordList) {
    return reportMalformedAnnotation();
  }

  const tokenCount = lang_tokens.texts.length;

  if (
    lang_tokens.isWordList.length !== tokenCount ||
    !isAlignedLength(tokenCount, lang_gloss) ||
    !isAlignedLength(tokenCount, lang_phonetics_2)
  ) {
    return reportMalformedAnnotation();
  }

  const containsGloss = !!lang_gloss;
  const containsPhonetics = !!lang_phonetics_2;

  const tokens: AnnotatedToken[] = lang_tokens.texts.map((text, index) => {
    const token: AnnotatedToken = {
      text,
      isWord: lang_tokens.isWordList[index] ?? 0,
    };

    if (containsGloss) {
      token.gloss = lang_gloss[index] ?? null;
    }

    if (containsPhonetics) {
      token.phoneticToken = lang_phonetics_2[index] ?? null;
    }

    return token;
  });

  return {
    lang,
    lang_text,
    tokens,
    containsGloss,
    containsPhonetics,
    ref,
    owner_id,
  };
}

export function convertAnnotatedTokensToAEntry({
  lang,
  lang_text,
  tokens,
  ref,
  owner_id,
}: AnnotatedTokenConversionInput): AnnotationEntry {
  const tokensHadGloss = tokens.some((token) => hasOwnOptionalField(token, "gloss"));
  const tokensHadPhoneticToken = tokens.some((token) =>
    hasOwnOptionalField(token, "phoneticToken"),
  );

  const lang_tokens: AnnotationEntry_LangTokens = {
    texts: tokens.map((token) => token.text),
    isWordList: tokens.map((token) => token.isWord),
  };

  const entry: AnnotationEntry = {
    lang,
    lang_text,
    lang_tokens,
    ref,
    owner_id,
  };

  if (tokensHadGloss) {
    entry.lang_gloss = tokens.map((token) => token.gloss ?? null);
  }

  if (tokensHadPhoneticToken) {
    entry.lang_phonetics_2 = tokens.map((token) => token.phoneticToken ?? null);
  }

  return entry;
}

export function convertAnnotatedTokensToAText({
  lang,
  lang_text,
  tokens,
  ref,
  owner_id,
}: AnnotatedTokenConversionInput): AnnotatedText | null {
  const tokensHadGloss = tokens.some((token) => hasOwnOptionalField(token, "gloss"));
  const tokensHadPhoneticToken = tokens.some((token) =>
    hasOwnOptionalField(token, "phoneticToken"),
  );

  return {
    lang,
    lang_text,
    tokens,
    containsGloss: tokensHadGloss,
    containsPhonetics: tokensHadPhoneticToken,
    ref,
    owner_id,
  };
}

export function convertAnnotatedTextToFullPhoneticString(atext: AnnotatedText): string {
  return atext.tokens
    .map((token) =>
      token.phoneticToken?.length
        ? token.phoneticToken.map(([chars, spelling]) => spelling ?? chars).join("")
        : token.text,
    )
    .join(" ");
}

export function convertAnnotatedTextToFullGlossString(atext: AnnotatedText): string {
  return atext.tokens.map((token) => token.gloss ?? token.text).join(" ");
}

export function convertATokensToAEntryLangTokens(
  annotatedTokens: AnnotatedToken[],
): AnnotationEntry_LangTokens | null {
  if (!annotatedTokens) return null;

  return {
    texts: annotatedTokens.map((token) => token.text),
    isWordList: annotatedTokens.map((token) => token.isWord),
  };
}

// Handle root-and-pattern languages' raw AnnotatedText.
export function linearizeTemplaticAText(
  nonlinearTemplaticAText: AnnotatedText,
): {
  linearizedAText: AnnotatedText;
  morphemesPerLinearToken: ATokenSubMorphemes[];
} {
  const asMorphemes = (token: AnnotatedToken): ATokenSubMorphemes => [
    { morpheme: token.text, gloss: token.gloss ?? "" },
  ];
  const atext = nonlinearTemplaticAText;

  // Filter out languages that don't use root-and-pattern/nonconsecutive morphology.
  if (!["mt", "ar", "arz"].includes(atext.lang)) {
    return {
      linearizedAText: atext,
      morphemesPerLinearToken: atext.tokens.map(asMorphemes),
    };
  }
  if (atext.containsPhonetics) {
    console.warn(
      "linearizeTemplaticAText - wasn't expected to apply to languages with phonetics",
    );
  }

  const isRoot = (token: AnnotatedToken | undefined): token is AnnotatedToken =>
    Boolean(token?.isWord && token.text.startsWith("√"));
  const isPattern = (token: AnnotatedToken | undefined): token is AnnotatedToken =>
    Boolean(token?.isWord && token.text.includes("•"));

  const chars = (value: string): string[] => Array.from(value);
  const len = (value: string): number => chars(value).length;

  const weave = (root: string, pattern: string): string => {
    const rootChars = chars(root.replace(/^√/, "").replace(/[\s._-]/g, ""));
    let rootIndex = 0;

    return (
      chars(pattern)
        .map((char) => (char === "•" ? (rootChars[rootIndex++] ?? "") : char))
        .join("") + rootChars.slice(rootIndex).join("")
    );
  };

  const normalizeForComparison = (value: string): string =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
      .toLowerCase();

  let cursor = 0;
  const takeSurface = (length: number): string => {
    const surface = chars(atext.lang_text ?? "")
      .slice(cursor, cursor + length)
      .join("");
    cursor += length;
    return surface;
  };

  const outputTokens: AnnotatedToken[] = [];
  const morphemesPerLinearToken: ATokenSubMorphemes[] = [];

  for (let index = 0; index < atext.tokens.length; index++) {
    const currentToken = atext.tokens[index];
    if (!currentToken) continue;
    const nextToken = atext.tokens[index + 1];

    const pair =
      isRoot(currentToken) && isPattern(nextToken)
        ? { root: currentToken, pattern: nextToken }
        : isPattern(currentToken) && isRoot(nextToken)
          ? { root: nextToken, pattern: currentToken }
          : null;

    if (pair) {
      const made = weave(pair.root.text, pair.pattern.text);
      const surface = takeSurface(len(made));
      const gloss = [pair.root.gloss, pair.pattern.gloss]
        .filter(Boolean)
        .join(" ⚭ ");
      const outputToken: AnnotatedToken = {
        text:
          normalizeForComparison(surface) === normalizeForComparison(made)
            ? made
            : surface || made,
        isWord: 1,
      };
      if (gloss) outputToken.gloss = gloss;
      outputTokens.push(outputToken);

      morphemesPerLinearToken.push([
        { morpheme: pair.root.text, gloss: pair.root.gloss ?? "" },
        { morpheme: pair.pattern.text, gloss: pair.pattern.gloss ?? "" },
      ]);

      index++;
      continue;
    }

    takeSurface(len(currentToken.text));
    outputTokens.push({ ...currentToken });
    morphemesPerLinearToken.push(asMorphemes(currentToken));
  }

  return {
    linearizedAText: {
      ...atext,
      tokens: outputTokens,
    },
    morphemesPerLinearToken,
  };
}
