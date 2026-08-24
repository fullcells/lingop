import { describe, expect, it } from "vitest";

import { isTripleDisplayState } from "./types.js";

describe("TripleDisplayState", () => {
  it.each(["NEVER", "ON_HINT", "ALWAYS"])(
    "accepts the supported %s state",
    (state) => {
      expect(isTripleDisplayState(state)).toBe(true);
    },
  );

  it.each([undefined, null, "", "SOMETIMES", true])(
    "rejects unsupported state %s",
    (state) => {
      expect(isTripleDisplayState(state)).toBe(false);
    },
  );
});
