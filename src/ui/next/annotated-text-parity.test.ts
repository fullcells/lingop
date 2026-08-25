import { describe, expect, it } from "vitest";

import type { AnnotatedText, AnnotatedToken } from "../../core/annotation/types.js";
import {
  getAnnotatedTextHTMLTableExport,
  groupAnnotatedTokensToPreventWidows,
} from "./annotated-text.js";

function token(text: string, isWord: number): AnnotatedToken {
  return { text, isWord };
}

describe("AnnotatedTextView OmniAccess parity", () => {
  it("groups trailing punctuation and Japanese opening quotes to prevent widows", () => {
    const groups = groupAnnotatedTokensToPreventWidows([
      token("「", 0),
      token("猫", 1),
      token("」", 0),
      token("犬", 1),
      token("。", 0),
    ]);

    expect(groups.map((group) => group.map(({ token: item }) => item.text))).toEqual([
      ["「", "猫", "」"],
      ["犬", "。"],
    ]);
    expect(groups.map((group) => group.map(({ index }) => index))).toEqual([
      [0, 1, 2],
      [3, 4],
    ]);
  });

  it("retains the three-row HTML export while escaping content", () => {
    const annotatedText: AnnotatedText = {
      lang: "ko",
      lang_text: "가‿다<&",
      tokens: [
        {
          text: "가‿다",
          isWord: 1,
          gloss: "go <now>",
          phoneticToken: [
            ["가‿", "ga&"],
            ["다", "da"],
          ],
        },
        { text: "<&", isWord: 0, gloss: null },
      ],
      containsGloss: true,
      containsPhonetics: true,
      ref: null,
      owner_id: null,
    };

    expect(getAnnotatedTextHTMLTableExport(annotatedText)).toBe([
      '<table style="text-align:center;">',
      '<tr style="font-size:12px;"><td>ga&amp;</td><td>da</td><td></td></tr>',
      '<tr style="font-size:16px;"><td>가</td><td>다</td><td>&lt;&amp;</td></tr>',
      '<tr style="font-size:12px;"><td colspan="2">go &lt;now&gt;</td><td></td></tr>',
      "</table>",
    ].join("\n"));
  });
});
