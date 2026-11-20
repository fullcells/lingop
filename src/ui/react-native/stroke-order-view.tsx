import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Svg, G, Path } from "react-native-svg";
import {
  DEFAULT_STROKE_VIEW,
  getPenStrokes,
  localStrokeDataProvider,
  STROKE_SOURCE_LABELS,
  STROKE_VIEWS,
  strokeViewNeedsCentrelines,
  type StrokeCharacterData,
  type StrokeDataProvider,
  type StrokeView,
} from "../../stroke-order/index.js";
import { useNativeResource } from "./native-resource.js";
import { StrokeCharacterFigure } from "./stroke-order-figure.js";
import { defaultTranslate, type NativeTranslate } from "./word-detail-types.js";
import { Action, s } from "./word-detail-controls.js";

export type StrokeOrderViewProps = {
  characters: readonly string[];
  lang: string;
  provider?: StrokeDataProvider;
  translate?: NativeTranslate;
  /** Controlled view. Omit to let the user choose. */
  view?: StrokeView;
  /** Initial view when uncontrolled. */
  defaultView?: StrokeView;
  onViewChange?: (view: StrokeView) => void;
  /** Views offered in the picker; the picker is hidden when only one is offered. */
  views?: readonly StrokeView[];
};

type StrokeLoadResult = {
  character: string;
  data: StrokeCharacterData | null;
  failed: boolean;
};

export function StrokeOrderView({
  characters,
  lang,
  provider = localStrokeDataProvider,
  translate = defaultTranslate,
  view,
  defaultView = DEFAULT_STROKE_VIEW,
  onViewChange,
  views = STROKE_VIEWS,
}: StrokeOrderViewProps) {
  const [chosenView, setChosenView] = useState<StrokeView>(defaultView);
  const requestedView = view ?? chosenView;
  const selectedView = views.includes(requestedView)
    ? requestedView
    : (views[0] ?? DEFAULT_STROKE_VIEW);
  // Once a view has needed centrelines, keep them so switching views does not
  // reload anything.
  const [withCentrelines, setWithCentrelines] = useState(false);
  const needsCentrelines =
    withCentrelines || strokeViewNeedsCentrelines(selectedView);
  useEffect(() => {
    if (needsCentrelines) setWithCentrelines(true);
  }, [needsCentrelines]);

  const key = JSON.stringify(characters);
  const load = useMemo(
    () => () =>
      Promise.all(
        (JSON.parse(key) as string[]).map(
          async (character): Promise<StrokeLoadResult> => {
            try {
              return {
                character,
                data: await provider.get(
                  character,
                  lang,
                  needsCentrelines ? { centrelines: true } : undefined,
                ),
                failed: false,
              };
            } catch {
              return { character, data: null, failed: true };
            }
          },
        ),
      ),
    [key, lang, provider, needsCentrelines],
  );
  const result = useNativeResource(load);
  // Keep the previous diagrams on screen while centrelines are added.
  const shown = useRef<{ key: string; value: StrokeLoadResult[] } | null>(null);
  if (result.value) shown.current = { key: `${key}:${lang}`, value: result.value };
  const value =
    result.value ??
    (shown.current?.key === `${key}:${lang}` ? shown.current.value : undefined);
  if (!characters.length)
    return (
      <Text style={s.muted}>
        {translate("No characters with stroke-order data were found.")}
      </Text>
    );
  if (!value && result.status === "LOADING")
    return (
      <ActivityIndicator
        accessibilityLabel={translate("Loading stroke order")}
      />
    );
  return (
    <View style={s.section}>
      {views.length > 1 && (
        <View accessibilityRole="radiogroup" style={s.row}>
          {views.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: option === selectedView }}
              onPress={() => {
                onViewChange?.(option);
                if (view === undefined) setChosenView(option);
              }}
              style={[
                s.button,
                option === selectedView && { backgroundColor: "#c9dfbd" },
              ]}
            >
              <Text style={s.buttonText}>
                {translate(STROKE_VIEW_LABELS[option])}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {value?.map(({ character, data, failed }) =>
        data ? (
          <StrokeCharacter
            key={character}
            data={data}
            view={selectedView}
            loading={result.status === "LOADING"}
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
      {(result.status === "FAILED" || value?.some(({ failed }) => failed)) && (
        <Action label={translate("Retry")} onPress={result.retry} />
      )}
    </View>
  );
}
const STROKE_VIEW_LABELS: Record<StrokeView, string> = {
  STEPS: "Steps",
  NUMBERS: "Numbers",
  ARROWS: "Arrows",
  COLORS: "Colors",
  ANIMATED: "Animated",
};

/**
 * One character in the chosen view. Single-image views need centrelines;
 * while they load a spinner holds the place, and characters without them fall
 * back to the step diagram.
 */
export function StrokeCharacter({
  data,
  view = DEFAULT_STROKE_VIEW,
  loading = false,
  translate = defaultTranslate,
}: {
  data: StrokeCharacterData;
  view?: StrokeView;
  loading?: boolean;
  translate?: NativeTranslate;
}) {
  if (view === "STEPS" || (!data.centrelines && !loading))
    return <StrokeCharacterDiagram data={data} translate={translate} />;
  return (
    <View style={s.section}>
      <StrokeCharacterHeader data={data} translate={translate} />
      {data.centrelines ? (
        <StrokeCharacterFigure data={data} view={view} translate={translate} />
      ) : (
        <ActivityIndicator
          accessibilityLabel={translate("Loading stroke order")}
        />
      )}
    </View>
  );
}

function StrokeCharacterHeader({
  data,
  translate,
}: {
  data: StrokeCharacterData;
  translate: NativeTranslate;
}) {
  return (
    <>
      <Text style={s.body}>
        {data.character} · {getPenStrokes(data).length} {translate("strokes")}
      </Text>
      <Text style={s.muted}>
        {translate("Stroke source")}: {STROKE_SOURCE_LABELS[data.source]}
      </Text>
    </>
  );
}

export function StrokeCharacterDiagram({
  data,
  translate = defaultTranslate,
}: {
  data: StrokeCharacterData;
  translate?: NativeTranslate;
}) {
  const penStrokes = getPenStrokes(data);
  return (
    <View style={s.section}>
      <StrokeCharacterHeader data={data} translate={translate} />
      <View style={s.row}>
        {penStrokes.map((activeShapes, step) => (
          <View key={step} style={{ alignItems: "center" }}>
            <Svg
              width={72}
              height={72}
              viewBox={data.viewBox}
              accessibilityRole="image"
              accessibilityLabel={`${data.character}: ${translate("step")} ${step + 1}`}
            >
              <G {...(data.transform ? { transform: data.transform } : {})}>
                {penStrokes
                  .slice(0, step + 1)
                  .flat()
                  .map((index) => {
                    const color = activeShapes.includes(index)
                      ? "#dc493a"
                      : "#173e32";
                    return (
                      <Path
                        key={index}
                        d={data.strokes[index] ?? ""}
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
