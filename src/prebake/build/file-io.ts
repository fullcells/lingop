import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export function writePrebakeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function readPrebakeJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

