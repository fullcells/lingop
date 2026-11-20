import { useEffect, useId, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Svg,
  Text as SvgText,
} from "react-native-svg";
import {
  getStrokeFigure,
  type StrokeCharacterData,
  type StrokeFigure,
  type StrokeFigurePenStroke,
  type StrokeView,
} from "../../stroke-order/index.js";
import { Action } from "./word-detail-controls.js";
import { defaultTranslate, type NativeTranslate } from "./word-detail-types.js";

export type NativeStrokeFigureView = Exclude<StrokeView, "STEPS">;

const INK = "#173e32";
const GHOST = "#d5dccf";
const ACCENT = "#dc493a";
const FRAME = "rgba(23, 62, 50, 0.04)";
const GUIDE = "rgba(23, 62, 50, 0.12)";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * One image of a whole character: numbered stroke starts, direction arrows,
 * order colours, or a drawing animation. Returns null when the character's
 * centrelines were not loaded, so callers can fall back to the step diagram.
 */
export function StrokeCharacterFigure({
  data,
  view,
  size = 208,
  translate = defaultTranslate,
}: {
  data: StrokeCharacterData;
  view: NativeStrokeFigureView;
  size?: number;
  translate?: NativeTranslate;
}) {
  const [replays, setReplays] = useState(0);
  const figure = getStrokeFigure(data, { sizePx: size });
  if (!figure) return null;
  return (
    <View style={{ gap: 8, alignItems: "flex-start" }}>
      <Svg
        width={size}
        height={size}
        viewBox={figure.viewBox}
        accessibilityRole="image"
        accessibilityLabel={`${data.character}: ${translate("stroke order")}`}
      >
        <Frame figure={figure} />
        {view === "ANIMATED" ? (
          <AnimatedStrokes data={data} figure={figure} key={replays} />
        ) : (
          <>
            {figure.penStrokes.map((penStroke) => (
              <Shapes
                data={data}
                penStroke={penStroke}
                color={
                  view === "ARROWS"
                    ? GHOST
                    : view === "COLORS"
                      ? penStroke.color
                      : INK
                }
                key={penStroke.number}
              />
            ))}
            {view === "ARROWS" &&
              figure.penStrokes.map(({ number, arrow }) => (
                <G key={number}>
                  <Path
                    d={arrow.body}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={figure.arrowWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path d={arrow.head} fill={ACCENT} />
                </G>
              ))}
            {figure.penStrokes.map((penStroke) => (
              <Label
                figure={figure}
                penStroke={penStroke}
                color={view === "COLORS" ? penStroke.color : ACCENT}
                key={penStroke.number}
              />
            ))}
          </>
        )}
      </Svg>
      {view === "ANIMATED" && (
        <Action
          label={translate("Replay")}
          onPress={() => setReplays((count) => count + 1)}
        />
      )}
    </View>
  );
}

function Frame({ figure }: { figure: StrokeFigure }) {
  const { x, y, width, height } = figure.frame;
  const guide = { stroke: GUIDE, strokeWidth: width * 0.004 };
  return (
    <G>
      <Rect x={x} y={y} width={width} height={height} rx={width * 0.02} fill={FRAME} />
      <Line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} {...guide} />
      <Line x1={x} y1={y + height / 2} x2={x + width} y2={y + height / 2} {...guide} />
    </G>
  );
}

function shapePaint(data: StrokeCharacterData, color: string, width: number) {
  return data.pathKind === "OUTLINE"
    ? { fill: color }
    : {
        fill: "none",
        stroke: color,
        strokeWidth: width,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
      };
}

function Shapes({
  data,
  penStroke,
  color,
}: {
  data: StrokeCharacterData;
  penStroke: StrokeFigurePenStroke;
  color: string;
}) {
  const paint = shapePaint(data, color, 5);
  return (
    <G {...(data.transform ? { transform: data.transform } : {})}>
      {penStroke.shapes.map(({ index }) => (
        <Path key={index} d={data.strokes[index] ?? ""} {...paint} />
      ))}
    </G>
  );
}

