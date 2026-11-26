import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hasTrigger, lintPlugin } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/lint.mjs";
import { parseFrontmatter } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/frontmatter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OWN_PAYLOAD = join(ROOT, "plugins", "antigravity-meta-plugin-kit");

test("own payload lints strictly clean: 0 FAILs, 0 warnings, 0 notes", () => {
  const result = lintPlugin(OWN_PAYLOAD);
  assert.deepEqual(
    result.checks.filter((c) => !c.pass),
    [],
    JSON.stringify(result.checks.filter((c) => !c.pass)),
  );
  assert.deepEqual(result.warnings, [], JSON.stringify(result.warnings));
  assert.deepEqual(result.notes, [], JSON.stringify(result.notes));
  assert.equal(result.strictPass, true);
});

test("bundled dev-tool scripts (meta-kit, create, lint, probe, doctor) ship in the payload and run", () => {
  const scripts = join(OWN_PAYLOAD, "scripts");
  for (const f of ["meta-kit.mjs", "create.mjs", "lint.mjs", "probe.mjs", "doctor.mjs"]) {
    assert.ok(existsSync(join(scripts, f)), `scripts/${f} missing`);
  }

  const lint = spawnSync(
    process.execPath,
    [join(scripts, "meta-kit.mjs"), "lint", "--strict", "--json", ROOT],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  assert.equal(JSON.parse(lint.stdout).strictPass, true);

  const tmp = mkdtempSync(join(tmpdir(), "kit-"));
  try {
    const create = spawnSync(
      process.execPath,
      [join(scripts, "meta-kit.mjs"), "create", "demo-x", "--dry-run"],
      { encoding: "utf8", timeout: 30000, cwd: tmp },
    );
    assert.equal(create.status, 0, create.stdout + create.stderr);
    assert.match(create.stdout, /would create/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("own skills: 8 expert skills + 3 slash-only wrappers pass discipline checks", () => {
  const skillsDir = join(OWN_PAYLOAD, "skills");
  const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.equal(skillDirs.length, 11, `expected 11 skills, got ${skillDirs.join(", ")}`);

  let slashOnlyCount = 0;
  for (const s of skillDirs) {
    const file = join(skillsDir, s, "SKILL.md");
    assert.ok(existsSync(file), `${s} missing SKILL.md`);
    const { data, body, bodyBytes } = parseFrontmatter(readFileSync(file, "utf8"));
    assert.ok(data?.name && data?.description, `${s}: frontmatter incomplete`);
    assert.equal(data.name, s, `${s}: frontmatter name must match dir`);
    assert.ok(bodyBytes < 16000, `${s}: body too large (${bodyBytes} B)`);
    if (data["disable-model-invocation"] === true) {
      slashOnlyCount += 1;
    } else {
      assert.ok(hasTrigger(data.description), `${s}: description lacks a trigger`);
      assert.match(body, /## Rationalizations/, `${s}: missing Rationalizations`);
    }
  }
  assert.equal(
    slashOnlyCount,
    3,
    "expected 3 slash-only wrappers (/meta-audit, /meta-doctor, /meta-scout)",
  );
});

test("own subagents (3 Markdown), logo, model_decision rule, and synced version", () => {
  const agents = readdirSync(join(OWN_PAYLOAD, "agents")).sort();
  assert.deepEqual(agents, [
    "meta-hook-smith.md",
    "meta-payload-auditor.md",
    "meta-trap-scout.md",
  ]);
  assert.ok(existsSync(join(OWN_PAYLOAD, "assets/logo.svg")));
  assert.ok(existsSync(join(OWN_PAYLOAD, "rules/plugin-authoring.md")));
  assert.equal(existsSync(join(OWN_PAYLOAD, "workflows")), false);
  assert.equal(existsSync(join(OWN_PAYLOAD, "hooks.json")), false);

  const manifest = JSON.parse(readFileSync(join(OWN_PAYLOAD, "plugin.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(manifest.version, pkg.version, "plugin.json vs package.json");
});
