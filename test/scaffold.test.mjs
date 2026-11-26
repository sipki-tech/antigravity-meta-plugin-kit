import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  scaffold,
  toDisplayName,
  toEnvPrefix,
  validatePluginName,
} from "../plugins/antigravity-meta-plugin-kit/scripts/lib/scaffold.mjs";
import { lintPlugin, lintTarget } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/lint.mjs";

const tempRoots = [];
const freshDir = () => {
  const d = mkdtempSync(join(tmpdir(), "meta-kit-scaffold-"));
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

test("validatePluginName & toDisplayName", () => {
  for (const name of ["my-plugin", "a2-b", "plugin", "x0"]) {
    assert.equal(validatePluginName(name), null, name);
  }
  for (const name of ["My_Plugin", "2fast", "-x", "a--b", "a-", "", "a b", "UPPER"]) {
    assert.ok(validatePluginName(name), `should reject '${name}'`);
  }
  assert.equal(toDisplayName("my-cool-plugin"), "My Cool Plugin");
  assert.equal(toEnvPrefix("my-cool-plugin"), "MY_COOL_PLUGIN");
});

test("scaffold default profile creates expected native Antigravity structure", () => {
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: freshDir() });
  const expected = [
    "package.json",
    ".gitignore",
    "README.md",
    ".github/workflows/ci.yml",
    "plugins/demo-plugin/plugin.json",
    "plugins/demo-plugin/assets/logo.svg",
    "plugins/demo-plugin/rules/AGENTS.md",
    "plugins/demo-plugin/hooks.json",
    "plugins/demo-plugin/scripts/example-guard.mjs",
    "plugins/demo-plugin/scripts/lib/io.mjs",
    "plugins/demo-plugin/skills/demo-plugin-example/SKILL.md",
    "plugins/demo-plugin/skills/demo-plugin-example/resources/prompt-template.md",
    "plugins/demo-plugin/mcp_config.json",
    "test/hook.test.mjs",
    "test/manifest.test.mjs",
  ];
  for (const rel of expected) {
    assert.ok(existsSync(join(targetDir, rel)), `missing ${rel}`);
  }
  assert.equal(existsSync(join(targetDir, "plugins/demo-plugin/agents")), false);
  assert.equal(existsSync(join(targetDir, "plugins/demo-plugin/sidecars")), false);
  assert.equal(existsSync(join(targetDir, "plugins/demo-plugin/rules/style.md")), false);
});

test("scaffold --minimal omits hooks, scripts, and MCP while staying lint-clean and testable", () => {
  const { targetDir } = scaffold({ name: "mini-plugin", parentDir: freshDir(), minimal: true });
  assert.equal(existsSync(join(targetDir, "plugins/mini-plugin/hooks.json")), false);
  assert.equal(existsSync(join(targetDir, "plugins/mini-plugin/scripts")), false);
  assert.equal(existsSync(join(targetDir, "plugins/mini-plugin/mcp_config.json")), false);
  assert.equal(existsSync(join(targetDir, "test/hook.test.mjs")), false);
  assert.ok(existsSync(join(targetDir, "test/manifest.test.mjs")));
  assert.ok(lintTarget(targetDir).strictPass);
});

test("scaffold --with-agents renders canonical Markdown agent + /name-help slash skill", () => {
  const { targetDir } = scaffold({
    name: "demo-plugin",
    parentDir: freshDir(),
    withAgents: true,
  });
  const md = join(targetDir, "plugins/demo-plugin/agents/demo-plugin-helper.md");
  const slashSkill = join(targetDir, "plugins/demo-plugin/skills/demo-plugin-help/SKILL.md");
  assert.ok(existsSync(md));
  assert.ok(existsSync(slashSkill));
  assert.match(readFileSync(md, "utf8"), /^model: inherit$/m);
  assert.match(readFileSync(slashSkill, "utf8"), /^disable-model-invocation: true$/m);
  assert.ok(lintPlugin(join(targetDir, "plugins/demo-plugin")).strictPass);
});

test("scaffold --with-sidecar & --manifest-layout dot-antigravity lint strictly clean", () => {
  const { targetDir } = scaffold({
    name: "sc-plugin",
    parentDir: freshDir(),
    withSidecar: true,
    manifestLayout: "dot-antigravity",
  });
  assert.ok(existsSync(join(targetDir, "plugins/sc-plugin/.antigravity-plugin/plugin.json")));
  assert.equal(existsSync(join(targetDir, "plugins/sc-plugin/plugin.json")), false);
  assert.ok(existsSync(join(targetDir, "plugins/sc-plugin/sidecars/sc-plugin-worker/sidecar.json")));
  assert.ok(lintTarget(targetDir).strictPass);
});

