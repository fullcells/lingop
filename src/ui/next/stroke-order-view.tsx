"use client";

import React, { useEffect, useState } from "react";

import { useOAT } from "../../oat/react/index.js";
import {
  localStrokeDataProvider,
  STROKE_SOURCE_LABELS,
  type StrokeCharacterData,
  type StrokeDataProvider,
} from "../../stroke-order/index.js";

type StrokeLoadResult = {
  character: string;
  data: StrokeCharacterData | null;
  failed: boolean;
};

export type StrokeOrderViewProps = {
  characters: string[];
  lang: string;
  provider?: StrokeDataProvider;
};

export function StrokeOrderView({
  characters,
  lang,
  provider = localStrokeDataProvider,
}: StrokeOrderViewProps) {
  const { OAT } = useOAT();
  const [results, setResults] = useState<StrokeLoadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const characterKey = characters.join("");

  useEffect(() => {
    let cancelled = false;
    const stableCharacters = [...characterKey];
    setResults([]);
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
            data: await provider.get(character, lang),
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
  }, [characterKey, lang, provider]);

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
      {results.map((result) =>
        result.data ? (
          <StrokeCharacterDiagram data={result.data} key={result.character} />
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
  const sourceLabel = STROKE_SOURCE_LABELS[data.source];
  return (
    <section className="lingop-word-detail__stroke-character">
      <header className="lingop-word-detail__stroke-character-header">
        <span className="lingop-word-detail__stroke-character-literal">
          {data.character}
        </span>
        <span>
          {data.strokes.length} {OAT("strokes")}
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
      <ol className="lingop-word-detail__stroke-steps">
        {data.strokes.map((_, activeStroke) => (
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
                {data.strokes.slice(0, activeStroke + 1).map((path, index) => (
                  <path
                    d={path}
                    data-active={index === activeStroke || undefined}
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
