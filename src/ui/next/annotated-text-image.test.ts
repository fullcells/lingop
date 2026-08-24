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
      toDataURL: vi.fn(() => "data:image/png;base64,test"),
    });

    await expect(captureAnnotatedTextImage(element, 2)).resolves.toMatchObject({
      dataUrl: "data:image/png;base64,test",
    });
    expect(appendChild).toHaveBeenCalledWith(clone);
    expect(clone.style).toMatchObject({
      background: "white",
      width: "100px",
    });
    expect(html2canvas).toHaveBeenCalledWith(clone, { scale: 2 });
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
