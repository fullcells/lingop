import { describe, expect, it, vi } from "vitest";
import { createImageClient, createImageFileId, getImageFileURL, ImageRequestError } from "./images.js";

const id = "a53bd4f9-7793-4fdb-8f61-ddb7f3fcbf2b";
const file = { id, image_set_id: "cat", filename: "貓 #1.png", is_ai: true, attribution: { artist: "Painter", service: "openai" }, ai_meta: { prompt: "100% cat_name" }, created_at: "2026-10-10T00:00:00Z" };
const generation = { file_id: id, image_set_id: "cat", attribution: { artist: "Painter" }, prompt: "cat" };
function database(tables: Record<string, any[]>, cap = 1000) {
  const queries: { table: string; filters: [string, string, unknown][]; from: number; to: number }[] = [];
  let fail = false;
  const get = (row: any, column: string) => { const [field, key] = column.split("->>"); return key ? row[field!]?.[key] : row[field!]; };
  return { queries, fail: (value: boolean) => { fail = value; }, client: {
    from(table: string) { return { select() {
      const state = { table, filters: [] as [string, string, unknown][], from: 0, to: 499 };
      const query = {
        eq(key: string, value: unknown) { state.filters.push([key, "eq", value]); return query; },
        in(key: string, value: unknown[]) { state.filters.push([key, "in", value]); return query; },
        ilike(key: string, value: string) { state.filters.push([key, "ilike", value]); return query; },
        order() { return query; },
        range(from: number, to: number) { state.from = from; state.to = to; return query; },
        then(resolve: (value: any) => unknown, reject: (error: unknown) => unknown) {
          queries.push(state);
          const all = (tables[table] ?? []).filter(row => state.filters.every(([key, op, value]) => op === "ilike" || (op === "eq" ? get(row, key) === value : (value as unknown[]).includes(get(row, key)))));
          return Promise.resolve(fail ? { error: new Error("offline"), data: null } : { data: all.slice(state.from, Math.min(state.to + 1, state.from + cap)), count: all.length, error: null }).then(resolve, reject);
        },
      }; return query;
    } }; },
  } };
}
function stream(events: unknown[]) {
  const bytes = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join("\n") + "\n");
  return new Response(new ReadableStream({ start(controller) {
    // Fragment even Unicode and JSON tokens across network chunks.
    for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
    controller.close();
  } }), { headers: { "content-type": "application/x-ndjson" } });
}
describe("shared image client", () => {
  it("uses original.ext for each format and retains the uploaded filename in metadata", () => {
    expect(getImageFileURL(file)).toBe(`https://omnilingual-access.s3.us-east-1.amazonaws.com/images/camplingo/${id}/original.png`);
    for (const ext of ["PNG", "JPG", "jpeg", "webp", "gif"]) {
      expect(getImageFileURL({ ...file, filename: `貓 #1.${ext}` })).toContain(`/original.${ext.toLowerCase()}`);
    }
    expect(() => getImageFileURL({ id, filename: "../cat.png" })).toThrow();
    expect(() => getImageFileURL({ id, filename: "cat.svg" })).toThrow();
  });
  it("allocates unique UUIDv7 image request IDs with the current timestamp", () => {
    const start = Date.now();
    const ids = Array.from({ length: 100 }, createImageFileId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const timestamp = parseInt(id.replace(/-/g, "").slice(0, 12), 16);
      expect(timestamp).toBeGreaterThanOrEqual(start);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    }
  });
  it("batches exact language/word lookups, keeps senses, and pages below the requested row cap", async () => {
    const rows = Array.from({ length: 110 }, (_, i) => ({ id: String(i), ref: { type: "word", lang: "yue", word: `word${i}` } }));
    rows.push({ id: "sense", ref: { type: "word", lang: "yue", word: "word1" } });
    rows.push({ id: "wrong-language", ref: { type: "word", lang: "en", word: "word1" } });
    const db = database({ image_sets: rows }, 20);
    const client = createImageClient({ supabaseClient: db.client });
    const words = Array.from({ length: 110 }, (_, i) => `word${i}`);
    expect(await client.findWordImageSets("yue", [...words, "word1"])).toHaveLength(111);
    expect(db.queries.every(q => (q.filters.find(f => f[1] === "in")?.[2] as unknown[]).length <= 50)).toBe(true);
    const reads = db.queries.length;
    await client.findWordImageSets("yue", words);
    expect(db.queries).toHaveLength(reads);
    client.clearCache(); await client.findWordImageSets("yue", words);
    expect(db.queries.length).toBeGreaterThan(reads);
  });
  it("filters artist/service and escapes literal prompt searches", async () => {
    const db = database({ image_files: [file] });
    const client = createImageClient({ supabaseClient: db.client });
    expect(await client.getImageFiles(["cat"], { artist: "Painter", service: "openai" })).toEqual([file]);
    expect(await client.getImageFile(id)).toEqual(file);
    await client.searchImageFiles({ artist: "Painter", prompt: "100% cat_name" });
    expect(db.queries.at(-1)?.filters).toContainEqual(["ai_meta->>prompt", "ilike", "%100\\% cat\\_name%"]);
    await expect(client.searchImageFiles({ limit: 1001 })).rejects.toThrow();
  });
  it("does not retain failed reads and performs no reads for empty batches", async () => {
    const db = database({ image_sets: [] }); const client = createImageClient({ supabaseClient: db.client });
    expect(await client.getImageSets([])).toEqual([]); expect(db.queries).toHaveLength(0);
    db.fail(true); await expect(client.getImageSets(["cat"])).rejects.toThrow("offline");
    db.fail(false); expect(await client.getImageSets(["cat"])).toEqual([]); expect(db.queries).toHaveLength(2);
  });
  it("routes generation to the chosen backend, consumes heartbeats, and clears cached misses", async () => {
    const db = database({ image_files: [] });
    const fetchImpl = vi.fn(async (_url: any, init: any) => {
      expect(init.headers.Authorization).toBe("Bearer fixture"); expect(JSON.parse(init.body).file_id).toBe(id);
      return stream([{ type: "pending" }, { type: "heartbeat" }, { type: "complete", file }]);
    }) as typeof fetch;
    const client = createImageClient({ supabaseClient: db.client, fetchImpl, backendTarget: "staging" });
    await client.getImageFiles(["cat"]);
    expect(await client.generateImage(generation, { accessToken: "fixture", backendTarget: "gcloud-run" })).toEqual(file);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("lingoprocessor-v20-mnykwbetrq-uc.a.run.app/api/images/generate"), expect.anything());
    await client.getImageFiles(["cat"]); expect(db.queries).toHaveLength(2);
  });
  it("returns structured provider timeout errors without retrying", async () => {
    const fetchImpl = vi.fn(async () => stream([{ type: "error", error: "Timed out", code: "GENERATION_TIMEOUT", status: 504, uncertain: true }])) as typeof fetch;
    const client = createImageClient({ supabaseClient: database({}).client, fetchImpl });
    await expect(client.generateImage(generation, { accessToken: "fixture" })).rejects.toMatchObject({ code: "GENERATION_TIMEOUT", uncertain: true, fileId: id });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("treats a truncated stream as uncertain and recovers by ID without generation", async () => {
    const fetchImpl = vi.fn(async (url: any) => String(url).endsWith("/recover") ? Response.json({ status: "complete", file }) : stream([{ type: "heartbeat" }])) as typeof fetch;
    const client = createImageClient({ supabaseClient: database({}).client, fetchImpl });
    await expect(client.generateImage(generation, { accessToken: "fixture" })).rejects.toBeInstanceOf(ImageRequestError);
    expect(await client.recoverImage(id, { accessToken: "fixture" })).toEqual({ status: "complete", file });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("aborts after its deadline and exposes the file ID for recovery", async () => {
    const fetchImpl = vi.fn((_url: any, init: any) => new Promise<Response>((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
    const client = createImageClient({ supabaseClient: database({}).client, fetchImpl });
    await expect(client.generateImage(generation, { accessToken: "fixture", timeoutMs: 5 })).rejects.toMatchObject({ uncertain: true, fileId: id });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("uploads original local bytes and metadata through the selected backend", async () => {
    const fetchImpl = vi.fn(async (_url: any, init: any) => { const body = JSON.parse(init.body); expect(body.data_base64).toBe("YWJj"); expect(body.filename).toBe("original.png"); expect(body.file).toBeUndefined(); return Response.json(file); }) as typeof fetch;
    const client = createImageClient({ supabaseClient: database({}).client, fetchImpl });
    await client.uploadImageFile({ file_id: id, image_set_id: "cat", file: new Blob(["abc"]), filename: "original.png", is_ai: false, attribution: { artist: "Artist" } }, { accessToken: "fixture" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
