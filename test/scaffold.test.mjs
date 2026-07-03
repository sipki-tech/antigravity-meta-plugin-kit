import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold, validatePluginName } from "../lib/scaffold.mjs";
import { lintPlugin, lintTarget } from "../lib/lint.mjs";

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
    "bin/cli.mjs",
    "installer/fsutil.mjs",
    "installer/paths.mjs",
    "installer/install.mjs",
    "plugins/demo-plugin/plugin.json",
    "plugins/demo-plugin/hooks/hooks.json",
    "plugins/demo-plugin/scripts/example-guard.mjs",
    "plugins/demo-plugin/scripts/lib/io.mjs",
    "plugins/demo-plugin/skills/demo-plugin-example/SKILL.md",
    "plugins/demo-plugin/rules/style.md",
    "plugins/demo-plugin/mcp_config.json",
    "test/hook.test.mjs",
    "test/installer.test.mjs",
  ];
  for (const rel of expected) {
    assert.ok(existsSync(join(targetDir, rel)), `missing ${rel}`);
  }
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
  assert.equal(repo.notes.length, 0, "repo mode detects the installer, no note");
});

test("scaffolded plugin's own tests pass out of the box", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  const res = spawnSync(process.execPath, ["--test", "test/"], {
    cwd: targetDir,
    encoding: "utf8",
    timeout: 120000,
  });
  assert.equal(res.status, 0, `scaffolded tests failed:\n${res.stdout}\n${res.stderr}`);
});
