declare module "arabic-transliterate" {
  export default function arabicTransliterate(
    input: string,
    direction: "arabic2latin" | "latin2arabic",
    language: "Arabic",
  ): string;
}

declare module "aromanize" {
  const aromanize: {
    hangulToLatin(input: string, system: "rr-translit"): string;
  };
  export default aromanize;
}

declare module "greek-utils" {
  const greekUtils: {
    toPhoneticLatin(input: string): string;
  };
  export default greekUtils;
}
