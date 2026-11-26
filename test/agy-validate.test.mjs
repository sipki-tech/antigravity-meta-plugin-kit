// Integration with the official `agy plugin validate --strict --json` oracle.
// Runs automatically when `agy` is on PATH; CI runners without `agy` skip it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffold } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/scaffold.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGY_SHELL = process.platform === "win32";
const agyCheck = spawnSync("agy", ["--version"], {
  encoding: "utf8",
  timeout: 10000,
  shell: AGY_SHELL,
});
const HAS_AGY = agyCheck.status === 0;

const tempRoots = [];
test.after(() => {
  for (const d of tempRoots) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {}
  }
});

function validateStrictJson(payload) {
  const res = spawnSync("agy", ["plugin", "validate", "--strict", "--json", payload], {
    encoding: "utf8",
    timeout: 60000,
    shell: AGY_SHELL,
    env: { ...process.env, TERM: "dumb" },
  });
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {}
  return { status: res.status, parsed, raw: `${res.stdout}${res.stderr}` };
}

test("agy plugin validate --strict --json: own payload passes with 0 findings", (t) => {
  if (!HAS_AGY) return t.skip("agy not on PATH");
  const { status, parsed, raw } = validateStrictJson(
    join(ROOT, "plugins", "antigravity-meta-plugin-kit"),
  );
  assert.equal(status, 0, raw);
  assert.deepEqual(parsed.findings ?? [], [], raw);
  assert.equal(parsed.components.skills, 11, raw);
  assert.equal(parsed.components.agents, 3, raw);
  assert.equal(parsed.components.rules, 1, raw);
  assert.equal(parsed.components.hooks, 0, raw);
});

test("agy plugin validate --strict --json: default scaffold passes with 0 findings", (t) => {
  if (!HAS_AGY) return t.skip("agy not on PATH");
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-agy-"));
  tempRoots.push(parent);
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  const { status, parsed, raw } = validateStrictJson(join(targetDir, "plugins/demo-plugin"));
  assert.equal(status, 0, raw);
  assert.deepEqual(parsed.findings ?? [], [], raw);
  assert.equal(parsed.components.skills, 1);
  assert.equal(parsed.components.rules, 1);
  assert.equal(parsed.components.hooks, 1);
});

test("agy plugin validate --strict --json: --with-agents + --with-sidecar + dot-antigravity passes with 0 findings", (t) => {
  if (!HAS_AGY) return t.skip("agy not on PATH");
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-agy-"));
  tempRoots.push(parent);
  const { targetDir } = scaffold({
    name: "full-plugin",
    parentDir: parent,
    withAgents: true,
    withSidecar: true,
    manifestLayout: "dot-antigravity",
  });
  const { status, parsed, raw } = validateStrictJson(join(targetDir, "plugins/full-plugin"));
  assert.equal(status, 0, raw);
  assert.deepEqual(parsed.findings ?? [], [], raw);
  assert.equal(parsed.components.skills, 2);
  assert.equal(parsed.components.agents, 1);
  assert.equal(parsed.components.rules, 1);
  assert.equal(parsed.components.hooks, 1);
  assert.equal(parsed.components.sidecars, 1);
});

test("agy plugin validate --strict --json: --minimal scaffold passes with 0 findings", (t) => {
  if (!HAS_AGY) return t.skip("agy not on PATH");
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-agy-"));
  tempRoots.push(parent);
  const { targetDir } = scaffold({ name: "mini-plugin", parentDir: parent, minimal: true });
  const { status, parsed, raw } = validateStrictJson(join(targetDir, "plugins/mini-plugin"));
  assert.equal(status, 0, raw);
  assert.deepEqual(parsed.findings ?? [], [], raw);
  assert.equal(parsed.components.skills, 1);
  assert.equal(parsed.components.rules, 1);
  assert.equal(parsed.components.hooks, 0);
});

test("agy plugin validate --strict --json: --minimal --with-cli passes with 0 findings", (t) => {
  if (!HAS_AGY) return t.skip("agy not on PATH");
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-agy-"));
  tempRoots.push(parent);
  const { targetDir } = scaffold({
    name: "cli-plugin",
    parentDir: parent,
    minimal: true,
    withCli: true,
  });
  const { status, parsed, raw } = validateStrictJson(join(targetDir, "plugins/cli-plugin"));
  assert.equal(status, 0, raw);
  assert.deepEqual(parsed.findings ?? [], [], raw);
  assert.equal(parsed.components.skills, 2);
  assert.equal(parsed.components.rules, 1);
  assert.equal(parsed.components.hooks, 0);
});
