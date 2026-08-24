/** A preference that can hide content, show it only as a hint, or always show it. */
export type TripleDisplayState = "NEVER" | "ON_HINT" | "ALWAYS";

export function isTripleDisplayState(
  value: unknown,
): value is TripleDisplayState {
  return value === "NEVER" || value === "ON_HINT" || value === "ALWAYS";
}
