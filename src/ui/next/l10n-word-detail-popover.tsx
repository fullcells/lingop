"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { L10nWordDetailContent } from "./l10n-word-detail-content.js";
import {
  getAnchoredPopoverPosition,
  type PopoverPosition,
} from "./l10n-word-detail-popover-utils.js";
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

/**
 * Lightweight, framework-independent presentation for Lingop word details.
 * The fixed portal avoids clipping inside scroll containers and animated
 * page-like settings panels; consumers only pass their narrow language inputs.
 */
export function useL10nWordDetailPopover({
  guiLang,
  focusLang,
  className,
  offset = 8,
}: UseL10nWordDetailPopoverOptions): L10nWordDetailPopoverHandle {
  const anchorRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [l10nWordDetailData, setL10nWordDetailData] =
    useState<L10nWordDetailData | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const closeL10nWordDetail = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover || typeof window === "undefined") return;
    setPosition(
      getAnchoredPopoverPosition({
        anchor: anchor.getBoundingClientRect(),
        popover: popover.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        offset,
      }),
    );
  }, [offset]);

  const openL10nWordDetail = useCallback(
    (data: L10nWordDetailData, event?: MouseEvent<HTMLElement>) => {
      if (event) anchorRef.current = event.currentTarget;
      setL10nWordDetailData(data);
      setPosition(null);
      setOpen(true);
    },
    [],
  );

  const l10nWordDetailHandler = useCallback<L10nWordDetailHandler>(
    (l10nAText, l10nATextTokenIdx, event, wordSubMorphemes) => {
      const l10nWord = l10nAText.tokens[l10nATextTokenIdx]?.text;
      if (!l10nWord) return;

      const tappedAnchor = event.currentTarget;
      if (open && anchorRef.current === tappedAnchor) {
        closeL10nWordDetail();
        return;
      }
      anchorRef.current = tappedAnchor;
      setL10nWordDetailData({
        l10nWord,
        l10nLang: l10nAText.lang,
        l10nAText,
        l10nATextTokenIdx,
        wordSubMorphemes,
      });
      setPosition(null);
      setOpen(true);
    },
    [closeL10nWordDetail, open],
  );

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updatePosition);
    const reposition = () => updatePosition();
    const dismissOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        popoverRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      closeL10nWordDetail();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeL10nWordDetail();
      anchorRef.current?.focus();
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [closeL10nWordDetail, open, updatePosition]);

  const PopoverComponent =
    open && l10nWordDetailData && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            className={[
              "lingop-word-detail-popover",
              className,
            ].filter(Boolean).join(" ")}
            role="dialog"
            aria-label="Word details"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <button
              type="button"
              className="lingop-word-detail-popover__close"
              aria-label="Close"
              onClick={() => {
                closeL10nWordDetail();
                anchorRef.current?.focus();
              }}
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
          </div>,
          document.body,
        )
      : null;

  return {
    PopoverComponent,
    l10nWordDetailHandler,
    openL10nWordDetail,
    closeL10nWordDetail,
    open,
    l10nWordDetailData,
  };
}
