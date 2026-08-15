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
    expect(LingoDexData).toHaveLength(1197);
    expect(lingoDexProcessableTexts).toHaveLength(4070);
    expect(LingoDexData[0]?.devref).toBe("#00001");
    expect(LingoDexData.at(-1)?.devref).toBe("#01095");
    expect(lingoDexEntryByDevRef["#00001"]).toBe(LingoDexData[0]);
  });
});
