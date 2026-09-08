import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./word-chips-array-view.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("./word-chips-array-view.css", import.meta.url),
  "utf8",
);

describe("WordChipsArrayView ownership boundary", () => {
  it("uses Lingop-owned popovers without consumer UI dependencies", () => {
    expect(source).toContain("useL10nWordDetailPopover");
    expect(source).toContain("<AnchoredPopover");
    expect(source).not.toContain("@chakra-ui");
    expect(source).not.toContain("InfoTip");
    expect(source).not.toContain("bi-mortarboard");
  });

  it("ships isolated framework-independent chip styling", () => {
    expect(css).toContain(".lingop-word-chips-array");
    expect(css).toContain("border-inline-start");
  });
});
