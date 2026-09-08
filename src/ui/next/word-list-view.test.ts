import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./word-list-view.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("./word-list-view.css", import.meta.url),
  "utf8",
);

describe("WordListView ownership boundary", () => {
  it("uses Lingop data and UI without consumer-framework dependencies", () => {
    expect(source).toMatch(/lingopClient\s*\.loadWordListMetaData\(\)/);
    expect(source).toMatch(
      /lingopClient\s*\.loadSBCacheWordListsForLang\(focusLang\)/,
    );
    expect(source).toContain("<WordChipsArrayView");
    expect(source).toContain("renderLeaf");
    expect(source).not.toContain("@chakra-ui");
    expect(source).not.toContain("createComponentClient");
    expect(source).not.toContain("useGuiFocusLangs");
    expect(source).not.toContain("FOR_WORD_LIST");
  });

  it("shares one word-details and one list-streak popover across the tree", () => {
    expect(source.match(/useL10nWordDetailPopover/g)).toHaveLength(2);
    expect(source.match(/<AnchoredPopover/g)).toHaveLength(1);
    expect(source).toMatch(
      /one\s+array-level anchored popover now serves every title/,
    );
  });

  it("ships isolated modal-safe styling", () => {
    expect(css).toContain('@import "./word-chips-array-view.css"');
    expect(css).toContain('@import "./l10n-word-detail-popover.css"');
    expect(css).toContain(".lingop-word-list-view");
    expect(css).toContain(
      "z-index: var(--lingop-anchored-popover-z-index, 1600)",
    );
  });
});
