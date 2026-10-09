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

describe("shared learning content", () => {
  it("exports the complete CL Learn CEFR dataset", () => {
    expect(cefrConcepts).toHaveLength(898);
    expect(cefrTopicEntries).toHaveLength(996);
    expect(clLearnCEFRProcessableTexts).toHaveLength(3838);
    expect(clLearnCEFRProcessableTexts).toContain("Nice to meet you");
  });

  it("exports the complete LingoDex dataset and derived indexes", () => {
    // The October 3 dataset revision retired #00001 and revised its texts.
    expect(LingoDexData).toHaveLength(1196);
    expect(lingoDexProcessableTexts).toHaveLength(4067);
    expect(LingoDexData[0]?.devref).toBe("#00002");
    expect(LingoDexData.at(-1)?.devref).toBe("#01095");
    expect(lingoDexEntryByDevRef["#00001"]).toBeUndefined();
    expect(lingoDexEntryByDevRef["#00002"]).toBe(LingoDexData[0]);
  });
});
