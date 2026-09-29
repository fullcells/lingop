import "koroman";

// Runtime exports present in pinned Koroman 1.0.16 but omitted from its .d.ts.
declare module "koroman" {
  export function splitHangulToJamos(text: string): { jamoString: string };
  export function applyPronunciationRules(jamo: string): string;
  export function applyRomanMapping(jamo: string): string;
}
