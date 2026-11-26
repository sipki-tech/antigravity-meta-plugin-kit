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

test("checkCommand denies destructive commands", () => {
  for (const cmd of [
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~/",
    "rm -rf $HOME",
    "git push --force",
    "git push origin main --force",
    "git push origin main -f",
  ]) {
    const res = checkCommand(cmd);
    assert.equal(res.decision, "deny", cmd);
    assert.match(res.reason, /example-guard/, cmd);
  }
});

test("checkCommand allows ordinary commands", () => {
  for (const cmd of [
    "ls -la",
    "rm -rf ./build",
    "rm -rf  ./build",
    "rm -f  tmp.log",
    "rm -rf ",
    "git push origin main --force-with-lease",
  ]) {
    assert.equal(checkCommand(cmd).decision, "allow", cmd);
  }
});

// Wire contract: JSON on stdin, JSON on stdout, exit 0 — always (fail-open).
test("e2e: guard responds over stdin/stdout and is fail-open on junk/empty stdin", () => {
  const run = (rawInput) => {
    const res = spawnSync(process.execPath, [join(SCRIPTS, "example-guard.mjs")], {
      input: rawInput,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(res.status, 0, `guard must exit 0; stderr: ${res.stderr}`);
    return JSON.parse(res.stdout);
  };
  assert.equal(
    run(JSON.stringify({ toolCall: { args: { CommandLine: "rm -rf /" } } })).decision,
    "deny",
  );
  assert.equal(run(JSON.stringify({ totally: "unexpected" })).decision, "allow");
  assert.equal(run("not valid json").decision, "allow");
  assert.equal(run("").decision, "allow");
});
