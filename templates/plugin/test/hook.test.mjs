import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCommand } from "../plugins/{{name}}/scripts/example-guard.mjs";

const SCRIPTS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins",
  "{{name}}",
  "scripts",
);

test("checkCommand denies destructive commands (both dialects)", () => {
  const res = checkCommand("rm -rf /");
  assert.equal(res.decision, "deny");
  assert.match(res.reason, /example-guard/);
  // Legacy keys kept for pre-2026-07 builds; drop in 0.3.0.
  assert.equal(res.allow_tool, false);
  assert.equal(res.deny_reason, res.reason);
});

test("checkCommand allows ordinary commands", () => {
  assert.equal(checkCommand("ls -la").decision, "allow");
  assert.equal(checkCommand("rm -rf ./build").decision, "allow");
});

// The wire contract: JSON on stdin, JSON on stdout, exit 0 — always.
test("e2e: guard responds over stdin/stdout and is fail-open on junk", () => {
  const run = (input) => {
    const res = spawnSync(process.execPath, [join(SCRIPTS, "example-guard.mjs")], {
      input: JSON.stringify(input),
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(res.status, 0, `guard must exit 0; stderr: ${res.stderr}`);
    return JSON.parse(res.stdout);
  };
  const denied = run({ toolCall: { args: { CommandLine: "rm -rf /" } } });
  assert.equal(denied.decision, "deny");
  assert.equal(denied.allow_tool, false);
  const junk = run({ totally: "unexpected" });
  assert.equal(junk.decision, "allow");
  assert.equal(junk.allow_tool, true);
});
