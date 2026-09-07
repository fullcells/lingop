"use client";

import React, {
  useEffect,
  useId,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  hide,
  offset as floatingOffset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";

export type AnchoredPopoverProps = {
  anchor: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  style?: CSSProperties;
  placement?: Placement;
  offset?: number;
  viewportPadding?: number;
  modal?: boolean;
  manageFocus?: boolean;
};

/**
 * Shared, unstyled shell for interactive content anchored to a DOM element.
 * Consumers own the trigger and presentation; this component owns collision-
 * aware positioning, portal rendering, dismissal, and focus management.
 */
export function AnchoredPopover({
  anchor,
  open,
  onOpenChange,
  children,
  ariaLabel,
  ariaLabelledBy,
  className,
  style,
  placement = "bottom-start",
  offset = 8,
  viewportPadding = 8,
  modal = false,
  manageFocus = true,
}: AnchoredPopoverProps): ReactNode {
  const floatingId = useId();
  const { context, floatingStyles, isPositioned, middlewareData, refs } =
    useFloating({
      elements: { reference: anchor },
      middleware: [
        floatingOffset(offset),
        flip({ padding: viewportPadding }),
        shift({ padding: viewportPadding }),
        size({
          padding: viewportPadding,
          apply({ availableHeight, availableWidth, elements }) {
            elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
            elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
          },
        }),
        hide(),
      ],
      onOpenChange,
      open,
      placement,
      strategy: "fixed",
      whileElementsMounted: autoUpdate,
    });
  const dismiss = useDismiss(context, { outsidePressEvent: "pointerdown" });
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  // The anchor can live deep inside a consumer-owned component, so it cannot
  // receive Floating UI's React prop getter directly. Keep the essential ARIA
  // relationship synchronized without taking ownership of the trigger.
  useEffect(() => {
    if (!anchor) return;
    const previousControls = anchor.getAttribute("aria-controls");
    const previousExpanded = anchor.getAttribute("aria-expanded");
    const previousHasPopup = anchor.getAttribute("aria-haspopup");
    anchor.setAttribute("aria-controls", floatingId);
    anchor.setAttribute("aria-expanded", String(open));
    anchor.setAttribute("aria-haspopup", "dialog");
    return () => {
      restoreAttribute(anchor, "aria-controls", previousControls);
      restoreAttribute(anchor, "aria-expanded", previousExpanded);
      restoreAttribute(anchor, "aria-haspopup", previousHasPopup);
    };
  }, [anchor, floatingId, open]);

  if (!open || !anchor) return null;

  const floatingElement = (
    <div
      {...getFloatingProps({
        id: floatingId,
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
      })}
      ref={refs.setFloating}
      className={className}
      style={{
        ...style,
        ...floatingStyles,
        visibility:
          isPositioned && !middlewareData.hide?.referenceHidden
            ? "visible"
            : "hidden",
      }}
    >
      {children}
    </div>
  );

  return (
    <FloatingPortal>
      {manageFocus ? (
        <FloatingFocusManager
          context={context}
          modal={modal}
          returnFocus
        >
          {floatingElement}
        </FloatingFocusManager>
      ) : (
        floatingElement
      )}
    </FloatingPortal>
  );
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  previousValue: string | null,
) {
  if (previousValue === null) element.removeAttribute(name);
  else element.setAttribute(name, previousValue);
}
