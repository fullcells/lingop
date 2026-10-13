import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageFile } from "../../core/images.js";

const context = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../../oat/react/index.js", () => ({ useOAT: () => ({ OAT: (text: string) => text }) }));
vi.mock("./lingop-client-data-provider.js", () => ({ useLingopClientData: () => ({ supabaseClient: context.db }) }));
import { WordDetailImages } from "./word-detail-images.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const views: ReactTestRenderer[] = [];
afterEach(async () => { for (const view of views.splice(0)) await act(async () => view.unmount()); });
const file = (id: string, extra: Partial<ImageFile> = {}): ImageFile => ({
  id, image_set_id: "food", filename: "food.webp", is_ai: true, is_archived: false,
  attribution: { artist: "Artist" }, ai_meta: null, created_at: "2026-10-13", ...extra,
});
const set = (lang = "yue", word = "蝦餃") => ({ id: "food", ref: { type: "word", lang, word } });

type Filter = [string, unknown];
function database(load: (table: string, filters: Filter[]) => Promise<unknown[]>) {
  const reads = vi.fn(load);
  return { reads, from(table: string) {
    const filters: Filter[] = [];
    const query = {
      select() { return query; }, eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      in(key: string, value: unknown) { filters.push([key, value]); return query; }, order() { return query; }, range() { return query; },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        return reads(table, filters).then(data => ({ data, error: null, count: data.length })).then(resolve, reject);
      },
    }; return query;
  } };
}
const dialogNodes: ReturnType<typeof mockDialog>[] = [];
function mockDialog() {
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  const node = {
    open: false,
    showModal: vi.fn(() => { node.open = true; }),
    close: vi.fn(() => { node.open = false; }),
    ownerDocument: { defaultView: {
      addEventListener: (name: string, listener: (event: KeyboardEvent) => void) => listeners.set(name, listener),
      removeEventListener: (name: string) => listeners.delete(name),
    } },
    listeners,
  };
  dialogNodes.push(node);
  return node;
}
async function mount(word = "蝦餃", lang = "yue") {
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<WordDetailImages word={word} lang={lang} />, { createNodeMock: element => element.type === "dialog" ? mockDialog() : null }); });
  views.push(view); return view;
}

