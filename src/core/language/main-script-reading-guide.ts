import type { PhoneticPart, PhoneticToken } from "../annotation/types.js";
import { ilike } from "../misc.js";

const KOREAN_AFFIX_MARKER = "‿";

function normalizeSinglish(input: string): string {
  return input
    // /\" is the Sinhala short "æ" vowel (ැ).
    .replace(/\/\\/g, "æ")
    // o\)) and o\) => long "o" (ō), represented here as "oo".
    .replace(/o\\\)\)/g, "oo")
    .replace(/o\\\)/g, "oo")
    // \)x => uppercase x (e.g. \)t -> T).
    .replace(/\\\)([a-z])/g, (_, character: string) =>
      character.toUpperCase(),
    )
    // Remove any leftover \).
    .replace(/\\\)/g, "");
}

/**
 * Generates the local reading guide used when annotated backend phonetics are
 * unavailable. These conversions were originally embedded in OmniAccess's
 * AnnotatedTextView; they live in Lingop now so every Lingop ATV consumer gets
 * identical spelling content.
 */
export async function getMainScriptReadingGuidePart(
  lang: string,
  text: string,
): Promise<PhoneticPart | null> {
  // Sinhala brute-force.
  if (lang === "si") {
    try {
      const { unicodeToSinglish } = await import("sinhala-text-converters");
      return [text, normalizeSinglish(unicodeToSinglish(text))];
    } catch {
      // Match OmniAccess: an unavailable converter leaves an empty guide.
      return [text, ""];
    }
  }

  // Greek.
  if (lang === "el") {
    const module = await import("greek-utils");
    const greekUtils = module.default ?? module;
    return [text, greekUtils.toPhoneticLatin(text)];
  }

  // Korean.
  if (lang === "ko") {
    const { romanizeKorean } = await import("./korean-reading-guide.js");
    return [text, romanizeKorean(text.normalize("NFC"))];
  }

  // Thai. All reading-guide converters are lazy-loaded now so consumers that
  // do not render these languages do not pay their runtime cost.
  if (lang === "th") {
    const { romanize } = await import("@dehoist/romanize-thai");
    return [text, romanize(text)];
  }

  // Egyptian Arabic.
  if (ilike("arz", lang)) {
    const { default: arabicTransliterate } = await import(
      "arabic-transliterate"
    );
    const romanization = arabicTransliterate(
      text,
      "arabic2latin",
      "Arabic",
    );
    const spelling = [...new Intl.Segmenter().segment(romanization)]
      .map(({ segment }) => segment)
      .reverse()
      .join("");
    return [text, spelling];
  }

  // Toki Pona.
  if (ilike("tok", lang)) return [text, text];

  return null;
}

async function getKoreanMainScriptReadingGuideToken(
  text: string,
): Promise<PhoneticToken> {
  const { romanizeKorean, getKoreanSyllableSpellings } = await import(
    "./korean-reading-guide.js"
  );
  const normalizedText = text.normalize("NFC");
  const leadingAffixMarkers =
    normalizedText.match(new RegExp(`^${KOREAN_AFFIX_MARKER}+`, "u"))?.[0] ?? "";
  const trailingAffixMarkers =
    normalizedText.match(new RegExp(`${KOREAN_AFFIX_MARKER}+$`, "u"))?.[0] ?? "";
  const coreEnd = normalizedText.length - trailingAffixMarkers.length;
  const coreText = normalizedText.slice(
    leadingAffixMarkers.length,
    coreEnd,
  );

  const graphemes = [
    ...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(
      coreText,
    ),
  ].map(({ segment }) => segment);
  const spellings = getKoreanSyllableSpellings(coreText);

  // Mixed scripts and structures that cannot be confidently aligned retain a
  // whole-token guide. Never silently attach a sound to the wrong grapheme.
  if (!spellings || spellings.length !== graphemes.length) {
    return [[normalizedText, romanizeKorean(normalizedText)]];
  }

  return graphemes.map((grapheme, index): PhoneticPart => {
    const isFirst = index === 0;
    const isLast = index === graphemes.length - 1;
    const prefix = isFirst ? leadingAffixMarkers : "";
    const suffix = isLast ? trailingAffixMarkers : "";
    return [
      `${prefix}${grapheme}${suffix}`,
      `${prefix}${spellings[index]}${suffix}`,
    ];
  });
}

/**
 * Generates all locally derived reading-guide parts for one annotated token.
 * Korean is aligned per grapheme; other languages retain their established
 * whole-token guide as a single part.
 */
export async function getMainScriptReadingGuideToken(
  lang: string,
  text: string,
): Promise<PhoneticToken | null> {
  if (lang === "ko") {
    return getKoreanMainScriptReadingGuideToken(text);
  }

  const part = await getMainScriptReadingGuidePart(lang, text);
  return part ? [part] : null;
}
