import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const project = path.join(root, "projects/lingodex");
const require = createRequire(path.join(project, "package.json"));
const { config } = require("dotenv");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
config({ path: path.join(project, ".env"), quiet: true });
const client = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 2 });
const staging = "/tmp/lingodex-unused-archive-2026-11-16";
const plan = JSON.parse(await fs.readFile(path.join(root, "foundations/lingop/docs/image-names/supabase-import/_sources/archive-plan.json"), "utf8"));
let next = 0, complete = 0, reused = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  for (;;) {
    const index = next++;
    if (index >= plan.length) return;
    const obj = plan[index];
    const local = path.resolve(staging, obj.archive_path);
    if (!local.startsWith(staging + path.sep)) throw new Error("Invalid archive path");
    const receiptPath = local + ".metadata.json";
    let valid = false;
    try {
      const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
      const bytes = await fs.readFile(local);
      valid = receipt.key === obj.key && receipt.etag === obj.etag && bytes.length === obj.size
        && createHash("sha256").update(bytes).digest("hex") === receipt.sha256;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (valid) reused++;
    else {
      const response = await client.send(new GetObjectCommand({ Bucket: "designjams", Key: obj.key, IfMatch: obj.etag }));
      const bytes = await response.Body.transformToByteArray();
      if (bytes.length !== obj.size || response.ETag !== obj.etag) throw new Error(`Source changed: ${obj.key}`);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      await fs.mkdir(path.dirname(local), { recursive: true });
      await fs.writeFile(local + ".partial", bytes);
      await fs.rename(local + ".partial", local);
      await fs.writeFile(receiptPath, JSON.stringify({ key: obj.key, etag: obj.etag, sha256, bytes: bytes.length }));
    }
    complete++;
    if (complete % 50 === 0 || complete === plan.length) console.log(`Archived source downloads verified: ${complete}/${plan.length}`);
  }
}));
console.log(JSON.stringify({ images: complete, reused, staging }));
