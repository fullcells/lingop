import { describe, expect, it } from "vitest";

import {
  cefrConcepts,
  cefrTopicEntries,
  processableTexts as clLearnCEFRProcessableTexts,
} from "./cl-learn-cefr.js";
import {
  LingoDexData,
  lingoDexEntryByDevRef,
  processableTexts as lingoDexProcessableTexts,
} from "./lingodex.js";

// Structural checks only: the datasets are edited regularly, so exact counts
// or specific entries would fail builds for intended content changes.
describe("shared learning content", () => {
  it("exports the CL Learn CEFR dataset", () => {
    expect(cefrConcepts.length).toBeGreaterThan(0);
    expect(cefrTopicEntries.length).toBeGreaterThan(0);
    expect(clLearnCEFRProcessableTexts.length).toBeGreaterThan(0);
    expect(clLearnCEFRProcessableTexts.every((text) => typeof text === "string" && text.length > 0)).toBe(true);
  });

  it("exports the LingoDex dataset with a consistent dev-ref index", () => {
    expect(LingoDexData.length).toBeGreaterThan(0);
    expect(lingoDexProcessableTexts.length).toBeGreaterThan(0);
    const devrefs = LingoDexData.map((entry) => entry.devref);
    expect(new Set(devrefs).size).toBe(devrefs.length);
    for (const entry of LingoDexData) {
      expect(lingoDexEntryByDevRef[entry.devref]).toBe(entry);
    }
  });
});
