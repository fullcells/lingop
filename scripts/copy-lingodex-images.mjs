import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Frozen import inputs, conditional S3 writes, and durable receipts make reruns safe.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const inputDir = path.join(root, "foundations/lingop/docs/image-names/supabase-import");
const outputDir = path.join(inputDir, "s3-copy");
const project = path.join(root, "projects/lingodex");
const require = createRequire(path.join(project, "package.json"));
const { config } = require("dotenv");
const {
  S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand,
  GetBucketOwnershipControlsCommand, GetPublicAccessBlockCommand,
} = require("@aws-sdk/client-s3");
config({ path: path.join(project, ".env"), quiet: true });
const client = new S3Client({ region: "us-east-1", maxAttempts: 3 });
const args = process.argv.slice(2);
if (args.some((a, i) => !["--execute", "--preflight", "--limit"].includes(a) && args[i - 1] !== "--limit")) {
  throw new Error("Usage: copy-lingodex-images.mjs [--preflight | --execute [--limit N]]");
}
const execute = args.includes("--execute");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex < 0 ? Infinity : Number(args[limitIndex + 1]);
if (!(limit > 0 && (limit === Infinity || Number.isInteger(limit)))) throw new Error("Invalid limit");
const SOURCE_BUCKET = "designjams";
const DEST_BUCKET = "omnilingual-access";
const DEST_PREFIX = "images/camplingo/";
const SOURCE_PREFIXES = [
  "lingoframe-20240718/lingoframe-compressed-jpgs-v3/",
  "lingoframe-20240718/compressed-jpgs/",
];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const encodeKey = (key) => key.split("/").map((segment) => encodeURIComponent(segment)
  .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
const publicURL = (key) => `https://${DEST_BUCKET}.s3.us-east-1.amazonaws.com/${encodeKey(key)}`;
const send = (command) => client.send(command, { abortSignal: AbortSignal.timeout(45000) });
const missing = (error) => error.$metadata?.httpStatusCode === 404;
const writeJSON = async (name, data) => {
  const target = path.join(outputDir, name);
  await fs.writeFile(target + ".partial", JSON.stringify(data, null, 2) + "\n");
  await fs.rename(target + ".partial", target);
};
async function list(bucket, prefix) {
  const objects = [];
  let ContinuationToken;
  do {
    const page = await send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    for (const object of page.Contents ?? []) objects.push({ key: object.Key, size: object.Size, etag: object.ETag });
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

await fs.mkdir(outputDir, { recursive: true });
const reviewBytes = await fs.readFile(path.join(inputDir, "review.jsonl"));
const review = reviewBytes.toString("utf8").trim().split("\n").map((line) => JSON.parse(line));
const inventory = JSON.parse(await fs.readFile(path.join(inputDir, "_sources/s3-inventory.json"), "utf8"));
const frozenSources = new Map(inventory.flatMap((group) => group.objects.map((object) => [object.key, object])));
const jobs = review.map((row) => {
  if (row.source.bucket !== SOURCE_BUCKET || !SOURCE_PREFIXES.some((prefix) => row.source.key.startsWith(prefix))) {
    throw new Error("Source outside the authorized prefixes");
  }
  const destinationKey = `${DEST_PREFIX}${row.image_file_id}/original.jpg`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.image_file_id)
    || row.destination !== `s3://${DEST_BUCKET}/${destinationKey}`) throw new Error("Invalid destination");
  const source = frozenSources.get(row.source.key);
  if (!source || !/^"[0-9a-f]{32}"$/.test(source.etag) || source.size <= 0) throw new Error("Invalid frozen source");
  return {
    image_file_id: row.image_file_id, image_set_id: row.image_set_id,
    new_name: row.new_name, artist: row.source_artist,
    source_bucket: SOURCE_BUCKET, source_key: source.key, source_etag: source.etag,
    bytes: source.size, destination_bucket: DEST_BUCKET, destination_key: destinationKey,
    public_url: publicURL(destinationKey),
  };
});
if (jobs.length !== 3534 || new Set(jobs.map((job) => job.destination_key)).size !== jobs.length
  || new Set(jobs.map((job) => job.source_key)).size !== jobs.length) throw new Error("Unexpected or duplicate jobs");
const bytes = jobs.reduce((sum, job) => sum + job.bytes, 0);
if (bytes !== 300914594) throw new Error("Source byte count changed");
const plan = { version: 1, review_sha256: sha256(reviewBytes), jobs_sha256: sha256(JSON.stringify(jobs)), files: jobs.length, bytes, jobs };
try {
  const previous = JSON.parse(await fs.readFile(path.join(outputDir, "plan.json"), "utf8"));
  if (previous.jobs_sha256 !== plan.jobs_sha256 || previous.review_sha256 !== plan.review_sha256) {
    throw new Error("Saved plan differs; manual review required");
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
await writeJSON("plan.json", plan);

const [liveGroups, destinationObjects, ownership, publicAccess] = await Promise.all([
  Promise.all(SOURCE_PREFIXES.map((prefix) => list(SOURCE_BUCKET, prefix))),
  list(DEST_BUCKET, DEST_PREFIX),
  send(new GetBucketOwnershipControlsCommand({ Bucket: DEST_BUCKET })).catch((error) => {
    if (missing(error)) return {}; throw error;
  }),
  send(new GetPublicAccessBlockCommand({ Bucket: DEST_BUCKET })).catch((error) => {
    if (missing(error)) return {}; throw error;
  }),
]);
const liveSources = new Map(liveGroups.flat().map((object) => [object.key, object]));
for (const job of jobs) {
  const actual = liveSources.get(job.source_key);
  if (!actual || actual.size !== job.bytes || actual.etag !== job.source_etag) throw new Error(`Source changed: ${job.source_key}`);
}
const liveDestinations = new Map(destinationObjects.map((object) => [object.key, object]));
let alreadyPresent = 0;
for (const job of jobs) {
  const actual = liveDestinations.get(job.destination_key);
  if (actual) {
    if (actual.size !== job.bytes || actual.etag !== job.source_etag) throw new Error(`Conflicting destination: ${job.destination_key}`);
    alreadyPresent++;
  }
}
const ownerEnforced = ownership.OwnershipControls?.Rules?.some((rule) => rule.ObjectOwnership === "BucketOwnerEnforced") ?? false;
const block = publicAccess.PublicAccessBlockConfiguration ?? {};
if (!ownerEnforced && (block.BlockPublicAcls || block.IgnorePublicAcls)) {
  throw new Error("Bucket public-ACL settings need review before using the app's public-read convention");
}
const preflight = {
  checked_at: new Date().toISOString(), files: jobs.length, bytes,
  source_objects_unchanged: jobs.length, planned_destinations_present: alreadyPresent,
  existing_destination_objects: destinationObjects.filter((o) => !o.key.endsWith("/")).length,
  ownership: ownership.OwnershipControls ?? null, public_access_block: block,
  copy_acl: ownerEnforced ? "omitted: BucketOwnerEnforced" : "public-read",
};
await writeJSON("preflight.json", preflight);
try {
  await fs.writeFile(path.join(outputDir, "destination-baseline.json"), JSON.stringify({
    recorded_at: new Date().toISOString(), objects: destinationObjects,
  }, null, 2) + "\n", { flag: "wx" });
} catch (error) { if (error.code !== "EEXIST") throw error; }
console.log(JSON.stringify({ preflight }));
if (!execute) process.exit(0);

// Both conditions are checked on the serialized HTTP request before sending.
function protectedCopy(job) {
  const command = new CopyObjectCommand({
    Bucket: DEST_BUCKET, Key: job.destination_key,
    CopySource: encodeKey(`${SOURCE_BUCKET}/${job.source_key}`),
    CopySourceIfMatch: job.source_etag, IfNoneMatch: "*",
    ...(ownerEnforced ? {} : { ACL: "public-read" }),
    MetadataDirective: "COPY", TaggingDirective: "COPY", ChecksumAlgorithm: "SHA256",
  });
  command.middlewareStack.add((next) => async (args) => {
    const headers = Object.fromEntries(Object.entries(args.request.headers).map(([k, v]) => [k.toLowerCase(), v]));
    if (headers["if-none-match"] !== "*" || headers["x-amz-copy-source-if-match"] !== job.source_etag) {
      throw new Error("Conditional write headers missing; refusing to copy");
    }
    return next(args);
  }, { name: "assertConditionalCopy", step: "finalizeRequest", priority: "high" });
  return command;
}
async function publicRequest(job, method) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(job.public_url, { method, signal: AbortSignal.timeout(30000), redirect: "error" });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`Public ${method} returned ${response.status}: ${job.image_file_id}`);
      }
      if (Number(response.headers.get("content-length")) !== job.bytes || response.headers.get("etag") !== job.source_etag
        || !response.headers.get("content-type")?.toLowerCase().startsWith("image/jpeg")) {
        await response.body?.cancel();
        throw new Error(`Public ${method} metadata mismatch: ${job.image_file_id}`);
      }
      return response;
    } catch (error) { if (attempt >= 2) throw error; }
  }
}

