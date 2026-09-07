"use client";

import React, {
  useCallback,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useOAT } from "../../oat/react/index.js";
import { AnchoredPopover } from "./anchored-popover.js";
import { L10nWordDetailContent } from "./l10n-word-detail-content.js";
import type {
  L10nWordDetailData,
  L10nWordDetailHandler,
} from "./l10n-word-detail-types.js";

export type UseL10nWordDetailPopoverOptions = {
  guiLang: string;
  focusLang?: string;
  className?: string;
  offset?: number;
};

export type L10nWordDetailPopoverHandle = {
  PopoverComponent: ReactNode;
  l10nWordDetailHandler: L10nWordDetailHandler;
  openL10nWordDetail: (
    data: L10nWordDetailData,
    event?: MouseEvent<HTMLElement>,
  ) => void;
  closeL10nWordDetail: () => void;
  open: boolean;
  l10nWordDetailData: L10nWordDetailData | null;
};

/** Word-details state and content composed over the shared anchored popover. */
export function useL10nWordDetailPopover({
  guiLang,
  focusLang,
  className,
  offset = 8,
}: UseL10nWordDetailPopoverOptions): L10nWordDetailPopoverHandle {
  const { OAT } = useOAT();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [l10nWordDetailData, setL10nWordDetailData] =
    useState<L10nWordDetailData | null>(null);

  const closeL10nWordDetail = useCallback(() => {
    setOpen(false);
  }, []);

  const openL10nWordDetail = useCallback(
    (data: L10nWordDetailData, event?: MouseEvent<HTMLElement>) => {
      const nextAnchor =
        event?.currentTarget ??
        (typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      if (!nextAnchor) {
        console.warn("Could not open word details without an anchor element.");
        return;
      }
      setAnchor(nextAnchor);
      setL10nWordDetailData(data);
      setOpen(true);
    },
    [],
  );

  const l10nWordDetailHandler = useCallback<L10nWordDetailHandler>(
    (l10nAText, l10nATextTokenIdx, event, wordSubMorphemes) => {
      const l10nWord = l10nAText.tokens[l10nATextTokenIdx]?.text;
      if (!l10nWord) return;

      const tappedAnchor = event.currentTarget;
      if (open && anchor === tappedAnchor) {
        closeL10nWordDetail();
        return;
      }
      setAnchor(tappedAnchor);
      setL10nWordDetailData({
        l10nWord,
        l10nLang: l10nAText.lang,
        l10nAText,
        l10nATextTokenIdx,
        wordSubMorphemes,
      });
      setOpen(true);
    },
    [anchor, closeL10nWordDetail, open],
  );

  const PopoverComponent =
    l10nWordDetailData ? (
      <AnchoredPopover
        anchor={anchor}
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeL10nWordDetail();
        }}
        ariaLabel={OAT("Word details")}
        className={[
          "lingop-word-detail-popover",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        offset={offset}
      >
        <button
          type="button"
          className="lingop-word-detail-popover__close"
          aria-label={OAT("Close")}
          onClick={closeL10nWordDetail}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <L10nWordDetailContent
          l10nWordDetailData={l10nWordDetailData}
          guiLang={guiLang}
          {...(focusLang ? { focusLang } : {})}
          onClose={closeL10nWordDetail}
        />
      </AnchoredPopover>
    ) : null;

  return {
    PopoverComponent,
    l10nWordDetailHandler,
    openL10nWordDetail,
    closeL10nWordDetail,
    open,
    l10nWordDetailData,
  };
}
