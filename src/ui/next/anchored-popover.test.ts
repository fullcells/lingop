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
const wordDetailPopoverCss = readFileSync(
  new URL("./l10n-word-detail-popover.css", import.meta.url),
  "utf8",
);
const wordChipsArrayCss = readFileSync(
  new URL("./word-chips-array-view.css", import.meta.url),
  "utf8",
);

describe("AnchoredPopover positioning", () => {
  it("synchronizes a changed anchor while the floating component stays mounted", () => {
    expect(anchoredPopoverSource).toContain("refs.setReference(anchor)");
    expect(anchoredPopoverSource).not.toContain(
      "elements: { reference: anchor }",
    );
  });

  it("restores hit testing when a consumer modal disables body pointer events", () => {
    expect(anchoredPopoverSource).toContain('pointerEvents: "auto"');
  });

  it("gives word details a centered, outlined pointer", () => {
    expect(wordDetailPopoverSource).toContain('placement="bottom"');
    expect(wordDetailPopoverSource).toContain("arrowStrokeWidth={1}");
  });

  it("keeps Lingop popovers above consumer-owned modal layers", () => {
    const modalSafeLayer =
      "z-index: var(--lingop-anchored-popover-z-index, 1600)";
    expect(wordDetailPopoverCss).toContain(modalSafeLayer);
    expect(wordChipsArrayCss).toContain(modalSafeLayer);
  });
});
