import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Svg, G, Path } from "react-native-svg";
import {
  localStrokeDataProvider,
  STROKE_SOURCE_LABELS,
  type StrokeCharacterData,
  type StrokeDataProvider,
} from "../../stroke-order/index.js";
import { useNativeResource } from "./native-resource.js";
import { defaultTranslate, type NativeTranslate } from "./word-detail-types.js";
import { Action, s } from "./word-detail-controls.js";

export type StrokeOrderViewProps = {
  characters: readonly string[];
  lang: string;
  provider?: StrokeDataProvider;
  translate?: NativeTranslate;
};
export function StrokeOrderView({
  characters,
  lang,
  provider = localStrokeDataProvider,
  translate = defaultTranslate,
}: StrokeOrderViewProps) {
  const key = JSON.stringify(characters);
  const load = useMemo(
    () => () =>
      Promise.all(
        (JSON.parse(key) as string[]).map(async (character) => {
          try {
            return {
              character,
              data: await provider.get(character, lang),
              failed: false,
            };
          } catch {
            return { character, data: null, failed: true };
          }
        }),
      ),
    [key, lang, provider],
  );
  const result = useNativeResource(load);
  if (!characters.length)
    return (
      <Text style={s.muted}>
        {translate("No characters with stroke-order data were found.")}
      </Text>
    );
  if (result.status === "LOADING")
    return (
      <ActivityIndicator
        accessibilityLabel={translate("Loading stroke order")}
      />
    );
  return (
    <View style={s.section}>
      {result.value?.map(({ character, data, failed }) =>
        data ? (
          <StrokeCharacterDiagram
            key={character}
            data={data}
            translate={translate}
          />
        ) : (
          <View key={character} style={s.section}>
            <Text style={s.title}>{character}</Text>
            <Text style={failed ? s.error : s.muted}>
              {translate(
                failed
                  ? "Unable to load stroke order."
                  : "No stroke order information available.",
              )}
            </Text>
          </View>
        ),
      )}
      {(result.status === "FAILED" ||
        result.value?.some(({ failed }) => failed)) && (
        <Action label={translate("Retry")} onPress={result.retry} />
      )}
    </View>
  );
}
export function StrokeCharacterDiagram({
  data,
  translate = defaultTranslate,
}: {
  data: StrokeCharacterData;
  translate?: NativeTranslate;
}) {
  return (
    <View style={s.section}>
      <Text style={s.body}>
        {data.character} · {data.strokes.length} {translate("strokes")}
      </Text>
      <Text style={s.muted}>
        {translate("Stroke source")}: {STROKE_SOURCE_LABELS[data.source]}
      </Text>
      <View style={s.row}>
        {data.strokes.map((_, step) => (
          <View key={step} style={{ alignItems: "center" }}>
            <Svg
              width={72}
              height={72}
              viewBox={data.viewBox}
              accessibilityRole="image"
              accessibilityLabel={`${data.character}: ${translate("step")} ${step + 1}`}
            >
              <G {...(data.transform ? { transform: data.transform } : {})}>
                {data.strokes.slice(0, step + 1).map((path, index) => {
                  const color = index === step ? "#dc493a" : "#173e32";
                  return (
                    <Path
                      key={index}
                      d={path}
                      fill={data.pathKind === "OUTLINE" ? color : "none"}
                      stroke={data.pathKind === "STROKE" ? color : "none"}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
              </G>
            </Svg>
            <Text style={s.muted}>{step + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
