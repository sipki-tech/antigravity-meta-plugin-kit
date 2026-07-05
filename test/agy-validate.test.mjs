// Integration with the official validator: runs only where the `agy` CLI is
// installed (developer machines); CI runners skip it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffold } from "../lib/scaffold.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const which = spawnSync("which", ["agy"], { encoding: "utf8" });
const AGY = which.status === 0 ? which.stdout.trim() : null;

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function validate(payload) {
  const res = spawnSync(AGY, ["plugin", "validate", payload], {
    encoding: "utf8",
    timeout: 60000,
    env: { ...process.env, TERM: "dumb" },
  });
  return { status: res.status, out: stripAnsi(`${res.stdout}${res.stderr}`) };
}

test("agy plugin validate sees the scaffolded root hooks.json", (t) => {
  if (!AGY) return t.skip("agy not on PATH");
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-agy-"));
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  const { status, out } = validate(join(targetDir, "plugins", "demo-plugin"));
  assert.equal(status, 0, out);
  assert.match(out, /hooks\s*:\s*\d+ processed/, out);
  assert.doesNotMatch(out, /hooks\s*:\s*skipped/, out);
});

test("agy plugin validate counts the --with-agents subagent", (t) => {
  if (!AGY) return t.skip("agy not on PATH");
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-agy-"));
  const { targetDir } = scaffold({
    name: "demo-plugin",
    parentDir: parent,
    withAgents: true,
  });
  const { status, out } = validate(join(targetDir, "plugins", "demo-plugin"));
  assert.equal(status, 0, out);
  assert.match(out, /agents\s*:\s*1 processed/, out);
});

test("agy plugin validate: own payload [ok] with 5 skills and 4 agents", (t) => {
  if (!AGY) return t.skip("agy not on PATH");
  const { status, out } = validate(
    join(ROOT, "plugins", "antigravity-meta-plugin-kit"),
  );
  assert.equal(status, 0, out);
  assert.match(out, /\[ok\]/, out);
  assert.match(out, /skills\s*:\s*5 processed/, out);
  assert.match(out, /agents\s*:\s*4 processed/, out);
});

test("agy plugin validate: reference payload still [ok]", (t) => {
  if (!AGY) return t.skip("agy not on PATH");
  const ref =
    process.env.AGY_KIT_PAYLOAD ??
    join(ROOT, "..", "antigravity-kit", "plugins", "antigravity-kit");
  if (!existsSync(ref)) return t.skip("reference payload not found");
  const { status, out } = validate(ref);
  assert.equal(status, 0, out);
  assert.match(out, /\[ok\]/, out);
});
