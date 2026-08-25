/** Converts Traditional Chinese text to Simplified Chinese on demand. */
export async function traditionalToSimplifiedChinese(
  text: string,
): Promise<string> {
  const { sify } = await import("chinese-conv");
  return sify(text);
}
