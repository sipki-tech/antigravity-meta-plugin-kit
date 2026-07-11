import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  install,
  uninstall,
  verify,
  installWorkflows,
  listSkills,
  listAgents,
  listWorkflows,
} from "../installer/install.mjs";
import { detectLayout, workflowsDirs, PLUGIN_NAME } from "../installer/paths.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "cli.mjs");
const freshDir = () => mkdtempSync(join(tmpdir(), "meta-kit-install-"));

test("payload inventory: 6 skills, 4 agents, 4 workflows", () => {
  assert.equal(listSkills().length, 6);
  assert.equal(listAgents().length, 4);
  assert.equal(listWorkflows().length, 4);
});

test("detectLayout: global vs workspace, mirror when present", () => {
  const home = freshDir();
  const g = detectLayout({ home });
  assert.equal(g.scope, "global");
  assert.ok(g.pluginDir.endsWith(join(".gemini", "config", "plugins", PLUGIN_NAME)));
  assert.equal(g.mirrorPluginDirs.length, 0);

  mkdirSync(join(home, ".gemini", "antigravity-cli", "plugins"), { recursive: true });
  assert.equal(detectLayout({ home }).mirrorPluginDirs.length, 1);

  const w = detectLayout({ workspace: freshDir() });
  assert.equal(w.scope, "workspace");
  assert.ok(w.pluginDir.endsWith(join(".agents", "plugins", PLUGIN_NAME)));
});

test("dry-run plans actions without writing", () => {
  const home = freshDir();
  const { actions } = install({ home, dryRun: true });
  assert.ok(actions.length > 0);
  assert.equal(existsSync(join(home, ".gemini")), false);
});

test("global install writes installed_version and verify passes", () => {
  const home = freshDir();
  install({ home });
  const layout = detectLayout({ home });
  const installed = JSON.parse(
    readFileSync(join(layout.pluginDir, "installed_version.json"), "utf8"),
  );
  assert.ok(installed.version);
  const { pass, checks } = verify({ home });
  assert.ok(pass, JSON.stringify(checks.filter((c) => !c.pass)));
});

test("workspace install lands workflows and mirrors into .agent when present", () => {
  const ws = freshDir();
  mkdirSync(join(ws, ".agent"));
  install({ workspace: ws });
  for (const dir of workflowsDirs(ws)) {
    assert.ok(existsSync(join(dir, "meta-audit.md")), dir);
  }
  assert.equal(workflowsDirs(ws).length, 2, ".agent mirror expected");
  const { pass, checks } = verify({ workspace: ws });
  assert.ok(pass, JSON.stringify(checks.filter((c) => !c.pass)));
});

test("uninstall removes the plugin and its workflow aliases", () => {
  const ws = freshDir();
  install({ workspace: ws });
  uninstall({ workspace: ws });
  assert.equal(existsSync(detectLayout({ workspace: ws }).pluginDir), false);
  assert.equal(existsSync(join(ws, ".agents", "workflows", "meta-audit.md")), false);
});

test("standalone workflows command installs aliases only", () => {
  const ws = freshDir();
  const { targets, actions } = installWorkflows({ projectRoot: ws });
  assert.ok(actions.length > 0);
  assert.ok(existsSync(join(targets[0], "meta-scout.md")));
  assert.equal(existsSync(join(ws, ".agents", "plugins")), false);
});

function runCli(args, cwd) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60000,
  });
  assert.equal(res.status, 0, `cli ${args.join(" ")} failed: ${res.stderr}`);
  return res.stdout;
}

test("cli update: fresh install, then already-up-to-date on re-run", () => {
  const ws = freshDir();
  const first = runCli(["update", "--workspace"], ws);
  assert.match(first, /fresh install/);
  assert.match(first, /CHANGELOG\.md/);
  const second = runCli(["update", "--workspace"], ws);
  assert.match(second, /already up to date \(\d+\.\d+\.\d+\)/);
});
