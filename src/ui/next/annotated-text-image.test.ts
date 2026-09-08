import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureAnnotatedTextImage,
  downloadAnnotatedTextImage,
} from "./annotated-text-image.js";

const { html2canvas } = vi.hoisted(() => ({
  html2canvas: vi.fn(),
}));

vi.mock("html2canvas", () => ({ default: html2canvas }));

afterEach(() => {
  html2canvas.mockReset();
  vi.unstubAllGlobals();
});

describe("annotated text image export", () => {
  it("captures a padded clone and always removes it", async () => {
    const clone = {
      style: {},
      scrollLeft: 4,
      scrollTop: 5,
      remove: vi.fn(),
    } as unknown as HTMLElement;
    const element = {
      cloneNode: vi.fn(() => clone),
      getBoundingClientRect: vi.fn(() => ({ width: 100, height: 40 })),
    } as unknown as HTMLElement;
    const appendChild = vi.fn();
    vi.stubGlobal("document", { body: { appendChild } });
    html2canvas.mockResolvedValue({
      width: 248,
      height: 144,
      toDataURL: vi.fn(() => "data:image/png;base64,test"),
    });

    await expect(captureAnnotatedTextImage(element, 2)).resolves.toMatchObject({
      dataUrl: "data:image/png;base64,test",
      width: 124,
      height: 72,
    });
    expect(appendChild).toHaveBeenCalledWith(clone);
    expect(clone.style).toMatchObject({
      background: "white",
      width: "100px",
      padding: "8px 12px 24px",
    });
    expect(html2canvas).toHaveBeenCalledWith(
      clone,
      expect.objectContaining({ scale: 2, onclone: expect.any(Function) }),
    );
    const onclone = html2canvas.mock.calls[0]?.[1]?.onclone as
      | ((clonedDocument: Document) => void)
      | undefined;
    const style = { textContent: "" };
    const appendStyle = vi.fn();
    onclone?.({
      createElement: vi.fn(() => style),
      head: { appendChild: appendStyle },
    } as unknown as Document);
    expect(style.textContent).toContain("line-height: 1.25");
    expect(appendStyle).toHaveBeenCalledWith(style);
    expect(clone.remove).toHaveBeenCalledOnce();
  });

  it("downloads using OmniAccess's one-based filename", () => {
    const link = { click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    vi.stubGlobal("document", {
      body: { appendChild },
      createElement: vi.fn(() => link),
    });

    downloadAnnotatedTextImage("data:image/png;base64,test", 1, 4);

    expect(link).toMatchObject({
      href: "data:image/png;base64,test",
      download: "annotated-2@4x.png",
    });
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
  });
});
