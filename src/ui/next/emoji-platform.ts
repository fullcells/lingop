/** Lightweight estimate, not detection of the font used for an individual glyph.
 * Android OEM fonts and Linux fontconfig/user overrides can differ. Chrome on
 * Windows normally uses Segoe UI Emoji; Chrome on macOS uses Apple Color Emoji.
 */
export function guessPlatformUsesNotoColorEmoji(
  platform: string,
  userAgent: string,
): boolean {
  // Apple checks include iPadOS presenting itself as a Mac. Check these before
  // Linux/Android, and never equate the Chrome browser with the Noto font.
  if (/Mac|iPhone|iPad|iPod/i.test(platform) ||
      /Macintosh|iPhone|iPad|iPod/i.test(userAgent)) return false;
  if (/Win/i.test(platform) || /Windows/i.test(userAgent)) return false;
  return /Android|Chrome OS|Chromium OS|Linux/i.test(platform) ||
    /Android|CrOS|Linux/i.test(userAgent);
}

let cachedEstimate: boolean | undefined;

/** Call after hydration. No layout, canvas, font probes, network or permissions. */
export function browserLikelyUsesNotoColorEmoji(): boolean {
  if (typeof navigator === "undefined") return false;
  if (cachedEstimate === undefined) {
    const nav = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    cachedEstimate = guessPlatformUsesNotoColorEmoji(
      nav.userAgentData?.platform || nav.platform || "",
      nav.userAgent || "",
    );
  }
  return cachedEstimate;
}
