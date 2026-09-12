import type { AnnotatedText } from "../annotation/types.js";
import type { Localization } from "../misc.js";
import {
  buildBinderDocSegmentLocalization,
  buildLocalizedBinderDocSegmentLocalization,
} from "./localization.js";
import type {
  AnnotatedMarkdownSegment,
  BinderDocRow,
  BinderRow,
  MarkdownSegment,
} from "./types.js";

export type BinderAnnotationFetcher = (input: {
  localization: Localization;
}) => Promise<AnnotatedText | null>;

type AnnotateBinderMarkdownLinesCommonInput = {
  lines: MarkdownSegment[][];
  binder: Pick<BinderRow, "id" | "lang"> & { owner_id?: string | null };
  doc: Pick<BinderDocRow, "id">;
  fetchAnnotation: BinderAnnotationFetcher;
  onAnnotationComplete?: () => void;
};

export type AnnotateBinderMarkdownLinesInput =
  AnnotateBinderMarkdownLinesCommonInput &
    (
      | {
          localization?: undefined;
          l10nLang?: string;
          translationId?: never;
        }
      | {
          localization: Localization;
          l10nLang: string;
          translationId?: number | null;
        }
    );

/** Annotates every non-markdown, non-empty segment while preserving line shape. */
export async function annotateBinderMarkdownLines({
  lines,
  binder,
  doc,
  fetchAnnotation,
  l10nLang,
  localization,
  translationId,
  onAnnotationComplete,
}: AnnotateBinderMarkdownLinesInput): Promise<AnnotatedMarkdownSegment[][]> {
  return Promise.all(
    lines.map((line, lineIdx) =>
      Promise.all(
        line.map(async (segment, segIdx): Promise<AnnotatedMarkdownSegment> => {
          if (segment.isMd || segment.text.trim().length === 0) return segment;

          const segmentLocalization = localization
            ? buildLocalizedBinderDocSegmentLocalization({
                localization,
                text: segment.text,
                l10nLang,
                lineIdx,
                segIdx,
                binderId: binder.id,
                docId: doc.id,
                ...(translationId === undefined ? {} : { translationId }),
                ...(binder.owner_id === undefined ? {} : { ownerId: binder.owner_id }),
              })
            : buildBinderDocSegmentLocalization({
                binder,
                doc,
                text: segment.text,
                lineIdx,
                segIdx,
                ...(l10nLang === undefined ? {} : { l10nLang }),
              });

          try {
            const atext = await fetchAnnotation({ localization: segmentLocalization });
            return { ...segment, atext };
          } finally {
            onAnnotationComplete?.();
          }
        }),
      ),
    ),
  );
}
