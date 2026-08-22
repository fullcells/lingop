export type AnnotatedTextImageData = {
  dataUrl: string;
  width: number;
  height: number;
};

const horizontalPadding = 2; // 12;
const topPadding = 2;
const bottomPadding = 2; //20;

export async function captureAnnotatedTextImage(
  element: HTMLElement,
  scale = 1,
): Promise<AnnotatedTextImageData> {
  const originalRect = element.getBoundingClientRect();
  const clone = element.cloneNode(true) as HTMLElement;

  // 20260822: Retained from OmniAccess as an html2canvas crop workaround, not
  // as intended presentation spacing. It adds enough white space to avoid
  // clipping text/glyph edges and can be removed if browser comparison proves
  // Lingop's plain DOM no longer needs it.
  clone.style.boxSizing = "content-box";
  clone.style.width = `${originalRect.width}px`;
  clone.style.maxWidth = "none";
  clone.style.padding = `${topPadding}px ${horizontalPadding}px ${bottomPadding}px`;
  clone.style.background = "white";
  clone.style.position = "fixed";
  clone.style.top = "-10000px";
  clone.style.left = "-10000px";
  clone.style.zIndex = "-9999";
  clone.scrollTop = 0;
  clone.scrollLeft = 0;
  document.body.appendChild(clone);

  try {
    // 20260822: OmniAccess injected the following html2canvas-only correction:
    // .tokens .token .gloss-emoji { transform: translateY(-6px); }
    // It likely compensated for Chakra or its former DOM/CSS. Lingop's plain
    // DOM port intentionally leaves this disabled unless visual testing proves
    // that html2canvas still needs the correction.
    const html2canvas = (await import("html2canvas")).default as unknown as (
      element: HTMLElement,
      options: { scale: number },
    ) => Promise<HTMLCanvasElement>;
    const canvas = await html2canvas(clone, { scale });

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: originalRect.width + horizontalPadding * 2,
      height: originalRect.height + topPadding + bottomPadding,
    };
  } finally {
    clone.remove();
  }
}

export function downloadAnnotatedTextImage(
  dataUrl: string,
  index: number,
  scale: number,
): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `annotated-${index + 1}@${scale}x.png`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}