describe("word-detail image sets", () => {
  it("reads the exact word/language, hides archives, and safely credits photographs", async () => {
    const db = database(async table => table === "image_sets" ? [set()] : [file("archived", { is_archived: true }), file("photo", {
      is_ai: false, attribution: { artist: "Photographer", source_url: "javascript:alert(1)", license: "CC BY 4.0", license_url: "https://example.org/license" },
    })]);
    context.db = db;
    const view = await mount();
    expect(db.reads.mock.calls[0]).toEqual(["image_sets", [["ref->>type", "word"], ["ref->>lang", "yue"], ["ref->>word", ["蝦餃"]]]]);
    expect(db.reads.mock.calls[1]).toEqual(["image_files", [["image_set_id", ["food"]], ["is_archived", false]]]);
    expect(view.root.findAllByType("img")).toHaveLength(1);
    expect(view.root.findByType("img").props.alt).toBe("蝦餃");
    expect(view.root.findByType("img").props.loading).toBe("lazy");
    expect(JSON.stringify(view.toJSON())).not.toContain("Photographer");
    expect(view.root.findAllByType("a")).toHaveLength(0);
    await act(async () => view.root.findByType("button").props.onClick());
    expect(view.root.findByType("dialog").props["aria-label"]).toBe("蝦餃");
    await act(async () => view.root.findByType("dialog").props.onClose({ currentTarget: { open: true } }));
    expect(view.root.findAllByType("dialog")).toHaveLength(1); // queued Strict Mode cleanup event
    expect(JSON.stringify(view.toJSON())).toContain("Photographer");
    expect(view.root.findAllByType("a").map(a => a.props.href)).toEqual(["https://example.org/license"]);
    await act(async () => view.root.findByType("dialog").props.onCancel());
    expect(view.root.findAllByType("dialog")).toHaveLength(0);
    expect(view.root.findAllByType("img")).toHaveLength(1);
  });

  it("handles image Escape before consumer document listeners and removes the listener on close", async () => {
    context.db = database(async table => table === "image_sets" ? [set()] : [file("photo")]);
    const view = await mount();
    await act(async () => view.root.findByType("button").props.onClick());
    const dialog = dialogNodes.at(-1)!;
    const event = { key: "Escape", composedPath: () => [dialog], preventDefault: vi.fn(), stopPropagation: vi.fn() };
    dialog.listeners.get("keydown")!(event as unknown as KeyboardEvent);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
    await act(async () => view.root.findByType("dialog").props.onClose({ currentTarget: dialog }));
    expect(view.root.findAllByType("dialog")).toHaveLength(0);
    expect(dialog.listeners.size).toBe(0);
  });

  it("renders nothing for absent, empty, archived-only, or unconfigured sets", async () => {
    for (const sets of [[], [set()]]) {
      const db = database(async table => table === "image_sets" ? sets : [file("old", { is_archived: true })]);
      context.db = db;
      expect((await mount()).toJSON()).toBeNull();
      expect(db.reads).toHaveBeenCalledTimes(sets.length ? 2 : 1);
    }
    context.db = database(async table => table === "image_sets" ? [set()] : []);
    expect((await mount()).toJSON()).toBeNull();
    context.db = undefined;
    expect((await mount()).toJSON()).toBeNull();
  });

  it("reuses the existing cache across openings and isolates different database clients", async () => {
    const db = database(async table => table === "image_sets" ? [set()] : [file("first")]);
    context.db = db;
    const first = await mount();
    await act(async () => first.unmount());
    views.splice(views.indexOf(first), 1);
    expect((await mount()).root.findAllByType("img")).toHaveLength(1);
    expect(db.reads).toHaveBeenCalledTimes(2);
    const other = database(async () => []);
    context.db = other;
    expect((await mount()).toJSON()).toBeNull();
    expect(other.reads).toHaveBeenCalledTimes(1);
  });

  it("ignores old responses when the language changes and avoids their file fetch", async () => {
    let release!: (rows: unknown[]) => void;
    const pending = new Promise<unknown[]>(resolve => { release = resolve; });
    const db = database(async (table, filters) => table === "image_sets"
      ? filters.some(([key, value]) => key === "ref->>lang" && value === "yue") ? pending : [set("ja", "蝦餃")]
      : [file("japanese")]);
    context.db = db;
    const view = await mount();
    await act(async () => view.update(<WordDetailImages word="蝦餃" lang="ja" />));
    await act(async () => release([set()]));
    expect(view.root.findByType("img").props.lang).toBe("ja");
    expect(db.reads).toHaveBeenCalledTimes(3);
    await act(async () => view.update(<WordDetailImages word="" lang="ja" />));
    expect(view.toJSON()).toBeNull();
  });

  it("omits malformed files and removes the strip when the remaining image fails", async () => {
    context.db = database(async table => table === "image_sets" ? [set()] : [file("bad", { filename: "../bad.png" }), file("good")]);
    const view = await mount();
    expect(view.root.findAllByType("img")).toHaveLength(1);
    expect(view.root.findAllByType("figcaption")).toHaveLength(0);
    await act(async () => view.root.findByType("img").props.onError());
    expect(view.toJSON()).toBeNull();
  });

  it("silently tolerates read failures and retries on reopening", async () => {
    let offline = true;
    context.db = database(async table => {
      if (offline) throw new Error("offline");
      return table === "image_sets" ? [set()] : [file("recovered")];
    });
    expect((await mount()).toJSON()).toBeNull();
    offline = false;
    expect((await mount()).root.findAllByType("img")).toHaveLength(1);
  });
});
