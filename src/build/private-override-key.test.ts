import { describe, expect, it } from "vitest";

import { getPrivateOverrideKey } from "./private-override-key.js";

describe("getPrivateOverrideKey", () => {
  it("prefers the Netlify-compatible environment variable", () => {
    expect(
      getPrivateOverrideKey({
        H_PERSONAL_OVERRIDE_KEY: "canonical",
        _H_PERSONAL_OVERRIDE_KEY: "legacy",
      }),
    ).toBe("canonical");
  });

  it("accepts the legacy leading-underscore variable", () => {
    expect(
      getPrivateOverrideKey({ _H_PERSONAL_OVERRIDE_KEY: "legacy" }),
    ).toBe("legacy");
  });

  it("uses the legacy value when the canonical variable is blank", () => {
    expect(
      getPrivateOverrideKey({
        H_PERSONAL_OVERRIDE_KEY: "",
        _H_PERSONAL_OVERRIDE_KEY: "legacy",
      }),
    ).toBe("legacy");
  });
});
