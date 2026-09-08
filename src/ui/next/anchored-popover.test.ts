import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const anchoredPopoverSource = readFileSync(
  new URL("./anchored-popover.tsx", import.meta.url),
  "utf8",
);
const wordDetailPopoverSource = readFileSync(
  new URL("./l10n-word-detail-popover.tsx", import.meta.url),
  "utf8",
);

describe("AnchoredPopover positioning", () => {
  it("synchronizes a changed anchor while the floating component stays mounted", () => {
    expect(anchoredPopoverSource).toContain("refs.setReference(anchor)");
    expect(anchoredPopoverSource).not.toContain(
      "elements: { reference: anchor }",
    );
  });

  it("gives word details a centered, outlined pointer", () => {
    expect(wordDetailPopoverSource).toContain('placement="bottom"');
    expect(wordDetailPopoverSource).toContain("arrowStrokeWidth={1}");
  });
});
