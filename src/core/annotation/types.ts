export type PhoneticPart = [chars: string] | [chars: string, spelling: string];
export type PhoneticToken = PhoneticPart[];
export type AnnotationEntry_LangPhonetics = (PhoneticToken | null)[];

export type AnnotatedToken = {
  text: string;
  isWord: number;
  gloss?: string | null;
  phoneticToken?: PhoneticToken | null;
};

export type AnnotatedText = {
  // Migrated shape: legacy AnnotatedText currently does not include an id.
  lang: string;
  lang_text: string;
  tokens: AnnotatedToken[];
  containsGloss: boolean;
  containsPhonetics: boolean;
  ref: unknown | null;
  owner_id: string | null;
};

export type AnnotationEntry_LangTokens = {
  texts: string[];
  isWordList: number[];
};

export type AnnotationEntry = {
  // Migrated shape: legacy AnnotatedText currently does not include an id.
  lang: string;
  lang_text: string;
  lang_tokens: AnnotationEntry_LangTokens;
  lang_gloss?: (string | null)[] | null;
  lang_phonetics_2?: AnnotationEntry_LangPhonetics | null;
  ref: unknown | null;
  owner_id: string | null;
};

