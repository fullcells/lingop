import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./bi-text-view.tsx", import.meta.url),
  "utf8",
);

describe("BiTextView loading state", () => {
  it("keeps ready focus-language text visible while annotations load", () => {
    expect(source).toContain("{!focusA8n && focusLangText}");
    expect(source).not.toContain(
      "!focusA8n && !loadingFocusA8n && preparedFocusA8n !== null",
    );
  });
});