const selected = jobs.slice(0, limit);
const started = new Date().toISOString();
let next = 0, completed = 0, copied = 0, reused = 0, failure;
let receiptWrites = Promise.resolve();
const verified = new Map();
async function processJob(job) {
  let copyResult;
  let action = "verified-existing";
  if (!liveDestinations.has(job.destination_key)) {
    try {
      const response = await send(protectedCopy(job));
      copyResult = response.CopyObjectResult;
      if (!copyResult || copyResult.ETag !== job.source_etag || !copyResult.ChecksumSHA256) {
        throw new Error(`Copy response mismatch: ${job.image_file_id}`);
      }
      action = "copied";
    } catch (error) {
      // A retry after a successful write can get 412. Verify bytes instead of overwriting.
      if (error.$metadata?.httpStatusCode !== 412) throw error;
    }
  }
  const head = await send(new HeadObjectCommand({ Bucket: DEST_BUCKET, Key: job.destination_key, ChecksumMode: "ENABLED" }));
  if (head.ContentLength !== job.bytes || head.ETag !== job.source_etag || !head.ChecksumSHA256
    || (copyResult && head.ChecksumSHA256 !== copyResult.ChecksumSHA256)
    || !head.ContentType?.toLowerCase().startsWith("image/jpeg")) {
    throw new Error(`Destination verification mismatch: ${job.image_file_id}`);
  }
  await publicRequest(job, "HEAD");
  const receipt = {
    verified_at: new Date().toISOString(), image_file_id: job.image_file_id, action,
    source_bucket: SOURCE_BUCKET, source_key: job.source_key, source_etag: job.source_etag,
    destination_bucket: DEST_BUCKET, destination_key: job.destination_key,
    bytes: job.bytes, etag: head.ETag, checksum_sha256_base64: head.ChecksumSHA256,
    content_type: head.ContentType, public_head_status: 200,
  };
  if (selected.length === 1) {
    const response = await publicRequest(job, "GET");
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length !== job.bytes || createHash("md5").update(body).digest("hex") !== job.source_etag.replaceAll('"', "")
      || createHash("sha256").update(body).digest("base64") !== head.ChecksumSHA256) {
      throw new Error("Canary public body checksum mismatch");
    }
    receipt.public_get_checksum_verified = true;
  }
  verified.set(job.destination_key, receipt);
  receiptWrites = receiptWrites.then(() => fs.appendFile(path.join(outputDir, "receipts.jsonl"), JSON.stringify(receipt) + "\n"));
  await receiptWrites;
  if (action === "copied") copied++; else reused++;
  completed++;
  if (completed % 100 === 0 || completed === selected.length) {
    console.log(JSON.stringify({ progress: `${completed}/${selected.length}`, copied, reused, bytes_verified: [...verified.values()].reduce((sum, r) => sum + r.bytes, 0) }));
  }
}
await Promise.all(Array.from({ length: Math.min(32, selected.length) }, async () => {
  while (!failure) {
    const job = selected[next++];
    if (!job) return;
    try { await processJob(job); }
    catch (error) { failure ??= { image_file_id: job.image_file_id, name: error.name, message: error.message }; }
  }
}));
await receiptWrites;
if (failure) {
  await writeJSON("last-run.json", { started_at: started, ended_at: new Date().toISOString(), completed, copied, reused, failure });
  throw new Error(`Stopped safely after ${completed} verified files: ${JSON.stringify(failure)}`);
}

