/**
 * Compares two strings for equality, ignoring case.
 *
 * If both arguments are null or falsy, returns true.
 */
export function ilike(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a && !b) return true;
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

export function toCleanFilename(input: string, len: number): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, "_")
    .replace(/[\s.,。，,]/g, "_")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .slice(0, len)
    .toLowerCase();
}

export function isExplicitlyLowerCase(text: string): boolean {
  if (text.toLowerCase() === text.toUpperCase()) return false;
  return text.toLowerCase() === text;
}

/** Checks whether any term occurs in a string, ignoring case. */
export const anyIn_ci = (terms: string[], str: string | null | undefined): boolean =>
  terms.some((term) => (str ?? "").toLowerCase().includes(term.toLowerCase()));
