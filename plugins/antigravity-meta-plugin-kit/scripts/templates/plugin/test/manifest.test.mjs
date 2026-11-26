import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAYLOAD = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins",
  "{{name}}",
);

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test("plugin manifest is valid strict JSON with semver, kebab-case name, and existing logo", () => {
  const dotPath = join(PAYLOAD, ".antigravity-plugin", "plugin.json");
  const rootPath = join(PAYLOAD, "plugin.json");
  const manifestPath = existsSync(dotPath) ? dotPath : rootPath;
  assert.ok(existsSync(manifestPath), "plugin.json must exist");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.name, "{{name}}");
  assert.match(manifest.name, KEBAB_RE);
  assert.match(manifest.version, SEMVER_RE);
  assert.ok(manifest.logo, "logo should be declared");
  assert.ok(existsSync(join(PAYLOAD, manifest.logo)), `missing logo: ${manifest.logo}`);
  const hooksPath = join(PAYLOAD, "hooks.json");
  if (existsSync(hooksPath)) {
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    assert.ok(hooks && typeof hooks === "object" && !Array.isArray(hooks));
  }
});
