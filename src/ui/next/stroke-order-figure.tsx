"use client";

import React, { useId, useState, type CSSProperties } from "react";

import { useOAT } from "../../oat/react/index.js";
import {
  getStrokeFigure,
  type StrokeCharacterData,
  type StrokeFigure,
  type StrokeFigurePenStroke,
  type StrokeView,
} from "../../stroke-order/index.js";

export type StrokeFigureView = Exclude<StrokeView, "STEPS">;

type Tone = "ink" | "ghost";

/**
 * One image of a whole character: numbered stroke starts, direction arrows,
 * order colours, or a drawing animation. Returns null when the character's
 * centrelines were not loaded, so callers can fall back to the step diagram.
 */
export function StrokeCharacterFigure({
  data,
  view,
}: {
  data: StrokeCharacterData;
  view: StrokeFigureView;
}) {
  const { OAT } = useOAT();
  const [replays, setReplays] = useState(0);
  const figure = getStrokeFigure(data);
  if (!figure) return null;

  const label = `${data.character}: ${OAT("stroke order")}`;
  return (
    <div className="lingop-word-detail__stroke-figure-wrap">
      <svg
        className="lingop-word-detail__stroke-figure"
        viewBox={figure.viewBox}
        role="img"
        aria-label={label}
        data-view={view.toLowerCase()}
        data-path-kind={data.pathKind.toLowerCase()}
      >
        <title>{label}</title>
        <FigureFrame figure={figure} />
        {view === "ANIMATED" ? (
          <AnimatedStrokes data={data} figure={figure} key={replays} />
        ) : (
          <>
            {figure.penStrokes.map((penStroke) => (
              <Shapes
                data={data}
                penStroke={penStroke}
                tone={view === "ARROWS" ? "ghost" : "ink"}
                color={view === "COLORS" ? penStroke.color : undefined}
                key={penStroke.number}
              />
            ))}
            {view === "ARROWS" && <Arrows figure={figure} />}
            {figure.penStrokes.map((penStroke) => (
              <Label
                figure={figure}
                penStroke={penStroke}
                color={view === "COLORS" ? penStroke.color : undefined}
                key={penStroke.number}
              />
            ))}
          </>
        )}
      </svg>
      {view === "ANIMATED" && (
        <button
          type="button"
          className="lingop-word-detail__stroke-replay"
          onClick={() => setReplays((count) => count + 1)}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" />
          </svg>
          {OAT("Replay")}
        </button>
      )}
    </div>
  );
}

function FigureFrame({ figure }: { figure: StrokeFigure }) {
  const { x, y, width, height } = figure.frame;
  return (
    <g className="lingop-stroke-frame" aria-hidden="true">
      <rect x={x} y={y} width={width} height={height} rx={width * 0.02} />
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} strokeWidth={width * 0.004} />
      <line x1={x} y1={y + height / 2} x2={x + width} y2={y + height / 2} strokeWidth={width * 0.004} />
    </g>
  );
}

/** The shapes of one pen stroke, in the source's coordinate transform. */
function Shapes({
  data,
  penStroke,
  tone,
  color,
}: {
  data: StrokeCharacterData;
  penStroke: StrokeFigurePenStroke;
  tone: Tone;
  color?: string | undefined;
}) {
  const style: CSSProperties | undefined = color
    ? data.pathKind === "OUTLINE"
      ? { fill: color }
      : { stroke: color }
    : undefined;
  return (
    <g {...(data.transform ? { transform: data.transform } : {})}>
      {penStroke.shapes.map(({ index }) => (
        <path
          className="lingop-stroke-shape"
          d={data.strokes[index]}
          data-tone={tone}
          style={style}
          key={index}
        />
      ))}
    </g>
  );
}

function Arrows({ figure }: { figure: StrokeFigure }) {
  return (
    <g className="lingop-stroke-arrows" aria-hidden="true">
      {figure.penStrokes.map(({ number, arrow }) => (
        <g key={number}>
          <path d={arrow.body} strokeWidth={figure.arrowWidth} />
          <path d={arrow.head} />
        </g>
      ))}
    </g>
  );
}

