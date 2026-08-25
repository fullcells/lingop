import { describe, expect, it } from "vitest";

import type { OATConfig } from "./config.js";
import { collectAllOATSourceData } from "./source-data.js";

const LINGOP_PACKAGE_SCOPE = "__lingop_package__";

describe("Lingop-owned OAT source data", () => {
  it("includes packaged settings previews independently of consumer source scanning", () => {
    const config: OATConfig = {
      scanDirs: [],
      // A consumer may use the generic scope for a subset of its languages;
      // Lingop's reserved scope must remain separate and therefore global.
      guiLangsByScope: { _: ["en"] },
      focusLangsByScope: { _: ["ja"] },
      allGuiLangs: ["en", "ja"],
      allFocusLangs: ["ja", "yue"],
      generatedAssetsRoot: "public",
    };

    const sourceData = collectAllOATSourceData(config);

    expect(sourceData.staticFocusTextsByScope[LINGOP_PACKAGE_SCOPE]).toEqual(
      expect.arrayContaining([
        "There is a small cat at my door. It wants to drink some water.",
        "Where is the toilet?",
      ]),
    );
    expect(sourceData.staticFocusTextsByScope._).toBeUndefined();
  });
});