const [finalDestination, finalSources] = await Promise.all([
  list(DEST_BUCKET, DEST_PREFIX),
  Promise.all(SOURCE_PREFIXES.map((prefix) => list(SOURCE_BUCKET, prefix))),
]);
const finalDestMap = new Map(finalDestination.map((o) => [o.key, o]));
const finalSourceMap = new Map(finalSources.flat().map((o) => [o.key, o]));
for (const job of selected) {
  const target = finalDestMap.get(job.destination_key);
  const source = finalSourceMap.get(job.source_key);
  if (!target || target.size !== job.bytes || target.etag !== job.source_etag
    || !source || source.size !== job.bytes || source.etag !== job.source_etag) {
    throw new Error(`Final inventory mismatch: ${job.image_file_id}`);
  }
}
const baseline = JSON.parse(await fs.readFile(path.join(outputDir, "destination-baseline.json"), "utf8"));
for (const before of baseline.objects) {
  const after = finalDestMap.get(before.key);
  if (!after || after.etag !== before.etag || after.size !== before.size) throw new Error(`Pre-existing object changed: ${before.key}`);
}
const report = {
  started_at: started, completed_at: new Date().toISOString(), status: "verified",
  scope: selected.length === jobs.length ? "complete-import" : "canary",
  files: completed, copied_this_run: copied, reused_this_run: reused,
  bytes: selected.reduce((sum, job) => sum + job.bytes, 0),
  artists: selected.reduce((counts, job) => ({ ...counts, [job.artist]: (counts[job.artist] ?? 0) + 1 }), {}),
  source_objects_unchanged: selected.length, pre_existing_destination_objects_unchanged: baseline.objects.length,
  native_sha256_verified: completed, matching_source_etags_and_sizes: completed, public_head_200: completed,
  destination_pattern: "s3://omnilingual-access/images/camplingo/<image_file_id>/original.jpg",
  review_sha256: plan.review_sha256, jobs_sha256: plan.jobs_sha256,
  supabase_import_digests_verified_before_copy: { sets: "8e53d9c4fa3b17a5430c3b9f4927c187", files: "f01c67071cda5e187916375f8d63a92e" },
};
await writeJSON(selected.length === jobs.length ? "report.json" : "canary-report.json", report);
console.log(JSON.stringify({ report }));
client.destroy();
