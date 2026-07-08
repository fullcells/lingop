import type {
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

