export type PopoverRectangle = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export type PopoverPosition = { left: number; top: number };

/** Positions a fixed popover below its anchor, or above when space is tighter. */
export function getAnchoredPopoverPosition({
  anchor,
  popover,
  viewportWidth,
  viewportHeight,
  offset = 8,
  viewportPadding = 8,
}: {
  anchor: PopoverRectangle;
  popover: Pick<PopoverRectangle, "width" | "height">;
  viewportWidth: number;
  viewportHeight: number;
  offset?: number;
  viewportPadding?: number;
}): PopoverPosition {
  const maximumLeft = Math.max(
    viewportPadding,
    viewportWidth - popover.width - viewportPadding,
  );
  const left = Math.min(maximumLeft, Math.max(viewportPadding, anchor.left));
  const belowTop = anchor.bottom + offset;
  const aboveTop = anchor.top - offset - popover.height;
  const fitsBelow = belowTop + popover.height <= viewportHeight - viewportPadding;
  const top = fitsBelow
    ? belowTop
    : Math.max(
        viewportPadding,
        Math.min(aboveTop, viewportHeight - popover.height - viewportPadding),
      );

  return { left, top };
}
