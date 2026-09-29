import { describe, expect, it } from "vitest";

import { segmentGlossEmoji } from "./gloss-emoji-graphemes.js";

describe("segmentGlossEmoji", () => {
  it("keeps plain number runs together without absorbing neighboring emoji", () => {
    expect(segmentGlossEmoji("100 ⁙⟦🧣👕⟧ / 1000 ❶ / 10000")).toEqual([
      "100", "\u2002", "⁙", "⟦", "🧣", "👕", "⟧", "\u2002", "/", "\u2002",
      "1000", "\u2002", "❶", "\u2002", "/", "\u2002", "10000",
    ]);
  });

  it("keeps keycap digits as emoji graphemes", () => {
    expect(segmentGlossEmoji("1️⃣20 0️⃣")).toEqual(["1️⃣", "20", "\u2002", "0️⃣"]);
  });
});
