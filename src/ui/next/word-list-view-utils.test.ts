import { describe, expect, it } from "vitest";

import type { SBCacheWordListL10nWordsRow } from "../../core/index.js";
import { getUniqueLocalizedWordsForList } from "./word-list-view-utils.js";

const rows: SBCacheWordListL10nWordsRow[] = [
  {
    lang: "ja",
    list_title: "Food",
    l10n_words: ["りんご", "バナナ", "りんご"],
    updated_at: "2026-09-08T00:00:00.000Z",
    is_human_verified: true,
  },
];

describe("getUniqueLocalizedWordsForList", () => {
  it("preserves source order while removing exact duplicates", () => {
    expect(getUniqueLocalizedWordsForList(rows, "Food")).toEqual([
      "りんご",
      "バナナ",
    ]);
  });

  it("returns an empty array when the localized list is unavailable", () => {
    expect(getUniqueLocalizedWordsForList(rows, "Animals")).toEqual([]);
  });
});
