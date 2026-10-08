export type SpeechTextSegment = { text: string; lang: string };

/**
 * Route embedded CJK text using the caller's language, never script-based
 * language guessing: the same Han characters can be Cantonese or Japanese.
 * Latin-script languages remain unchanged because script alone is ambiguous.
 */
export function segmentSpeechText({
  text,
  lang,
  embeddedLang,
}: {
  text: string;
  lang: string;
  embeddedLang?: string | undefined;
}): SpeechTextSegment[] {
  const embedded = embeddedLang?.toLowerCase().replaceAll("_", "-");
  const primary = lang.toLowerCase().replaceAll("_", "-");
  if (!embedded || embedded === primary || !/^en(?:-|$)/.test(primary)) {
    return [{ text, lang }];
  }

  const pattern = /^ja(?:-|$)/.test(embedded)
    ? /[〜～]?[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ー][\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{M}々〆ー〜～]*/gu
    : /^(?:yue|zh|cmn)(?:-|$)/.test(embedded)
      ? /\p{Script=Han}[\p{Script=Han}\p{M}]*/gu
      : null;
  if (!pattern) return [{ text, lang }];

  const segments: SpeechTextSegment[] = [];
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > position) {
      segments.push({ text: text.slice(position, match.index), lang });
    }
    segments.push({ text: match[0], lang: embeddedLang! });
    position = match.index + match[0].length;
  }
  if (position < text.length) segments.push({ text: text.slice(position), lang });

  // Keep quotes, spaces and punctuation with adjacent speech; don't submit
  // punctuation-only utterances or split foreign phrases at every comma.
  const result: SpeechTextSegment[] = [];
  for (const [index, segment] of segments.entries()) {
    const previous = result.at(-1);
    const next = segments[index + 1];
    if (!/[\p{L}\p{N}_]/u.test(segment.text)) {
      if (previous) previous.text += segment.text;
      else result.push({ ...segment, lang: next?.lang ?? lang });
    } else if (previous?.lang === segment.lang) {
      previous.text += segment.text;
    } else {
      result.push({ ...segment });
    }
  }
  return result.length ? result : [{ text, lang }];
}
