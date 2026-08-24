import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const uiDirectory = fileURLToPath(new URL(".", import.meta.url));

describe("AnnotatedTextView fonts", () => {
  it("ships every font referenced by the exported ATV stylesheet", async () => {
    const stylesheet = await readFile(
      `${uiDirectory}/annotated-text.css`,
      "utf8",
    );
    const fontFiles = [
      "LS_Jyutping.ttf",
      "NotoSansJP-VariableFont_wght.ttf",
      "linja_laso_regular.otf",
    ];

    for (const fontFile of fontFiles) {
      expect(stylesheet).toContain(`./fonts/${fontFile}`);
      await expect(access(`${uiDirectory}/fonts/${fontFile}`)).resolves.toBeUndefined();
    }
  });
});
