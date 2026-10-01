import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type {
  HancharComponent,
  HancharDecomposition,
} from "../../core/hanchar-decomposition.js";
import type { PhoneticToken } from "../../core/annotation/types.js";
import {
  getHancharComponentLayout,
  shouldUseHancharCompositionGlyph,
} from "../hanchar-component-display.js";
import {
  getHancharReadings,
  getJapaneseWordReadingForCharacter,
  isExactJapaneseOnReadingMatch,
  splitReadingByNativeSpellings,
} from "../l10n-word-detail-utils.js";
import { s } from "./word-detail-controls.js";
import type { NativeTranslate } from "./word-detail-types.js";

const colors = {
  semantic: "#dcfce7",
  phonetic: "#f3e8ff",
  structural: "#e0f2fe",
};
const roleLabel = {
  semantic: "Semantic",
  phonetic: "Phonetic",
  structural: "Structural",
};
type Node = Pick<
  HancharDecomposition,
  "literal" | "decomposition" | "components"
>;
function Glyph({ node, size = 32 }: { node: Node; size?: number }) {
  if (!shouldUseHancharCompositionGlyph(node.literal, !!node.components.length))
    return (
      <Text style={{ fontSize: size, color: "#173e32" }}>{node.literal}</Text>
    );
  const vertical =
    getHancharComponentLayout(node.decomposition).direction === "vertical";
  return (
    <View
      accessible
      accessibilityLabel={node.literal}
      style={{
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
      }}
    >
      {node.components.map((child, index) => (
        <Glyph
          key={index}
          node={child}
          size={size / Math.max(1, node.components.length * 0.65)}
        />
      ))}
    </View>
  );
}
function Component({
  node,
  lang,
  nativeReadings,
  wordReading,
  translate,
}: {
  node: HancharComponent;
  lang: string;
  nativeReadings: string[];
  wordReading: string | null;
  translate: NativeTranslate;
}) {
  const [expanded, setExpanded] = useState(false);
  const readings = getHancharReadings(node.readings, lang);
  const parts = readings.flatMap((reading, index) => [
    ...(index
      ? [
          {
            text: lang === "ja" ? "・" : " / ",
            sharedWithNativeSpelling: false,
          },
        ]
      : []),
    ...(node.role !== "phonetic"
      ? [{ text: reading, sharedWithNativeSpelling: false }]
      : lang === "ja"
        ? [
            {
              text: reading,
              sharedWithNativeSpelling: isExactJapaneseOnReadingMatch(
                reading,
                node.readings,
                wordReading,
              ),
            },
          ]
        : splitReadingByNativeSpellings(reading, nativeReadings)),
  ]);
  const content = (
    <>
      <Glyph node={node} />
      <View style={{ flexShrink: 1, gap: 4 }}>
        <Text style={s.muted}>{translate(roleLabel[node.role])}</Text>
        {!!parts.length && (
          <Text style={s.body}>
            {parts.map((part, i) => (
              <Text
                key={i}
                style={
                  part.sharedWithNativeSpelling
                    ? {
                        fontWeight: "800",
                        textDecorationLine: "underline",
                        color: "#581c87",
                      }
                    : undefined
                }
              >
                {part.text}
              </Text>
            ))}
          </Text>
        )}
        {!!node.enGloss && <Text style={s.body}>{node.enGloss}</Text>}
      </View>
      {!!node.components.length && <Text>{expanded ? "−" : "+"}</Text>}
    </>
  );
  const style = [
    s.row,
    { backgroundColor: colors[node.role], borderRadius: 10, padding: 10 },
  ];
  return (
    <View style={{ gap: 8, flexShrink: 1 }}>
      {node.components.length ? (
        <Pressable
          style={style}
          accessibilityRole="button"
          accessibilityLabel={`${node.literal}: ${translate(roleLabel[node.role])}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
        >
          {content}
        </Pressable>
      ) : (
        <View style={style}>{content}</View>
      )}
      {expanded && (
        <View style={{ paddingLeft: 12, gap: 8 }}>
          {node.components.map((child, index) => (
            <Component
              key={index}
              node={child}
              lang={lang}
              nativeReadings={nativeReadings}
              wordReading={wordReading}
              translate={translate}
            />
          ))}
        </View>
      )}
    </View>
  );
}
export function HancharComponents({
  decompositions,
  lang,
  phonetics,
  translate,
}: {
  decompositions: HancharDecomposition[];
  lang: string;
  phonetics: PhoneticToken | null | undefined;
  translate: NativeTranslate;
}) {
  return (
    <View style={s.section}>
      {decompositions.map((node) => (
        <View key={node.literal} style={s.section}>
          <View style={s.row}>
            <Glyph node={node} />
            {!node.components.length && (
              <Text style={s.body}>{translate("Core Component")}</Text>
            )}
          </View>
          {node.components.map((component, i) => (
            <Component
              key={i}
              node={component}
              lang={lang}
              nativeReadings={getHancharReadings(node.readings, lang)}
              wordReading={getJapaneseWordReadingForCharacter(
                phonetics,
                node.literal,
              )}
              translate={translate}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