function Label({
  figure,
  penStroke,
  color,
}: {
  figure: StrokeFigure;
  penStroke: StrokeFigurePenStroke;
  color: string;
}) {
  const r = figure.labelRadius;
  const { anchor, center, leader, number } = penStroke.label;
  return (
    <G>
      {leader && (
        <Line
          x1={leader[0][0]}
          y1={leader[0][1]}
          x2={leader[1][0]}
          y2={leader[1][1]}
          stroke={color}
          strokeWidth={r * 0.13}
        />
      )}
      <Circle cx={anchor[0]} cy={anchor[1]} r={r * 0.3} fill={color} stroke="#ffffff" strokeWidth={r * 0.1} />
      <Circle cx={center[0]} cy={center[1]} r={r} fill={color} stroke="#ffffff" strokeWidth={r * 0.14} />
      <SvgText
        x={center[0]}
        y={center[1] + figure.labelFontSize * 0.36}
        fill="#ffffff"
        fontSize={figure.labelFontSize * (number > 9 ? 0.85 : 1)}
        fontWeight="700"
        textAnchor="middle"
      >
        {String(number)}
      </SvgText>
    </G>
  );
}

/**
 * Each shape is revealed by a brush moving along its centreline (clipped to the
 * outline for outline sources). One Animated clock drives every brush and
 * label; with Reduce Motion on, the finished character is shown at once.
 */
function AnimatedStrokes({ data, figure }: { data: StrokeCharacterData; figure: StrokeFigure }) {
  const id = useId().replace(/:/g, "");
  const clock = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let active = true;
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .catch(() => false)
      .then((reduceMotion) => {
        if (!active) return;
        if (reduceMotion) {
          clock.setValue(figure.animationMs);
          return;
        }
        animation = Animated.timing(clock, {
          toValue: figure.animationMs,
          duration: figure.animationMs,
          easing: Easing.linear,
          useNativeDriver: false,
        });
        animation.start();
      });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [clock, figure]);

  const outline = data.pathKind === "OUTLINE";
  const transform: { transform?: string } = data.transform
    ? { transform: data.transform }
    : {};
  const width = outline ? figure.brushWidth : figure.strokeWidth;
  return (
    <>
      {figure.penStrokes.map((penStroke) => (
        <Shapes data={data} penStroke={penStroke} color={GHOST} key={penStroke.number} />
      ))}
      {outline && (
        <Defs>
          {figure.penStrokes.flatMap(({ shapes }) =>
            shapes.map(({ index }) => (
              <ClipPath id={`${id}-clip-${index}`} key={index}>
                <Path d={data.strokes[index] ?? ""} {...transform} />
              </ClipPath>
            )),
          )}
        </Defs>
      )}
      {figure.penStrokes.flatMap(({ shapes }) => {
        const last = shapes[shapes.length - 1]!;
        const settled = last.delayMs + last.durationMs;
        return shapes.map((shape) => {
          // Outline brushes follow the measured polyline exactly; centreline
          // paths are curves, so allow a little extra dash length.
          const dash = (outline ? shape.brushLength : shape.brushLength * 1.08) + width;
          const props = {
            fill: "none",
            strokeWidth: width,
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
            strokeDasharray: [dash, dash + 2 * width],
            strokeDashoffset: clock.interpolate({
              inputRange: [shape.delayMs, shape.delayMs + shape.durationMs],
              outputRange: [dash + width, 0],
              extrapolate: "clamp",
            }),
            stroke: clock.interpolate({
              inputRange: [settled - 1, settled],
              outputRange: [ACCENT, INK],
              extrapolate: "clamp",
            }),
          };
          return outline ? (
            <AnimatedPath
              key={shape.index}
              d={shape.brush}
              clipPath={`url(#${id}-clip-${shape.index})`}
              {...props}
            />
          ) : (
            <G key={shape.index} {...transform}>
              <AnimatedPath d={data.strokes[shape.index] ?? ""} {...props} />
            </G>
          );
        });
      })}
      {figure.penStrokes.map((penStroke) => {
        const start = penStroke.shapes[0]?.delayMs ?? 0;
        return (
          <AnimatedG
            key={penStroke.number}
            opacity={clock.interpolate({
              inputRange: [start, start + 160],
              outputRange: [0, 1],
              extrapolate: "clamp",
            })}
          >
            <Label figure={figure} penStroke={penStroke} color={ACCENT} />
          </AnimatedG>
        );
      })}
    </>
  );
}
