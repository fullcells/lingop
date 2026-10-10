import { getBEApiBaseUrl, type BackendTarget } from "./backend-api.js";
import { asSupabaseRuntimeClient, type SupabaseClientLike, type SupabaseQueryLike } from "./supabase.js";

export type ImageJSON = null | boolean | number | string | ImageJSON[] | { [key: string]: ImageJSON };
export type ImageRef = { type: string; [key: string]: ImageJSON };
export type ImageAttribution = { artist: string; service?: string; source_url?: string; [key: string]: ImageJSON | undefined };
export type ImageAIMeta = { prompt?: string; model?: string; usage?: ImageJSON; [key: string]: ImageJSON | undefined };
export interface ImageSet { id: string; ref: ImageRef; updated_at: string }
export interface ImageFile {
  id: string;
  image_set_id: string;
  filename: string;
  is_ai: boolean;
  attribution: ImageAttribution;
  ai_meta: ImageAIMeta | null;
  created_at: string;
}
export interface CreateImageSetInput { id: string; ref: ImageRef }
export interface UploadImageInput {
  /** Allocate once per intentional upload/generation. Retain it after a timeout. */
  file_id: string;
  image_set_id: string;
  filename: string;
  data_base64: string;
  is_ai: boolean;
  attribution: ImageAttribution;
  ai_meta?: ImageAIMeta | null;
}
export interface GenerateImageInput {
  file_id: string;
  image_set_id: string;
  attribution: ImageAttribution;
  prompt: string;
  model?: "gpt-image-2.5-sunburst" | "gpt-image-2.5-sunburst-2026-09-08" | "gpt-image-2.5-flare" | "gpt-image-2.5-flare-2026-09-08";
  quality?: "auto" | "low" | "medium" | "high" | "xhigh" | "max";
  size?: "auto" | "1024x1024" | "1536x1024" | "1024x1536";
  output_format?: "png" | "jpeg" | "webp";
}
export type ImageOperationStatus =
  | { status: "complete"; file: ImageFile }
  | { status: "not_found" | "pending" | "uncertain"; file_id: string };

export const IMAGE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_CLIENT_TIMEOUT_MS = 285_000;
const SET_COLUMNS = "id,ref,updated_at";
const FILE_COLUMNS = "id,image_set_id,filename,is_ai,attribution,ai_meta,created_at";

export function getImageFileURL(file: Pick<ImageFile, "id" | "filename">): string {
  if (!file.filename || /[\\/\u0000-\u001f\u007f]/u.test(file.filename) || [".", ".."].includes(file.filename)) {
    throw new Error("Expected an original filename without a directory.");
  }
  return `https://omnilingual-access.s3.us-east-1.amazonaws.com/images/camplingo/${encodeURIComponent(file.id)}/${encodeURIComponent(file.filename)}`;
}

export class ImageRequestError extends Error {
  constructor(message: string, readonly code: string, readonly status: number, readonly fileId?: string, readonly uncertain = false) {
    super(message);
    this.name = "ImageRequestError";
  }
}

export interface ImageRequestOptions {
  accessToken: string;
  backendTarget?: BackendTarget;
  signal?: AbortSignal;
  /** Lower values are useful for tests; normal generation needs several minutes. */
  timeoutMs?: number;
}
export interface ImageClientOptions {
  supabaseClient: SupabaseClientLike;
  fetchImpl?: typeof fetch;
  backendTarget?: BackendTarget;
  cacheTtlMs?: number;
}

