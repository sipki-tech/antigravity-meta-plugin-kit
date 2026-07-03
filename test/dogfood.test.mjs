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
});

// Self-hosting: our own meta skills must satisfy the rules they teach.
test("own skills pass the skill checks", () => {
  const skillsDir = join(ROOT, "skills");
  const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  assert.equal(skillDirs.length, 5, "exactly the 5 meta skills");
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
