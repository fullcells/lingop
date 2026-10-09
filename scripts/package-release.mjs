import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const output = resolve(root, "releases");
const stage = mkdtempSync(join(tmpdir(), "lingop-release-"));

try {
  for (const path of [...manifest.files, "README.md", "LICENSE"]) {
    if (!existsSync(join(root, path))) {
      if (path === "LICENSE") continue;
      throw new Error(`Missing release input: ${path}. Run npm run build first.`);
    }
    mkdirSync(dirname(join(stage, path)), { recursive: true });
    cpSync(join(root, path), join(stage, path), { recursive: true });
  }
  // Git consumers still need prepare. Only the prebuilt artifact loses build
  // scripts/dev dependencies; the source checkout is never modified here.
  delete manifest.scripts;
  delete manifest.devDependencies;
  writeFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const assertExports = (entry) => {
    if (typeof entry === "string") {
      if (!existsSync(join(stage, entry))) throw new Error(`Missing exported file: ${entry}`);
    } else {
      Object.values(entry).forEach(assertExports);
    }
  };
  assertExports(manifest.exports);
  for (const path of Object.values(manifest.bin)) {
    if (!existsSync(join(stage, path))) throw new Error(`Missing CLI: ${path}`);
  }
  mkdirSync(output, { recursive: true });
  const npmPath = process.env.npm_execpath;
  const args = ["pack", "--json", "--pack-destination", output];
  const result = execFileSync(npmPath ? process.execPath : "npm", npmPath ? [npmPath, ...args] : args, { cwd: stage, encoding: "utf8" });
  const [packed] = JSON.parse(result);
  console.log(`Built ${join(output, packed.filename)} (${packed.size} bytes, ${packed.entryCount} files).`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