function Label({
  figure,
  penStroke,
  color,
  style,
}: {
  figure: StrokeFigure;
  penStroke: StrokeFigurePenStroke;
  color?: string | undefined;
  style?: CSSProperties;
}) {
  const r = figure.labelRadius;
  const { anchor, center, leader, number } = penStroke.label;
  const paint = color ? { fill: color, stroke: color } : undefined;
  return (
    <g className="lingop-stroke-label" style={style} aria-hidden="true">
      {leader && (
        <line
          x1={leader[0][0]}
          y1={leader[0][1]}
          x2={leader[1][0]}
          y2={leader[1][1]}
          strokeWidth={r * 0.13}
          style={color ? { stroke: color } : undefined}
        />
      )}
      <circle className="lingop-stroke-label-dot" cx={anchor[0]} cy={anchor[1]} r={r * 0.3} strokeWidth={r * 0.1} style={color ? { fill: color } : undefined} />
      <circle className="lingop-stroke-label-badge" cx={center[0]} cy={center[1]} r={r} strokeWidth={r * 0.14} style={paint} />
      {/* Inline typography: host apps often reset `font` on every element,
          which would override SVG font attributes. */}
      <text
        x={center[0]}
        y={center[1] + r * 0.04}
        style={{
          fontSize: figure.labelFontSize * (number > 9 ? 0.85 : 1),
          fontWeight: 600,
          fontFamily: "system-ui, -apple-system, sans-serif",
          lineHeight: 1,
        }}
      >
        {number}
      </text>
    </g>
  );
}

/**
 * Each shape is revealed by a brush moving along its centreline. Outline
 * shapes clip a wide brush to the outline; centreline shapes draw the path
 * itself. Timing comes from CSS custom properties, so playback needs no
 * JavaScript timers and honours prefers-reduced-motion.
 */
function AnimatedStrokes({ data, figure }: { data: StrokeCharacterData; figure: StrokeFigure }) {
  const id = useId().replace(/:/g, "");
  const outline = data.pathKind === "OUTLINE";
  const transform = data.transform ? { transform: data.transform } : {};
  return (
    <>
      {figure.penStrokes.map((penStroke) => (
        <Shapes data={data} penStroke={penStroke} tone="ghost" key={penStroke.number} />
      ))}
      {outline && (
        <defs>
          {figure.penStrokes.flatMap(({ shapes }) =>
            shapes.map(({ index }) => (
              <clipPath id={`${id}-clip-${index}`} key={index}>
                <path d={data.strokes[index]} {...transform} />
              </clipPath>
            )),
          )}
        </defs>
      )}
      {figure.penStrokes.flatMap(({ shapes }) =>
        shapes.map((shape) => {
          const width = outline ? figure.brushWidth : figure.strokeWidth;
          const last = shapes[shapes.length - 1]!;
          // The whole pen stroke stays highlighted until its last shape is drawn.
          const settleMs = last.delayMs + last.durationMs - shape.delayMs;
          // A dash covering the whole path, starting fully hidden: its end
          // (and round cap) sits one brush width before the path begins.
          const dash = shape.brushLength + width;
          const style = {
            "--lingop-stroke-dash": `${dash}`,
            "--lingop-stroke-gap": `${dash + 2 * width}`,
            "--lingop-stroke-start": `${dash + width}`,
            "--lingop-stroke-delay": `${shape.delayMs}ms`,
            "--lingop-stroke-duration": `${shape.durationMs}ms`,
            "--lingop-stroke-settle": `${settleMs}ms`,
          } as CSSProperties;
          return outline ? (
            <path
              className="lingop-stroke-brush"
              d={shape.brush}
              strokeWidth={width}
              clipPath={`url(#${id}-clip-${shape.index})`}
              style={style}
              key={shape.index}
            />
          ) : (
            <g {...transform} key={shape.index}>
              {/* pathLength makes dash units match the measured centreline length. */}
              <path
                className="lingop-stroke-brush"
                d={data.strokes[shape.index]}
                pathLength={shape.brushLength}
                strokeWidth={width}
                style={style}
              />
            </g>
          );
        }),
      )}
      {figure.penStrokes.map((penStroke) => (
        <Label
          figure={figure}
          penStroke={penStroke}
          style={{ "--lingop-stroke-delay": `${penStroke.shapes[0]?.delayMs ?? 0}ms` } as CSSProperties}
          key={penStroke.number}
        />
      ))}
    </>
  );
}
