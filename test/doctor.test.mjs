import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runDoctor } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/doctor.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCTOR_BIN = join(ROOT, "plugins/antigravity-meta-plugin-kit/scripts/doctor.mjs");

const tempRoots = [];
const freshDir = () => {
  const d = mkdtempSync(join(tmpdir(), "meta-kit-doctor-"));
  tempRoots.push(d);
  return d;
};

test.after(() => {
  for (const d of tempRoots) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {}
  }
});

function wf(p, content) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(
    p,
    typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n",
  );
}

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#5B8DEF"/></svg>\n`;

function createCleanPlugin(dir, name, extraManifest = {}) {
  wf(join(dir, "plugin.json"), {
    name,
    displayName: name,
    version: "1.0.0",
    description: "Clean test plugin.",
    logo: "assets/logo.svg",
    ...extraManifest,
  });
  wf(join(dir, "assets", "logo.svg"), VALID_SVG);
  wf(
    join(dir, "skills", `${name}-demo`, "SKILL.md"),
    `---\nname: ${name}-demo\ndescription: Demo skill. Use when testing ${name}.\n---\n# Demo\n`,
  );
}

test("doctor reports healthy on clean isolated home and workspace", () => {
  const root = freshDir();
  const home = join(root, "home");
  const ws = join(root, "ws");
  createCleanPlugin(join(home, ".gemini", "config", "plugins", "alpha"), "alpha");
  wf(join(ws, "AGENTS.md"), "# Project\n- Keep things clean.\n");

  const report = runDoctor({ homeDir: home, workspaceDir: ws });
  assert.equal(report.pass, true, JSON.stringify(report.findings));
  assert.equal(report.strictPass, true, JSON.stringify(report.findings));
  assert.equal(report.counts.pluginsEnabled, 1);
  assert.equal(report.alwaysOnRules.count, 1);
});

test("doctor respects config.json enablement precedence and flags stale entries", () => {
  const root = freshDir();
  const home = join(root, "home");
  const ws = join(root, "ws");
  mkdirSync(ws, { recursive: true });

  // p-off: disabled via config.json (should NOT be linted even if broken)
  const pOff = join(home, ".gemini", "config", "plugins", "p-off");
  createCleanPlugin(pOff, "p-off");
  wf(join(pOff, "agents", "bad.toml"), 'name = "bad"\n');

  // p-override: disabled: true in manifest, but enabled: true in config.json
  const pOn = join(home, ".gemini", "config", "plugins", "p-on");
  createCleanPlugin(pOn, "p-on", { disabled: true });

  // p-manifest-off: disabled: true in manifest and absent in config.json
  const pManOff = join(home, ".gemini", "config", "plugins", "p-man-off");
  createCleanPlugin(pManOff, "p-man-off", { disabled: true });

  wf(join(home, ".gemini", "config", "config.json"), {
    plugins: {
      "p-off": { enabled: false },
      "p-on": { enabled: true },
      "ghost-plugin": { enabled: true },
    },
  });

  const report = runDoctor({ homeDir: home, workspaceDir: ws });
  assert.equal(report.pass, true, JSON.stringify(report.findings));
  assert.equal(report.counts.pluginsTotal, 3);
  assert.equal(report.counts.pluginsEnabled, 1);
  assert.equal(report.plugins.find((p) => p.dirName === "p-on")?.enabled, true);
  assert.equal(report.plugins.find((p) => p.dirName === "p-off")?.enabled, false);
  assert.equal(report.plugins.find((p) => p.dirName === "p-man-off")?.enabled, false);
  assert.ok(
    report.findings.some((f) => f.severity === "info" && f.subject.includes("ghost-plugin")),
    "expected stale config.json info finding",
  );
});

