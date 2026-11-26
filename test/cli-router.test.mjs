import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const META_KIT = join(ROOT, "plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs");

test("meta-kit.mjs --help lists all four commands and rejects unknown commands", () => {
  const help = spawnSync(process.execPath, [META_KIT, "--help"], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(help.status, 0, help.stderr);
  for (const cmd of ["create", "lint", "probe", "doctor"]) {
    assert.match(help.stdout, new RegExp(`\\b${cmd}\\b`));
  }

  const bad = spawnSync(process.execPath, [META_KIT, "nope"], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown command/);
});

test("meta-kit.mjs routes lint, create --dry-run, and doctor --json cleanly", () => {
  const lint = spawnSync(process.execPath, [META_KIT, "lint", "--strict", "--json", ROOT], {
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  assert.equal(JSON.parse(lint.stdout).strictPass, true);

  const tmp = mkdtempSync(join(tmpdir(), "meta-kit-router-"));
  try {
    const create = spawnSync(
      process.execPath,
      [META_KIT, "create", "demo-router", "--with-cli", "--dry-run"],
      { encoding: "utf8", cwd: tmp, timeout: 15000 },
    );
    assert.equal(create.status, 0, create.stdout + create.stderr);
    assert.match(create.stdout, /auth\.json/);
    assert.match(create.stdout, /would create/);

    const doc = spawnSync(
      process.execPath,
      [META_KIT, "doctor", "--home", tmp, "--workspace", tmp, "--json"],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.equal(doc.status, 0, doc.stdout + doc.stderr);
    assert.equal(JSON.parse(doc.stdout).strictPass, true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
