"use client";

import React, {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  arrow as floatingArrow,
  autoUpdate,
  flip,
  FloatingArrow,
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
  useTransitionStyles,
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
  showArrow?: boolean;
  arrowClassName?: string;
  arrowFill?: string;
  arrowStroke?: string;
  arrowStrokeWidth?: number;
  transitionDuration?: number | { open: number; close: number };
};

/**
 * Shared, unstyled shell for interactive content anchored to a DOM element.
 * Consumers own the trigger and presentation; this component owns collision-
 * aware positioning, portal rendering, dismissal, focus management, and any
 * explicitly enabled arrow or transition behavior.
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
  showArrow = false,
  arrowClassName,
  arrowFill,
  arrowStroke,
  arrowStrokeWidth,
  transitionDuration = 0,
}: AnchoredPopoverProps): ReactNode {
  const floatingId = useId();
  const arrowRef = useRef<SVGSVGElement>(null);
  const { context, floatingStyles, isPositioned, middlewareData, refs } =
    useFloating({
      middleware: [
        floatingOffset(offset),
        flip({ padding: viewportPadding }),
        shift({ padding: viewportPadding }),
        ...(showArrow ? [floatingArrow({ element: arrowRef })] : []),
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
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: transitionDuration,
    initial: { opacity: 0 },
    open: { opacity: 1 },
    close: { opacity: 0 },
  });

  useEffect(() => {
    // `elements.reference` is treated as the initial reference by Floating
    // UI's React root context. This popover can remain mounted during its exit
    // transition and then reopen for a different token, so keep the imperative
    // reference in sync as the consumer's anchor changes.
    refs.setReference(anchor);
  }, [anchor, refs]);

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

  // Keep the portal mounted for the closing duration; the popover's data and
  // anchor intentionally remain available while the fade completes.
  if (!isMounted || !anchor) return null;

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
        // Some modal libraries (e.g. ChakraUI) disable pointer events on the document body and
        // re-enable them only for their own content subtree. FloatingPortal is
        // intentionally outside that subtree, so restore hit testing here to
        // prevent clicks from passing through to the element underneath.
        pointerEvents: "auto",
        ...style,
        ...floatingStyles,
        ...transitionStyles,
        visibility:
          isPositioned && !middlewareData.hide?.referenceHidden
            ? "visible"
            : "hidden",
      }}
    >
      {showArrow && (
        <FloatingArrow
          ref={arrowRef}
          context={context}
          className={arrowClassName}
          fill={arrowFill}
          stroke={arrowStroke}
          strokeWidth={arrowStrokeWidth}
        />
      )}
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
