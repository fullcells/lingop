import { describe, expect, it } from "vitest";

import { getAnchoredPopoverPosition } from "./l10n-word-detail-popover-utils.js";

const anchor = {
  top: 100,
  right: 160,
  bottom: 120,
  left: 100,
  width: 60,
  height: 20,
};

describe("getAnchoredPopoverPosition", () => {
  it("places a popover below its anchor when it fits", () => {
    expect(
      getAnchoredPopoverPosition({
        anchor,
        popover: { width: 240, height: 180 },
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ left: 100, top: 128 });
  });

  it("moves above and clamps horizontally near viewport edges", () => {
    expect(
      getAnchoredPopoverPosition({
        anchor: { ...anchor, top: 500, bottom: 520, left: 760, right: 800 },
        popover: { width: 240, height: 180 },
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ left: 552, top: 312 });
  });
});
