import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const consumer = mkdtempSync(join(tmpdir(), "lingop-smoke-"));
try {
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "lingop-release-smoke", private: true, type: "module", scripts: { "update:lingop": "lingop-update" } }));
  const npmPath = process.env.npm_execpath;
  const npm = (args) => execFileSync(npmPath ? process.execPath : "npm", npmPath ? [npmPath, ...args] : args, { cwd: consumer, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  // Do not disable lifecycle scripts: this verifies the shipped artifact needs
  // neither a source build nor its build-time dependencies during installation.
  console.log(npm(["install", "--no-audit", "--no-fund", join(root, "releases", `lingop-${version}.tgz`)]));
  const installed = join(consumer, "node_modules", "lingop");
  const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  assert.equal(pkg.version, version);
  assert.equal(pkg.scripts, undefined);
  assert.equal(pkg.devDependencies, undefined);
  const assertPaths = (entry) => {
    if (typeof entry === "string") assert.ok(existsSync(join(installed, entry)), `Missing ${entry}`);
    else Object.values(entry).forEach(assertPaths);
  };
  assertPaths(pkg.exports);
  assertPaths(pkg.bin);
  console.log(npm(["run", "update:lingop", "--", "--help"]));
  execFileSync(process.execPath, ["--input-type=module", "-e", 'await import("lingop/utils/string"); await import("lingop/stroke-order"); await import("lingop/content/lingodex"); const images = await import("lingop/images"); if (typeof images.createImageClient !== "function") throw new Error("Missing image client export");'], { cwd: consumer, stdio: "inherit" });
  console.log("Prebuilt package installation, exports, and updater smoke checks passed.");
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