test("scaffold --with-cli and --minimal --with-cli generate Google Workspace CLI + auth.json pattern", () => {
  const { targetDir } = scaffold({
    name: "acme-api",
    parentDir: freshDir(),
    minimal: true,
    withCli: true,
  });
  assert.ok(existsSync(join(targetDir, "plugins/acme-api/auth.json")));
  assert.ok(existsSync(join(targetDir, "plugins/acme-api/scripts/cli.mjs")));
  assert.ok(existsSync(join(targetDir, "plugins/acme-api/skills/acme-api-cli/SKILL.md")));
  assert.ok(existsSync(join(targetDir, "test/cli.test.mjs")));
  assert.equal(existsSync(join(targetDir, "plugins/acme-api/hooks.json")), false);
  assert.equal(existsSync(join(targetDir, "plugins/acme-api/mcp_config.json")), false);
  assert.ok(lintTarget(targetDir).strictPass, JSON.stringify(lintTarget(targetDir)));

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  const res = spawnSync(process.execPath, ["--test", "test/cli.test.mjs", "test/manifest.test.mjs"], {
    cwd: targetDir,
    encoding: "utf8",
    timeout: 30000,
    env,
  });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /# fail 0/);
});

test("scaffold leaves no unsubstituted placeholders across all options", () => {
  const { targetDir } = scaffold({
    name: "demo-plugin",
    parentDir: freshDir(),
    withAgents: true,
    withSidecar: true,
    withCli: true,
  });
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        assert.ok(!entry.includes("__name__"), `path placeholder left: ${p}`);
        walk(p);
      } else {
        assert.ok(!entry.includes("__name__"), `path placeholder left: ${p}`);
        const text = readFileSync(p, "utf8");
        assert.ok(!text.includes("{{name}}"), `{{name}} left in ${p}`);
        assert.ok(!text.includes("{{displayName}}"), `{{displayName}} left in ${p}`);
        assert.ok(!text.includes("{{ENV_PREFIX}}"), `{{ENV_PREFIX}} left in ${p}`);
      }
    }
  };
  walk(targetDir);
});

test("scaffold --dry-run plans actions without writing; refuses existing dir", () => {
  const parent = freshDir();
  const dry = scaffold({ name: "demo-plugin", parentDir: parent, dryRun: true });
  assert.ok(dry.actions.length > 0);
  assert.equal(existsSync(dry.targetDir), false);

  scaffold({ name: "demo-plugin", parentDir: parent });
  assert.throws(() => scaffold({ name: "demo-plugin", parentDir: parent }), /already exists/);
});

test("scaffolded plugin's own tests pass out of the box and scripts work over symlinks", () => {
  const parent = freshDir();
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent, withCli: true });
  assert.ok(existsSync(join(targetDir, "plugins/demo-plugin/README.md")));
  if (process.platform !== "win32") {
    const guardMode = statSync(join(targetDir, "plugins/demo-plugin/scripts/example-guard.mjs")).mode & 0o111;
    assert.ok(guardMode !== 0, "example-guard.mjs should preserve executable mode");
  }

  // Run example-guard.mjs and cli.mjs via symlink (regression for B1 + W7)
  const linkDir = join(parent, "linked-payload");
  symlinkSync(join(targetDir, "plugins/demo-plugin"), linkDir);
  const guardRes = spawnSync(process.execPath, [join(linkDir, "scripts/example-guard.mjs")], {
    input: JSON.stringify({ toolCall: { args: { CommandLine: "rm -rf  ./build" } } }),
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(guardRes.status, 0, guardRes.stderr);
  assert.equal(JSON.parse(guardRes.stdout).decision, "allow");

  const cliBadFlag = spawnSync(process.execPath, [join(linkDir, "scripts/cli.mjs"), "--unknown", "--json"], {
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(cliBadFlag.status, 1);
  assert.equal(JSON.parse(cliBadFlag.stdout).ok, false);

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  const res = spawnSync(
    process.execPath,
    ["--test", "test/hook.test.mjs", "test/manifest.test.mjs", "test/cli.test.mjs"],
    { cwd: targetDir, encoding: "utf8", timeout: 120000, env },
  );
  assert.equal(res.status, 0, `scaffolded tests failed:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /# pass [1-9]/, "tests must actually run");
  assert.match(res.stdout, /# fail 0/);
});
