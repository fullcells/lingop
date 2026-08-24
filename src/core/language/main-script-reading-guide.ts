import type { PhoneticPart } from "../annotation/types.js";
import { ilike } from "../misc.js";

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
    const module = await import("aromanize");
    const aromanize = module.default ?? module;
    return [text, aromanize.hangulToLatin(text, "rr-translit")];
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