test("doctor detects plugin, skill, and agent collisions + global Stop hooks + hard caps", () => {
  const root = freshDir();
  const home = join(root, "home");
  const ws = join(root, "ws");

  // Workspace plugin "shared" shadows global plugin "shared" (collision!)
  createCleanPlugin(join(ws, ".agents", "plugins", "shared"), "shared");
  createCleanPlugin(join(home, ".gemini", "config", "plugins", "shared"), "shared");

  // Duplicate agent in standalone workspace + global
  wf(
    join(ws, ".agents", "agents", "dup-agent.md"),
    "---\nname: dup-agent\ndescription: ws\n---\nBody\n",
  );
  wf(
    join(home, ".gemini", "config", "agents", "dup-agent.md"),
    "---\nname: dup-agent\ndescription: global\n---\nBody\n",
  );

  // Global plugin with active Stop hook + >24KB oversized rule + huge always_on rules > 20k tokens
  const gHook = join(home, ".gemini", "config", "plugins", "g-stop");
  createCleanPlugin(gHook, "g-stop");
  wf(join(gHook, "scripts", "stop.mjs"), "import { runHook } from './x.mjs'; runHook(() => ({ decision: '' }));\n");
  wf(join(gHook, "hooks.json"), {
    "g-stop": {
      Stop: [{ type: "command", command: "node ./scripts/stop.mjs", timeout: 10 }],
    },
  });

  // Oversized standalone rule (>24KB) AND enough always_on bytes (>80KB -> >20k tokens)
  wf(join(ws, "AGENTS.md"), "x".repeat(25000));
  wf(join(ws, "GEMINI.md"), "y".repeat(22000));
  wf(join(ws, ".agents", "rules", "a.md"), "---\ntrigger: always_on\n---\n" + "z".repeat(20000));
  wf(join(ws, ".agents", "rules", "b.md"), "---\ntrigger: always_on\n---\n" + "w".repeat(20000));

  const report = runDoctor({ homeDir: home, workspaceDir: ws });
  assert.equal(report.pass, false);
  const categories = new Set(report.findings.map((f) => f.category));
  assert.ok(categories.has("collision"), "expected collision findings");
  assert.ok(categories.has("global-hook"), "expected global-hook warning");
  assert.ok(categories.has("truncation"), "expected 24KB truncation error");
  assert.ok(categories.has("rules-budget"), "expected 20k rules-budget error");
  assert.ok(
    report.findings.some((f) => f.subject === "agent:dup-agent"),
    "expected duplicate agent collision",
  );
  assert.ok(
    report.findings.some((f) => f.subject === "skill:shared-demo"),
    "expected duplicate skill collision",
  );
});

test("doctor discovers symlinked plugins & skills and uses dir name for nested agent.md without name", () => {
  const root = freshDir();
  const home = join(root, "home");
  const ws = join(root, "ws");
  const devPlugin = join(root, "dev", "linked-plugin");
  const devSkill = join(root, "dev", "linked-skill");
  createCleanPlugin(devPlugin, "linked-plugin");
  // Add a nested agent.md without frontmatter `name` to verify fallback is dir name ("custom-worker"), not "agent"
  wf(join(devPlugin, "agents", "custom-worker", "agent.md"), "---\ndescription: Worker\n---\nBody\n");
  wf(join(devSkill, "SKILL.md"), "---\nname: linked-skill\ndescription: Linked. Use when testing.\n---\nBody\n");

  mkdirSync(join(home, ".gemini", "config", "plugins"), { recursive: true });
  mkdirSync(join(home, ".agents", "skills"), { recursive: true });
  mkdirSync(ws, { recursive: true });
  symlinkSync(devPlugin, join(home, ".gemini", "config", "plugins", "linked-plugin"));
  symlinkSync(devSkill, join(home, ".agents", "skills", "linked-skill"));
  wf(join(home, ".gemini", "config", "config.json"), {
    plugins: { "linked-plugin": { enabled: true } },
  });

  const report = runDoctor({ homeDir: home, workspaceDir: ws });
  assert.equal(report.counts.pluginsEnabled, 1, "symlinked plugin must be discovered");
  assert.equal(report.counts.skills, 2, "symlinked skill + plugin skill must both be discovered");
  assert.equal(
    report.findings.some((f) => f.subject.includes("linked-plugin") && f.category === "config"),
    false,
    "symlinked plugin must NOT be flagged stale in config.json",
  );
  assert.equal(
    report.findings.some((f) => f.subject === "agent:agent"),
    false,
    "nested agent.md fallback name must not collide as 'agent'",
  );
});

test("doctor does not double-count ~/.agents when workspace has no .git or equals homeDir", () => {
  const root = freshDir();
  const home = join(root, "home");
  const wsNoGit = join(home, "fresh-no-git");
  mkdirSync(wsNoGit, { recursive: true });
  wf(
    join(home, ".agents", "skills", "g-skill", "SKILL.md"),
    "---\nname: g-skill\ndescription: Global skill. Use when testing.\n---\nBody\n",
  );
  wf(join(home, ".agents", "rules", "AGENTS.md"), "# Global rule\n- Stay clean.\n");

  const report = runDoctor({ homeDir: home, workspaceDir: wsNoGit });
  assert.equal(report.strictPass, true, JSON.stringify(report.findings));
  assert.equal(report.counts.skills, 1);
  assert.equal(report.alwaysOnRules.count, 1);

  const atHome = runDoctor({ homeDir: home, workspaceDir: home });
  assert.equal(atHome.strictPass, true, JSON.stringify(atHome.findings));
  assert.equal(atHome.counts.skills, 1);
  assert.equal(atHome.alwaysOnRules.count, 1);
});

test("doctor.mjs CLI works with --home, --workspace, and --json", () => {
  const root = freshDir();
  const home = join(root, "home");
  const ws = join(root, "ws");
  createCleanPlugin(join(home, ".gemini", "config", "plugins", "demo-ok-live"), "demo-ok-live");
  mkdirSync(ws, { recursive: true });

  const res = spawnSync(
    process.execPath,
    [DOCTOR_BIN, "--home", home, "--workspace", ws, "--strict", "--json"],
    { encoding: "utf8", timeout: 15000 },
  );
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.strictPass, true);
  assert.equal(parsed.counts.pluginsEnabled, 1);
});
