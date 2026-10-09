import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { dependencySection, getRelease, parseArgs, selectAsset, update } from "../bin/lingop-update.js";

const version = "0.7.953";
const url = `https://github.com/fullcells/lingop/releases/download/v${version}/lingop-${version}.tgz`;
const release = {
  tag_name: `v${version}`, draft: false, prerelease: false,
  assets: [{ name: `lingop-${version}.tgz`, state: "uploaded", size: 123, browser_download_url: url }],
};
const okFetch = async () => ({ ok: true, json: async () => release });

test("supports latest, explicit stable versions, and read-only checks", () => {
  assert.deepEqual(parseArgs([]), { version: undefined, check: false });
  assert.deepEqual(parseArgs([`v${version}`, "--check"]), { version, check: true });
  for (const args of [["--force"], ["../main"], ["1.0.0-beta.1"], [version, "1.0.0"]]) {
    assert.throws(() => parseArgs(args), /Unknown argument/);
  }
});

test("only accepts uploaded versioned assets in the expected repository", () => {
  assert.deepEqual(selectAsset(release), { version, url });
  for (const change of [{ draft: true }, { prerelease: true }, { tag_name: "main" }, { assets: [] }, {
    assets: [{ ...release.assets[0], browser_download_url: "https://example.com/lingop.tgz" }],
  }, { assets: [{ ...release.assets[0], state: "new" }] }]) {
    assert.throws(() => selectAsset({ ...release, ...change }));
  }
  assert.throws(() => selectAsset(release, "1.0.0"), /does not match/);
});

test("looks up public releases anonymously and reports lookup errors", async () => {
  await getRelease(version, async (endpoint, options) => {
    assert.equal(endpoint, `https://api.github.com/repos/fullcells/lingop/releases/tags/v${version}`);
    assert.equal(options.headers.Authorization, undefined);
    return okFetch();
  });
  await getRelease(undefined, async (endpoint) => {
    assert.ok(endpoint.endsWith("/latest"));
    return okFetch();
  });
  for (const status of [403, 404, 429, 500]) {
    await assert.rejects(getRelease(undefined, async () => ({ ok: false, status })), /No files were changed|no files were changed/);
  }
});

test("rejects non-consumers and ambiguous dependency sections", () => {
  assert.throws(() => dependencySection({ name: "lingop" }), /consumer/);
  assert.throws(() => dependencySection({ name: "app" }), /exactly one/);
  assert.throws(() => dependencySection({ dependencies: { lingop: "x" }, devDependencies: { lingop: "y" } }), /exactly one/);
});

test("check and failed discovery leave consumer files unchanged and never install", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "lingop-update-check-"));
  const original = JSON.stringify({ name: "app", dependencies: { lingop: "github:fullcells/lingop" } });
  writeFileSync(join(cwd, "package.json"), original);
  const run = () => assert.fail("must not install");
  try {
    await update(["--check"], { cwd, fetchImpl: okFetch, run, log: () => {} });
    await assert.rejects(update([], { cwd, fetchImpl: async () => ({ ok: true, json: async () => ({ ...release, assets: [] }) }), run, log: () => {} }));
    assert.equal(readFileSync(join(cwd, "package.json"), "utf8"), original);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("installs the exact archive, preserves dependency type, and propagates npm failure", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "lingop-update-install-"));
  try {
    for (const [section, flag] of [["dependencies", "--save-prod"], ["devDependencies", "--save-dev"], ["optionalDependencies", "--save-optional"]]) {
      writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "app", [section]: { lingop: "github:fullcells/lingop" } }));
      let calls = 0;
      await update([], { cwd, fetchImpl: okFetch, log: () => {}, run: (command, args, options) => {
        calls++;
        assert.ok(args.includes(flag));
        assert.ok(args.includes("--package-lock=true"));
        assert.equal(args.at(-1), `lingop@${url}`);
        assert.equal(options.cwd, cwd);
        assert.equal(options.shell, undefined);
        return { status: 0 };
      } });
      assert.equal(calls, 1);
    }
    await assert.rejects(update([], { cwd, fetchImpl: okFetch, log: () => {}, run: () => ({ status: 1 }) }), /npm install failed/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
