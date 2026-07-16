import { describe, expect, it } from "vitest";
import { getMorphemeStringsForEnWord } from "./morphologize-en-word.js";

describe("getMorphemeStringsForEnWord", () => {
  it("returns noun, verb, and adjective lemmas", () => {
    expect(getMorphemeStringsForEnWord("better")).toEqual({
      noun: "better",
      verb: "better",
      adjective: "good",
    });
  });
});
