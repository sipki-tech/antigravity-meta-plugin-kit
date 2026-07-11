import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lintPlugin, hasTrigger } from "../lib/lint.mjs";
import { parseFrontmatter } from "../lib/frontmatter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The reference payload the lint rules are calibrated against. CI clones it
// and points AGY_KIT_PAYLOAD here; locally the sibling checkout is used.
const REFERENCE_PAYLOAD =
  process.env.AGY_KIT_PAYLOAD ??
  join(ROOT, "..", "antigravity-kit", "plugins", "antigravity-kit");

test("dogfood: the reference antigravity-kit payload lints clean", (t) => {
  if (!existsSync(REFERENCE_PAYLOAD)) {
    t.skip(`reference payload not found at ${REFERENCE_PAYLOAD}`);
    return;
  }
  const result = lintPlugin(REFERENCE_PAYLOAD);
  const failed = result.checks.filter((c) => !c.pass);
  assert.equal(
    failed.length,
    0,
    `lint rules must pass on the reference payload; failing: ${JSON.stringify(failed)}`,
  );
  // Since antigravity-kit 0.3.0 (root hooks.json migration) the reference
  // payload is warning-free; any warning here is rule drift on our side or
  // regression on theirs.
  assert.deepEqual(
    result.warnings.map((w) => w.name),
    [],
    JSON.stringify(result.warnings),
  );
});

// Self-hosting: the kit's own payload must satisfy everything it enforces.
const OWN_PAYLOAD = join(ROOT, "plugins", "antigravity-meta-plugin-kit");

test("own payload lints clean: zero FAILs, zero warnings", () => {
  const result = lintPlugin(OWN_PAYLOAD, { repoRoot: ROOT });
  assert.deepEqual(
    result.checks.filter((c) => !c.pass),
    [],
    JSON.stringify(result.checks.filter((c) => !c.pass)),
  );
  assert.deepEqual(result.warnings, [], JSON.stringify(result.warnings));
});

test("own skills pass the skill checks", () => {
  const skillsDir = join(OWN_PAYLOAD, "skills");
  const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  assert.equal(skillDirs.length, 6, "exactly the 6 meta skills");
  for (const s of skillDirs) {
    const file = join(skillsDir, s, "SKILL.md");
    assert.ok(existsSync(file), `${s} missing SKILL.md`);
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    assert.ok(data?.name && data?.description, `${s}: frontmatter incomplete`);
    assert.equal(data.name, s, `${s}: frontmatter name must match dir`);
    assert.ok(hasTrigger(data.description), `${s}: description lacks a trigger`);
    assert.match(body, /## Rationalizations/, `${s}: missing Rationalizations`);
  }
});

test("own subagents: 3 toml + 1 md, versions in sync", () => {
  const agents = readdirSync(join(OWN_PAYLOAD, "agents")).sort();
  assert.equal(agents.filter((a) => a.endsWith(".toml")).length, 3);
  assert.equal(agents.filter((a) => a.endsWith(".md")).length, 1);
  const manifest = JSON.parse(
    readFileSync(join(OWN_PAYLOAD, "plugin.json"), "utf8"),
  );
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(manifest.version, pkg.version, "plugin.json vs package.json");
});
