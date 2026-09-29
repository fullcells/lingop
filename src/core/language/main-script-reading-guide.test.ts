import { describe, expect, it } from "vitest";

import {
  getMainScriptReadingGuidePart,
  getMainScriptReadingGuideToken,
} from "./main-script-reading-guide.js";

describe("getMainScriptReadingGuidePart", () => {
  it("ports local main-script conversions from OmniAccess", async () => {
    await expect(getMainScriptReadingGuidePart("el", "γεια")).resolves.toEqual([
      "γεια",
      "gia",
    ]);
    await expect(getMainScriptReadingGuidePart("ko", "한국")).resolves.toEqual([
      "한국",
      "hanguk",
    ]);
    await expect(getMainScriptReadingGuidePart("th", "ไทย")).resolves.toEqual([
      "ไทย",
      "thai",
    ]);
    await expect(getMainScriptReadingGuidePart("tok", "pona")).resolves.toEqual([
      "pona",
      "pona",
    ]);
    await expect(
      getMainScriptReadingGuidePart("arz", "مرحبا"),
    ).resolves.toEqual(["مرحبا", "abḥrm"]);

    const sinhalaGuide = await getMainScriptReadingGuidePart("si", "සිංහල");
    expect(sinhalaGuide?.[0]).toBe("සිංහල");
    expect(sinhalaGuide?.[1]).toBeTruthy();
  });

  it("returns null for languages without a local reading guide", async () => {
    await expect(getMainScriptReadingGuidePart("en", "hello")).resolves.toBeNull();
  });

  it("aligns Korean spelling to NFC graphemes", async () => {
    await expect(
      getMainScriptReadingGuideToken("ko", "선생님".normalize("NFD")),
    ).resolves.toEqual([
      ["선", "seon"],
      ["생", "saeng"],
      ["님", "nim"],
    ]);
  });

  it("keeps Korean affix markers attached to the edge graphemes", async () => {
    await expect(
      getMainScriptReadingGuideToken("ko", "‿어요‿"),
    ).resolves.toEqual([
      ["‿어", "‿eo"],
      ["요‿", "yo‿"],
    ]);
  });

  it("wraps established whole-token guides in a phonetic token", async () => {
    await expect(
      getMainScriptReadingGuideToken("el", "γεια"),
    ).resolves.toEqual([["γεια", "gia"]]);
    await expect(
      getMainScriptReadingGuideToken("en", "hello"),
    ).resolves.toBeNull();
  });
});


describe("Korean contextual spelling guides", () => {
  it.each([
    ["학교", ["hak", "gyo"]],
    ["국물", ["gung", "mul"]],
    ["같이", ["ga", "chi"]],
    ["먹어요", ["meo", "geo", "yo"]],
    ["신라", ["sil", "la"]],
    ["좋다", ["jo", "ta"]],
    ["좋아", ["jo", "a"]],
    ["닭이", ["dal", "gi"]],
    ["꽃잎", ["kkon", "nip"]],
    ["나뭇잎", ["na", "mun", "nip"]],
    ["잎", ["ip"]],
    ["깻잎", ["kkaen", "nip"]],
    ["감사합니다", ["gam", "sa", "ham", "ni", "da"]],
    ["와왜외워웨위의", ["wa", "wae", "oe", "wo", "we", "wi", "ui"]],
  ])("aligns %s after whole-sequence conversion", async (text, spellings) => {
    const token = await getMainScriptReadingGuideToken("ko", text);
    expect(token).toEqual([...text].map((char, i) => [char, spellings[i]]));
    expect(token?.map((part) => part[1]).join("")).toBe(
      (await getMainScriptReadingGuidePart("ko", text))?.[1],
    );
  });

  it("normalizes decomposed Hangul before applying contextual rules", async () => {
    await expect(getMainScriptReadingGuideToken("ko", "같이".normalize("NFD")))
      .resolves.toEqual([["같", "ga"], ["이", "chi"]]);
    await expect(getMainScriptReadingGuidePart("ko", "같이".normalize("NFD")))
      .resolves.toEqual(["같이".normalize("NFD"), "gachi"]);
  });

  it("preserves affix markers around contextual guides", async () => {
    await expect(getMainScriptReadingGuideToken("ko", "‿같이‿"))
      .resolves.toEqual([["‿같", "‿ga"], ["이‿", "chi‿"]]);
  });

  it.each(["", "‿", "ㄱ", "학교 😊", "한국ABC", "3개", "같이 가요"])(
    "uses a whole-token fallback for %s", async (text) => {
      const part = await getMainScriptReadingGuidePart("ko", text);
      expect(await getMainScriptReadingGuideToken("ko", text)).toEqual([part]);
    },
  );

  it("does not inherit mutable Koroman dictionaries from other consumers", async () => {
    const { setCustomDictionary, clearCustomDictionary } = await import("koroman");
    try {
      setCustomDictionary({ 한국: "unexpected" });
      await expect(getMainScriptReadingGuideToken("ko", "한국"))
        .resolves.toEqual([["한", "han"], ["국", "guk"]]);
    } finally {
      clearCustomDictionary();
    }
  });
});
