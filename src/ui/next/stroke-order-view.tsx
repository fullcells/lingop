"use client";

import React, { useEffect, useState } from "react";

import { useOAT } from "../../oat/react/index.js";
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
import {
  readWordDetailStrokeView,
  writeWordDetailStrokeView,
} from "./l10n-word-detail-utils.js";
import { StrokeCharacterFigure } from "./stroke-order-figure.js";

type StrokeLoadResult = {
  character: string;
  data: StrokeCharacterData | null;
  failed: boolean;
};

export type StrokeOrderViewProps = {
  characters: string[];
  lang: string;
  provider?: StrokeDataProvider;
  /** Controlled view. Omit to let the user choose (remembered in browser storage). */
  view?: StrokeView;
  /** Initial view when uncontrolled; skips the remembered choice. */
  defaultView?: StrokeView;
  onViewChange?: (view: StrokeView) => void;
  /** Views offered in the picker; the picker is hidden when only one is offered. */
  views?: readonly StrokeView[];
};

export function StrokeOrderView({
  characters,
  lang,
  provider = localStrokeDataProvider,
  view,
  defaultView,
  onViewChange,
  views = STROKE_VIEWS,
}: StrokeOrderViewProps) {
  const { OAT } = useOAT();
  const [results, setResults] = useState<StrokeLoadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosenView, setChosenView] = useState<StrokeView>(
    defaultView ?? DEFAULT_STROKE_VIEW,
  );
  const characterKey = characters.join("");

  // Read the remembered view after mount so server and client markup match.
  useEffect(() => {
    if (view === undefined && defaultView === undefined) {
      setChosenView(readWordDetailStrokeView());
    }
    // Only on mount: later choices are already in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestedView = view ?? chosenView;
  const selectedView = views.includes(requestedView)
    ? requestedView
    : (views[0] ?? DEFAULT_STROKE_VIEW);
  // Once a view has needed centrelines, keep them so switching back and forth
  // does not reload anything.
  const [withCentrelines, setWithCentrelines] = useState(false);
  const needsCentrelines =
    withCentrelines || strokeViewNeedsCentrelines(selectedView);
  useEffect(() => {
    if (needsCentrelines) setWithCentrelines(true);
  }, [needsCentrelines]);

  const selectView = (next: StrokeView) => {
    onViewChange?.(next);
    if (view === undefined) {
      setChosenView(next);
      writeWordDetailStrokeView(next);
    }
  };

  // Clear results only when the characters change, not when centrelines are
  // added, so the current diagrams stay on screen while they load.
  useEffect(() => {
    setResults([]);
  }, [characterKey, lang, provider]);

  useEffect(() => {
    let cancelled = false;
    const stableCharacters = [...characterKey];
    if (stableCharacters.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.all(
      stableCharacters.map(async (character): Promise<StrokeLoadResult> => {
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
        } catch (error) {
          console.warn(`Could not load stroke data for ${character}.`, error);
          return { character, data: null, failed: true };
        }
      }),
    ).then((nextResults) => {
      if (cancelled) return;
      setResults(nextResults);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [characterKey, lang, provider, needsCentrelines]);

  if (loading && results.length === 0) {
    return (
      <span
        className="lingop-word-detail__spinner"
        aria-label={OAT("Loading stroke order")}
      />
    );
  }
  if (characters.length === 0) {
    return (
      <p className="lingop-word-detail__stroke-message">
        {OAT("No characters with stroke-order data were found.")}
      </p>
    );
  }

  return (
    <div className="lingop-word-detail__stroke-results">
      {views.length > 1 && (
        <div
          className="lingop-word-detail__segment lingop-word-detail__stroke-views"
          role="radiogroup"
          aria-label={OAT("Stroke view")}
        >
          {views.map((option) => (
            <button
              type="button"
              role="radio"
              aria-checked={option === selectedView}
              data-selected={option === selectedView ? true : undefined}
              onClick={() => selectView(option)}
              key={option}
            >
              <StrokeViewLabel view={option} />
            </button>
          ))}
        </div>
      )}
      {results.map((result) =>
        result.data ? (
          <StrokeCharacter
            data={result.data}
            view={selectedView}
            loading={loading}
            key={result.character}
          />
        ) : (
          <StrokeCharacterStatus
            character={result.character}
            failed={result.failed}
            key={result.character}
          />
        ),
      )}
    </div>
  );
}

function StrokeViewLabel({ view }: { view: StrokeView }) {
  const { OAT } = useOAT();
  switch (view) {
    case "STEPS":
      return <>{OAT("Steps")}</>;
    case "NUMBERS":
      return <>{OAT("Numbers")}</>;
    case "ARROWS":
      return <>{OAT("Arrows")}</>;
    case "COLORS":
      return <>{OAT("Colors")}</>;
    case "ANIMATED":
      return <>{OAT("Animated")}</>;
  }
}

/**
 * One character in the chosen view. Single-image views need centrelines; while
 * they load a spinner holds the place, and characters without them fall back
 * to the step diagram.
 */
export function StrokeCharacter({
  data,
  view = DEFAULT_STROKE_VIEW,
  loading = false,
}: {
  data: StrokeCharacterData;
  view?: StrokeView;
  loading?: boolean;
}) {
  const { OAT } = useOAT();
  if (view === "STEPS") return <StrokeCharacterDiagram data={data} />;
  if (!data.centrelines) {
    return loading ? (
      <section className="lingop-word-detail__stroke-character">
        <StrokeCharacterHeader data={data} />
        <span
          className="lingop-word-detail__spinner"
          aria-label={OAT("Loading stroke order")}
        />
      </section>
    ) : (
      <StrokeCharacterDiagram data={data} />
    );
  }
  return (
    <section className="lingop-word-detail__stroke-character">
      <StrokeCharacterHeader data={data} />
      <StrokeCharacterFigure data={data} view={view} />
    </section>
  );
}

function StrokeCharacterStatus({
  character,
  failed,
}: {
  character: string;
  failed: boolean;
}) {
  const { OAT } = useOAT();
  return (
    <section className="lingop-word-detail__stroke-character">
      <header className="lingop-word-detail__stroke-character-header">
        <span className="lingop-word-detail__stroke-character-literal">
          {character}
        </span>
      </header>
      <p
        className={
          failed
            ? "lingop-word-detail__stroke-error"
            : "lingop-word-detail__stroke-message"
        }
        role={failed ? "alert" : undefined}
      >
        {failed
          ? OAT("Unable to load stroke order.")
          : OAT("No stroke order information available.")}
      </p>
    </section>
  );
}

export function StrokeCharacterDiagram({
  data,
}: {
  data: StrokeCharacterData;
}) {
  const { OAT } = useOAT();
  const penStrokes = getPenStrokes(data);
  return (
    <section className="lingop-word-detail__stroke-character">
      <StrokeCharacterHeader data={data} />
      <ol className="lingop-word-detail__stroke-steps">
        {penStrokes.map((activeShapes, activeStroke) => (
          <li key={activeStroke}>
            <svg
              viewBox={data.viewBox}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`${data.character}: ${OAT("step")} ${activeStroke + 1}`}
              data-path-kind={data.pathKind.toLowerCase()}
            >
              <title>
                {`${data.character}: ${OAT("step")} ${activeStroke + 1}`}
              </title>
              <g {...(data.transform ? { transform: data.transform } : {})}>
                {penStrokes
                  .slice(0, activeStroke + 1)
                  .flat()
                  .map((index) => (
                    <path
                      d={data.strokes[index]}
                      data-active={activeShapes.includes(index) || undefined}
                      key={index}
                    />
                  ))}
              </g>
            </svg>
            <span aria-hidden>{activeStroke + 1}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StrokeCharacterHeader({ data }: { data: StrokeCharacterData }) {
  const { OAT } = useOAT();
  const sourceLabel = STROKE_SOURCE_LABELS[data.source];
  return (
    <header className="lingop-word-detail__stroke-character-header">
      <span className="lingop-word-detail__stroke-character-literal">
        {data.character}
      </span>
      <span>
        {getPenStrokes(data).length} {OAT("strokes")}
      </span>
      <span
        aria-label={`${OAT("Stroke source")}: ${sourceLabel}`}
        className="lingop-word-detail__stroke-source"
        role="img"
        title={`${OAT("Stroke source")}: ${sourceLabel}`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <circle cx="8" cy="4.25" r="2.25" />
          <path d="M3.5 14c.45-3.25 2-5 4.5-5s4.05 1.75 4.5 5" />
        </svg>
      </span>
    </header>
  );
}
