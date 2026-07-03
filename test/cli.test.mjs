import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "cli.mjs");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60000,
  });
}

test("--help exits 0 and prints usage", () => {
  const res = runCli(["--help"]);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Usage:/);
});

test("no command prints help and exits 1", () => {
  const res = runCli([]);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /Usage:/);
});

test("unknown command exits 1", () => {
  const res = runCli(["frobnicate"]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Unknown command/);
});

test("create with an invalid name exits 1 with a friendly error", () => {
  const tmp = mkdtempSync(join(tmpdir(), "meta-kit-cli-"));
  const res = runCli(["create", "Bad_Name"], tmp);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /kebab-case/);
  assert.doesNotMatch(res.stderr, /at .*\.mjs/, "no stack trace for user errors");
});

test("create --dry-run writes nothing", () => {
  const tmp = mkdtempSync(join(tmpdir(), "meta-kit-cli-"));
  const res = runCli(["create", "demo-plugin", "--dry-run"], tmp);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /would create/);
  assert.equal(existsSync(join(tmp, "demo-plugin")), false);
});

test("create then lint the repo root: all checks pass", () => {
  const tmp = mkdtempSync(join(tmpdir(), "meta-kit-cli-"));
  const created = runCli(["create", "demo-plugin"], tmp);
  assert.equal(created.status, 0, created.stderr);
  const linted = runCli(["lint", "demo-plugin"], tmp);
  assert.equal(linted.status, 0, linted.stdout + linted.stderr);
  assert.match(linted.stdout, /lint: all checks passed/);
  assert.doesNotMatch(linted.stdout, /^FAIL/m);
});

test("lint a broken payload exits 1 with a FAIL line", () => {
  const tmp = mkdtempSync(join(tmpdir(), "meta-kit-cli-"));
  runCli(["create", "demo-plugin"], tmp);
  const manifest = join(tmp, "demo-plugin", "plugins", "demo-plugin", "plugin.json");
  const data = JSON.parse(readFileSync(manifest, "utf8"));
  data.author = "someone";
  writeFileSync(manifest, JSON.stringify(data, null, 2));
  const res = runCli(["lint", "demo-plugin"], tmp);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /FAIL {2}author is an object/);
  assert.match(res.stdout, /lint: some checks failed/);
});

test("lint of a directory without a plugin exits 1 with a friendly error", () => {
  const tmp = mkdtempSync(join(tmpdir(), "meta-kit-cli-"));
  const res = runCli(["lint", "."], tmp);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no plugin\.json found/);
});