/** Public reads use Supabase; all mutations use the admin-authorized backend. */
export function createImageClient(options: ImageClientOptions) {
  const db = asSupabaseRuntimeClient(options.supabaseClient);
  if (!db) throw new Error("A Supabase client is required.");
  const requestFetch = options.fetchImpl ?? globalThis.fetch;
  const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
  function clearCache() { cache.clear(); }
  function cached<T>(key: string, read: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
    const value = read().catch(error => { if (cache.get(key)?.value === value) cache.delete(key); throw error; });
    cache.set(key, { expires: Date.now() + (options.cacheTtlMs ?? 30_000), value });
    return value;
  }
  async function pages<T>(query: () => SupabaseQueryLike): Promise<T[]> {
    const result: T[] = [];
    // Exact counts handle projects whose row cap is smaller than our page size.
    for (let offset = 0; ; ) {
      const response = await query().order("id").range(offset, offset + 499);
      if (response.error) throw response.error;
      if (!Array.isArray(response.data)) throw new Error("Invalid image query response.");
      result.push(...response.data as T[]);
      offset += response.data.length;
      if (response.count != null && offset >= response.count) return result;
      if (!response.data.length) {
        if (response.count != null && offset < response.count) throw new Error("Image query returned an incomplete page.");
        return result;
      }
      if (response.count == null && response.data.length < 500) return result;
    }
  }
  async function request<T>(route: string, body: object, config: ImageRequestOptions, fileId?: string): Promise<T> {
    if (!config.accessToken) throw new Error("An admin access token is required.");
    const controller = new AbortController();
    const abort = () => controller.abort(config.signal?.reason);
    if (config.signal?.aborted) abort();
    config.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? IMAGE_CLIENT_TIMEOUT_MS);
    try {
      const target = config.backendTarget ?? options.backendTarget;
      const base = getBEApiBaseUrl(target ? { backendTarget: target } : {});
      const response = await requestFetch(`${base}/api/images/${route}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken}` },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const unwrap = (payload: any): T => {
        if (!response.ok || payload?.type === "error" || payload?.error) {
          throw new ImageRequestError(payload?.error ?? `Image request failed (${response.status}).`, payload?.code ?? "REQUEST_FAILED",
            payload?.status ?? response.status, fileId, payload?.uncertain === true || response.status >= 500);
        }
        return payload as T;
      };
      if (response.headers.get("content-type")?.includes("application/x-ndjson")) {
        if (!response.body) throw new Error("Missing generation response stream.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        try {
          for (;;) {
            const { value, done } = await reader.read();
            pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
            const lines = pending.split("\n");
            pending = lines.pop() ?? "";
            if (done && pending.trim()) lines.push(pending);
            for (const line of lines) {
              if (!line.trim()) continue;
              const event = JSON.parse(line);
              if (event.type === "error") unwrap(event);
              if (event.type === "complete") return unwrap(event.file);
            }
            if (done) throw new Error("Generation connection ended before its result arrived.");
          }
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      }
      return unwrap(await response.json());
    } catch (error) {
      if (error instanceof ImageRequestError) throw error;
      throw new ImageRequestError("The image request was interrupted. Check its status before starting another generation.",
        "CONNECTION_UNCERTAIN", 0, fileId, true);
    } finally { clearTimeout(timer); config.signal?.removeEventListener("abort", abort); }
  }
  const client = {
    clearCache,
    async getImageFile(id: string): Promise<ImageFile | null> {
      return cached(`file:${id}`, async () => (await pages<ImageFile>(() => db.from("image_files").select(FILE_COLUMNS, { count: "exact" }).eq("id", id)))[0] ?? null);
    },
    /** Exact artist/service filters; prompt is a literal substring, not a SQL pattern. */
    async searchImageFiles(filters: { artist?: string; service?: string; prompt?: string; imageSetId?: string; offset?: number; limit?: number } = {}): Promise<{ files: ImageFile[]; count: number | null }> {
      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid image search pagination.");
      let query = db.from("image_files").select(FILE_COLUMNS, { count: "exact" });
      if (filters.imageSetId !== undefined) query = query.eq("image_set_id", filters.imageSetId);
      if (filters.artist !== undefined) query = query.eq("attribution->>artist", filters.artist);
      if (filters.service !== undefined) query = query.eq("attribution->>service", filters.service);
      if (filters.prompt !== undefined) query = query.ilike("ai_meta->>prompt", `%${filters.prompt.replace(/[\\%_]/g, "\\$&")}%`);
      const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + limit - 1);
      if (error) throw error;
      return { files: data as ImageFile[], count: count ?? null };
    },
    async getImageSets(ids: readonly string[]): Promise<ImageSet[]> {
      const keys = [...new Set(ids)].sort();
      return cached(`sets:${JSON.stringify(keys)}`, async () => {
        const result: ImageSet[] = [];
        for (let i = 0; i < keys.length; i += 50) result.push(...await pages<ImageSet>(() => db.from("image_sets").select(SET_COLUMNS, { count: "exact" }).in("id", keys.slice(i, i + 50))));
        return result;
      });
    },
    async findWordImageSets(lang: string, words: readonly string[]): Promise<ImageSet[]> {
      const keys = [...new Set(words)].sort();
      return cached(`words:${JSON.stringify([lang, keys])}`, async () => {
        const result: ImageSet[] = [];
        // Exact text: no lowercasing, translation, or homonym/sense guessing.
        for (let i = 0; i < keys.length; i += 50) result.push(...await pages<ImageSet>(() => db.from("image_sets").select(SET_COLUMNS, { count: "exact" })
          .eq("ref->>type", "word").eq("ref->>lang", lang).in("ref->>word", keys.slice(i, i + 50))));
        return result;
      });
    },
    async getImageFiles(setIds: readonly string[], filters: { artist?: string; service?: string } = {}): Promise<ImageFile[]> {
      const keys = [...new Set(setIds)].sort();
      return cached(`files:${JSON.stringify([keys, filters.artist, filters.service])}`, async () => {
        const result: ImageFile[] = [];
        for (let i = 0; i < keys.length; i += 50) result.push(...await pages<ImageFile>(() => {
          let query = db.from("image_files").select(FILE_COLUMNS, { count: "exact" }).in("image_set_id", keys.slice(i, i + 50));
          if (filters.artist !== undefined) query = query.eq("attribution->>artist", filters.artist);
          if (filters.service !== undefined) query = query.eq("attribution->>service", filters.service);
          return query;
        }));
        return result;
      });
    },
    async createImageSet(input: CreateImageSetInput, config: ImageRequestOptions): Promise<ImageSet> {
      try { return await request<ImageSet>("sets", input, config); } finally { clearCache(); }
    },
    async uploadImage(input: UploadImageInput, config: ImageRequestOptions): Promise<ImageFile> {
      try { return await request<ImageFile>("upload", input, config, input.file_id); } finally { clearCache(); }
    },
    async uploadImageFile(input: Omit<UploadImageInput, "data_base64"> & { file: Blob }, config: ImageRequestOptions): Promise<ImageFile> {
      if (input.file.size > IMAGE_MAX_UPLOAD_BYTES) throw new Error("Images must be at most 10 MiB.");
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const { file: _, ...metadata } = input;
      return client.uploadImage({ ...metadata, data_base64: btoa(binary) }, config);
    },
    async generateImage(input: GenerateImageInput, config: ImageRequestOptions): Promise<ImageFile> {
      try { return await request<ImageFile>("generate", input, config, input.file_id); } finally { clearCache(); }
    },
    /** Does not generate. May finish saving metadata for an already uploaded result. */
    async recoverImage(fileId: string, config: ImageRequestOptions): Promise<ImageOperationStatus> {
      try { return await request<ImageOperationStatus>("recover", { file_id: fileId }, config, fileId); } finally { clearCache(); }
    },
  };
  return client;
}
