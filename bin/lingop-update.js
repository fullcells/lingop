#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY = "fullcells/lingop";
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HELP = `Update this project's lingop dependency from public GitHub Releases.

Usage: lingop-update [version] [--check]

Without a version, selects GitHub's latest stable release.
  lingop-update                 Install the latest stable release
  lingop-update 0.7.953         Install a specific release (also accepts v0.7.953)
  lingop-update --check         Show the release without changing files

Run from the consumer directory containing package.json and commit the updated
package.json and package-lock.json. No GitHub token is required.
`;

export function parseArgs(args) {
  let version;
  let check = false;
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--check") {
      check = true;
    } else if (!version && VERSION.test(arg.replace(/^v/, ""))) {
      version = arg.replace(/^v/, "");
    } else {
      throw new Error(`Unknown argument: ${arg}. Run lingop-update --help.`);
    }
  }
  return { version, check };
}

export function selectAsset(release, requestedVersion) {
  const version = release.tag_name?.replace(/^v/, "");
  if (!VERSION.test(version ?? "") || release.tag_name !== `v${version}` || release.draft || release.prerelease) {
    throw new Error("The selected release is not a published stable lingop version.");
  }
  if (requestedVersion && version !== requestedVersion) {
    throw new Error("The returned release does not match the requested version.");
  }
  const name = `lingop-${version}.tgz`;
  const url = `https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
  const asset = release.assets?.find((candidate) => candidate.name === name);
  if (!asset || asset.state !== "uploaded" || asset.size <= 0 || asset.browser_download_url !== url) {
    throw new Error(`Release v${version} has no valid ${name} asset. No files were changed.`);
  }
  return { version, url };
}

export async function getRelease(version, fetchImpl = fetch) {
  const endpoint = version ? `tags/v${version}` : "latest";
  const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/releases/${endpoint}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "lingop-update" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub refused the release lookup (possibly its anonymous API rate limit). Try again later; no files were changed.");
    }
    if (response.status === 404) throw new Error("No matching published lingop release was found. No files were changed.");
    throw new Error(`GitHub release lookup failed (HTTP ${response.status}). No files were changed.`);
  }
  return selectAsset(await response.json(), version);
}

export function dependencySection(manifest) {
  if (manifest.name === "lingop") throw new Error("Run lingop-update in a consumer project, not the lingop repository.");
  const sections = ["dependencies", "devDependencies", "optionalDependencies"].filter(
    (section) => Object.hasOwn(manifest[section] ?? {}, "lingop"),
  );
  if (sections.length !== 1) {
    throw new Error("Expected exactly one existing lingop dependency in this project's package.json.");
  }
  return sections[0];
}

export async function update(args, { cwd = process.cwd(), fetchImpl = fetch, run = spawnSync, log = console.log } = {}) {
  const options = parseArgs(args);
  if (options.help) return log(HELP);
  const manifest = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  const section = dependencySection(manifest);
  const release = await getRelease(options.version, fetchImpl);
  log(`lingop ${release.version}: ${release.url}`);
  if (options.check) return;
  const saveFlag = { dependencies: "--save-prod", devDependencies: "--save-dev", optionalDependencies: "--save-optional" }[section];
  // npm run supplies npm_execpath. Invoking it through Node also works on Windows
  // without a shell and keeps this updater independent of lingop runtime modules.
  const npmPath = process.env.npm_execpath;
  const installArgs = ["install", saveFlag, "--save-exact", "--package-lock=true", "--no-audit", "--no-fund", `lingop@${release.url}`];
  const command = npmPath ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
  const result = run(command, npmPath ? [npmPath, ...installArgs] : installArgs, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm install failed (${result.signal ?? result.status}). Review npm's output before retrying.`);
  log(`Installed lingop ${release.version}. Commit package.json and package-lock.json together.`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  update(process.argv.slice(2)).catch((error) => {
    console.error(`lingop-update: ${error.message}`);
    process.exitCode = 1;
  });
}
