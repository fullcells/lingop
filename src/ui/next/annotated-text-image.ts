export type AnnotatedTextImageData = {
  dataUrl: string;
  width: number;
  height: number;
};

const horizontalPadding = 12;
const topPadding = 8;
const bottomPadding = 24;

export async function captureAnnotatedTextImage(
  element: HTMLElement,
  scale = 1,
): Promise<AnnotatedTextImageData> {
  const originalRect = element.getBoundingClientRect();
  const clone = element.cloneNode(true) as HTMLElement;

  // 20260822, updated 20260908: Retained from OmniAccess as an html2canvas crop
  // workaround, not as intended presentation spacing. The original 12px
  // horizontal/20px bottom safety margin was reduced during the port, after
  // which real exports showed clipped glosses and punctuation. Use a slightly
  // larger block margin because html2canvas's text bounds are less reliable
  // than the browser's painted bounds for several scripts and emoji fonts.
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
    // html2canvas can paint a line-height:1 gloss below the line box used for
    // flex wrapping. Give only the cloned export a safer line box so glosses do
    // not overlap the following row; the live browser layout remains unchanged.
    const html2canvas = (await import("html2canvas")).default as unknown as (
      element: HTMLElement,
      options: { scale: number; onclone: (clonedDocument: Document) => void },
    ) => Promise<HTMLCanvasElement>;
    const canvas = await html2canvas(clone, {
      scale,
      onclone(clonedDocument) {
        const style = clonedDocument.createElement("style");
        style.textContent = `
          .annotated-text-view .gloss-text-wrapper {
            line-height: 1.25 !important;
          }
        `;
        clonedDocument.head.appendChild(style);
      },
    });

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width / scale,
      height: canvas.height / scale,
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
