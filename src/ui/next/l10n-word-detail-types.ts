import type { MouseEvent } from "react";

import type {
  AnnotatedText,
  ATokenSubMorphemes,
} from "../../core/annotation/types.js";

export type { L10nWordDetailData } from "../l10n-word-detail-types.js";

export type L10nWordDetailHandler = (
  l10nAText: AnnotatedText,
  l10nATextTokenIdx: number,
  eventWithCurrentTarget: MouseEvent<HTMLDivElement>,
  wordSubMorphemes: ATokenSubMorphemes,
) => void;
