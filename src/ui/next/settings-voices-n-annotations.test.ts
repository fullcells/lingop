import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./settings-voices-n-annotations.tsx", import.meta.url),
  "utf8",
);

describe("SettingsVoicesNAnnotationsUI ownership boundary", () => {
  it("does not depend on OmniAccess UI or language contexts", () => {
    expect(source).not.toContain("@chakra-ui");
    expect(source).not.toContain("DialogWrapper");
    expect(source).not.toContain("useGuiFocusLangs");
  });

  it("owns nested navigation and the lightweight word-detail preview", () => {
    expect(source).toContain('type: "BACKGROUND_WORDS"');
    expect(source).toContain("useL10nWordDetailPopover");
    expect(source).toContain("showNonCoreWordOptions");
    expect(source).toContain("<SettingsSubpage");
  });
});
