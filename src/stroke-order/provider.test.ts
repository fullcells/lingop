import { describe, expect, it } from "vitest";

import {
  createStrokeDataProvider,
  getStrokeCharacters,
  localStrokeDataProvider,
  supportsStrokeOrder,
} from "./provider.js";
import type {
  StrokeBucketLoader,
  StrokeDataSource,
} from "./types.js";

function stubLoaders(
  entries: Partial<Record<StrokeDataSource, Record<string, readonly string[]>>>,
) {
  const calls: StrokeDataSource[] = [];
  const sources: StrokeDataSource[] = [
    "KANJIVG",
    "ANIMCJK_JA",
    "ANIMCJK_ZH_HANT",
    "MAKEMEAHANZI",
  ];
  const loaders = Object.fromEntries(
    sources.map((source) => [
      source,
      Object.fromEntries(
        Object.entries(entries[source] ?? {}).map(([character, strokes]) => {
          const bucket = Math.floor((character.codePointAt(0) ?? 0) / 256)
            .toString(16)
            .padStart(2, "0");
          const loader: StrokeBucketLoader = async () => {
            calls.push(source);
            return { default: { [character]: strokes } };
          };
          return [bucket, loader];
        }),
      ),
    ]),
  ) as Record<StrokeDataSource, Record<string, StrokeBucketLoader>>;
  return { loaders, calls };
}

describe("stroke-data provider", () => {
  it("uses KanjiVG first for Japanese kanji and AnimCJK for kana", async () => {
    const { loaders, calls } = stubLoaders({
      KANJIVG: { 字: ["kanjivg"] },
      ANIMCJK_JA: { 字: ["anim-kanji"], あ: ["anim-kana"] },
    });
    const provider = createStrokeDataProvider(loaders);

    await expect(provider.get("字", "ja")).resolves.toMatchObject({
      source: "KANJIVG",
      strokes: ["kanjivg"],
      pathKind: "STROKE",
    });
    await expect(provider.get("あ", "ja")).resolves.toMatchObject({
      source: "ANIMCJK_JA",
      strokes: ["anim-kana"],
      pathKind: "OUTLINE",
    });
    expect(calls).toEqual(["KANJIVG", "ANIMCJK_JA"]);
  });

  it("falls back from missing primary sources", async () => {
    const { loaders } = stubLoaders({
      ANIMCJK_JA: { 字: ["anim-kanji"] },
      ANIMCJK_ZH_HANT: { 喫: ["anim-traditional"] },
    });
    const provider = createStrokeDataProvider(loaders);

    await expect(provider.get("字", "ja")).resolves.toMatchObject({
      source: "ANIMCJK_JA",
    });
    await expect(provider.get("喫", "cmn-hant")).resolves.toMatchObject({
      source: "ANIMCJK_ZH_HANT",
    });
  });

  it("uses Make Me a Hanzi first for Traditional Chinese", async () => {
    const { loaders, calls } = stubLoaders({
      ANIMCJK_ZH_HANT: { 我: ["anim"] },
      MAKEMEAHANZI: { 我: ["mmh"] },
    });
    const provider = createStrokeDataProvider(loaders);

    await expect(provider.get("我", "yue")).resolves.toMatchObject({
      source: "MAKEMEAHANZI",
      strokes: ["mmh"],
    });
    expect(calls).toEqual(["MAKEMEAHANZI"]);
  });

  it("filters display text to unique supported-script characters", () => {
    expect(getStrokeCharacters("日本語かな語！", "ja")).toEqual([
      "日",
      "本",
      "語",
      "か",
      "な",
    ]);
    expect(getStrokeCharacters("繁體ABC繁", "cmn-hant")).toEqual(["繁", "體"]);
    expect(supportsStrokeOrder("YUE")).toBe(true);
    expect(supportsStrokeOrder("zh-TW")).toBe(true);
    expect(supportsStrokeOrder("cmn-hans")).toBe(false);
  });

  it("loads representative generated data without a runtime network", async () => {
    await expect(localStrokeDataProvider.get("字", "ja")).resolves.toMatchObject({
      source: "KANJIVG",
    });
    await expect(localStrokeDataProvider.get("あ", "ja")).resolves.toMatchObject({
      source: "ANIMCJK_JA",
    });
    await expect(
      localStrokeDataProvider.get("我", "cmn-hant"),
    ).resolves.toMatchObject({ source: "MAKEMEAHANZI" });
    await expect(
      localStrokeDataProvider.get("喫", "cmn-hant"),
    ).resolves.toMatchObject({ source: "ANIMCJK_ZH_HANT" });
  });
});
