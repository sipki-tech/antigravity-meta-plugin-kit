import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "plugins", "{{name}}", "scripts", "cli.mjs");

test("{{name}} CLI ping --json succeeds without credentials", () => {
  const res = spawnSync(process.execPath, [CLI, "ping", "--json"], {
    encoding: "utf8",
    env: { ...process.env, {{ENV_PREFIX}}_API_KEY: "" },
    timeout: 5000,
  });
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(res.stdout);
  assert.equal(data.ok, true);
  assert.equal(data.plugin, "{{name}}");
  assert.equal(data.authConfigured, false);
});

test("{{name}} CLI status reflects {{ENV_PREFIX}}_API_KEY presence", () => {
  const missing = spawnSync(process.execPath, [CLI, "status", "--json"], {
    encoding: "utf8",
    env: { ...process.env, {{ENV_PREFIX}}_API_KEY: "" },
    timeout: 5000,
  });
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).ok, false);

  const ok = spawnSync(process.execPath, [CLI, "status", "--json"], {
    encoding: "utf8",
    env: { ...process.env, {{ENV_PREFIX}}_API_KEY: "test-placeholder-token" },
    timeout: 5000,
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).authConfigured, true);
});
