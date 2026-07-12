import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold, validatePluginName } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/scaffold.mjs";
import { lintPlugin, lintTarget } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/lint.mjs";

const freshDir = () => mkdtempSync(join(tmpdir(), "meta-kit-scaffold-"));

test("validatePluginName accepts kebab-case", () => {
  for (const name of ["my-plugin", "a2-b", "plugin", "x0"]) {
    assert.equal(validatePluginName(name), null, name);
  }
});

test("validatePluginName rejects everything else", () => {
  for (const name of ["My_Plugin", "2fast", "-x", "a--b", "a-", "", "a b", "UPPER"]) {
    assert.ok(validatePluginName(name), `should reject '${name}'`);
  }
});

test("scaffold creates the full expected structure", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  const expected = [
    "package.json",
    ".gitignore",
    "README.md",
    ".github/workflows/ci.yml",
    "plugins/demo-plugin/plugin.json",
    "plugins/demo-plugin/hooks.json",
    "plugins/demo-plugin/scripts/example-guard.mjs",
    "plugins/demo-plugin/scripts/lib/io.mjs",
    "plugins/demo-plugin/skills/demo-plugin-example/SKILL.md",
    "plugins/demo-plugin/skills/demo-plugin-example/resources/prompt-template.md",
    "plugins/demo-plugin/rules/style.md",
    "plugins/demo-plugin/mcp_config.json",
    "test/hook.test.mjs",
  ];
  // Native-only scaffold: no bin/ or installer/ — install via `agy plugin
  // install`, not a bundled Node CLI.
  for (const gone of ["bin/cli.mjs", "installer", "test/installer.test.mjs"]) {
    assert.equal(existsSync(join(targetDir, gone)), false, `should not scaffold ${gone}`);
  }
  for (const rel of expected) {
    assert.ok(existsSync(join(targetDir, rel)), `missing ${rel}`);
  }
  // agents/ is opt-in: the format is validator-known but undocumented.
  assert.equal(existsSync(join(targetDir, "plugins", "demo-plugin", "agents")), false);
});

test("scaffold --with-agents renders the example subagent", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({
    name: "demo-plugin",
    parentDir: parent,
    withAgents: true,
  });
  const toml = join(
    targetDir,
    "plugins",
    "demo-plugin",
    "agents",
    "demo-plugin-helper.toml",
  );
  assert.ok(existsSync(toml));
  assert.match(readFileSync(toml, "utf8"), /^name = "demo-plugin-helper"$/m);
  const result = lintPlugin(join(targetDir, "plugins", "demo-plugin"));
  assert.ok(result.pass, JSON.stringify(result.checks.filter((c) => !c.pass)));
});

test("scaffold leaves no unsubstituted placeholders", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        assert.ok(!entry.includes("__name__"), `path placeholder left: ${p}`);
        walk(p);
      } else {
        assert.ok(!entry.includes("__name__"), `path placeholder left: ${p}`);
        const text = readFileSync(p, "utf8");
        assert.ok(!text.includes("{{name}}"), `content placeholder left in ${p}`);
      }
    }
  };
  walk(targetDir);
});

test("scaffold --dry-run plans actions without writing", () => {
  const parent = freshDir();
  const { targetDir, actions } = scaffold({
    name: "demo-plugin",
    parentDir: parent,
    dryRun: true,
  });
  assert.ok(actions.length > 0);
  assert.equal(existsSync(targetDir), false);
});

test("scaffold refuses an existing target directory", () => {
  const parent = freshDir();
  scaffold({ name: "demo-plugin", parentDir: parent });
  assert.throws(
    () => scaffold({ name: "demo-plugin", parentDir: parent }),
    /already exists/,
  );
});

test("scaffolded plugin lints clean (payload and repo-root modes)", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  const payload = lintPlugin(join(targetDir, "plugins", "demo-plugin"));
  assert.ok(payload.pass, JSON.stringify(payload.checks.filter((c) => !c.pass)));
  assert.equal(payload.warnings.length, 0, JSON.stringify(payload.warnings));
  const repo = lintTarget(targetDir);
  assert.ok(repo.pass);
  assert.equal(repo.warnings.length, 0, JSON.stringify(repo.warnings));
  assert.equal(repo.notes.length, 0, JSON.stringify(repo.notes));
});

test("scaffolded plugin's own tests pass out of the box", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  // Explicit file list: `node --test test/` (directory arg) breaks on Node 22.
  // Clean env: an inherited NODE_TEST_CONTEXT from this very test runner makes
  // the child runner report success without running anything.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  const res = spawnSync(
    process.execPath,
    ["--test", "test/hook.test.mjs"],
    { cwd: targetDir, encoding: "utf8", timeout: 120000, env },
  );
  assert.equal(res.status, 0, `scaffolded tests failed:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /# pass [1-9]/, "tests must actually run");
  assert.match(res.stdout, /# fail 0/);
});
