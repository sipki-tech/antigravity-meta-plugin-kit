import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold } from "../lib/scaffold.mjs";
import {
  flattenHooks,
  hasTrigger,
  isFailOpen,
  lintPlugin,
  scriptPathOf,
} from "../lib/lint.mjs";

// Each test seeds one defect into a fresh scaffold and asserts that exactly
// the targeted check flips to fail.
function freshPayload() {
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-lint-"));
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent });
  return join(targetDir, "plugins", "demo-plugin");
}

function failing(result) {
  return result.checks.filter((c) => !c.pass).map((c) => c.name);
}

function editJson(file, edit) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  edit(data);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

test("clean scaffold passes", () => {
  const payload = freshPayload();
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
});

test("string author fails", () => {
  const payload = freshPayload();
  editJson(join(payload, "plugin.json"), (m) => {
    m.author = "someone";
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["author is an object"]);
});

test("non-semver version fails", () => {
  const payload = freshPayload();
  editJson(join(payload, "plugin.json"), (m) => {
    m.version = "1.0";
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["version is semver"]);
});

test("stripped SKILL.md frontmatter fails", () => {
  const payload = freshPayload();
  const skill = join(payload, "skills", "demo-plugin-example", "SKILL.md");
  writeFileSync(skill, "# no frontmatter at all\n");
  assert.deepEqual(failing(lintPlugin(payload)), ["skill frontmatter valid"]);
});

test("description without a trigger phrase fails", () => {
  const payload = freshPayload();
  const skill = join(payload, "skills", "demo-plugin-example", "SKILL.md");
  writeFileSync(
    skill,
    "---\nname: demo-plugin-example\ndescription: A very nice skill.\n---\n# body\n",
  );
  assert.deepEqual(failing(lintPlugin(payload)), [
    "skill descriptions carry a trigger",
  ]);
});

test("dangling hook script reference fails", () => {
  const payload = freshPayload();
  unlinkSync(join(payload, "scripts", "example-guard.mjs"));
  assert.deepEqual(failing(lintPlugin(payload)), ["hook scripts exist"]);
});

test("wrong hooks.json namespace fails", () => {
  const payload = freshPayload();
  const hooksFile = join(payload, "hooks", "hooks.json");
  const doc = JSON.parse(readFileSync(hooksFile, "utf8"));
  writeFileSync(
    hooksFile,
    JSON.stringify({ "other-plugin": doc["demo-plugin"] }, null, 2) + "\n",
  );
  const names = failing(lintPlugin(payload));
  assert.ok(names.includes("hooks.json namespaced by plugin name"), names);
});

test("oversized timeout fails", () => {
  const payload = freshPayload();
  editJson(join(payload, "hooks", "hooks.json"), (doc) => {
    doc["demo-plugin"].PreToolUse[0].hooks[0].timeout = 45;
  });
  assert.deepEqual(failing(lintPlugin(payload)), [
    "hook timeouts present and <=30s",
  ]);
});

test("hook script without a fail-open marker fails", () => {
  const payload = freshPayload();
  writeFileSync(
    join(payload, "scripts", "example-guard.mjs"),
    'process.stdout.write(JSON.stringify({ allow_tool: true }) + "\\n");\n',
  );
  assert.deepEqual(failing(lintPlugin(payload)), ["hook scripts fail-open"]);
});

test("mcp entry with a non-builtin command must ship disabled", () => {
  const payload = freshPayload();
  const mcpFile = join(payload, "mcp_config.json");
  editJson(mcpFile, (mcp) => {
    mcp.mcpServers.headroom = { command: "headroom", args: ["mcp"] };
  });
  assert.deepEqual(failing(lintPlugin(payload)), [
    "mcp: non-builtin commands ship disabled",
  ]);
  editJson(mcpFile, (mcp) => {
    mcp.mcpServers.headroom.disabled = true;
  });
  assert.ok(lintPlugin(payload).pass);
});

test("committed installed_version.json warns but does not fail", () => {
  const payload = freshPayload();
  writeFileSync(
    join(payload, "installed_version.json"),
    JSON.stringify({ version: "0.1.0" }) + "\n",
  );
  const result = lintPlugin(payload);
  assert.ok(result.pass);
  assert.ok(
    result.warnings.some((w) => w.name.includes("installed_version.json")),
    JSON.stringify(result.warnings),
  );
});

test("missing declared path fails", () => {
  const payload = freshPayload();
  rmSync(join(payload, "rules"), { recursive: true });
  const names = failing(lintPlugin(payload));
  assert.ok(names.includes("declared paths exist"), names);
});

test("payload-only lint emits the installed_version note", () => {
  const payload = freshPayload();
  const result = lintPlugin(payload);
  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0].note, /silently ignores/);
});

test("flattenHooks handles both reference shapes", () => {
  const doc = {
    "some-plugin": {
      PreInvocation: [
        { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/a.mjs"', timeout: 10 },
      ],
      PreToolUse: [
        {
          matcher: "run_command",
          hooks: [
            { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/b.mjs"', timeout: 15 },
            { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/c.mjs"', timeout: 15 },
          ],
        },
      ],
      Stop: [
        { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/d.mjs"', timeout: 10 },
      ],
    },
  };
  const { leaves, problems } = flattenHooks(doc, "some-plugin");
  assert.equal(problems.length, 0);
  assert.equal(leaves.length, 4);
  assert.equal(leaves.filter((l) => l.matcher === "run_command").length, 2);
});

test("helper heuristics", () => {
  assert.ok(hasTrigger('Use when the user says "kit-plan".'));
  assert.ok(hasTrigger("Use for multi-step planning."));
  assert.ok(hasTrigger("Use always; especially in long sessions."));
  assert.ok(!hasTrigger("A very nice skill."));

  assert.equal(
    scriptPathOf('node "${PLUGIN_ROOT}/scripts/x.mjs"'),
    "scripts/x.mjs",
  );
  assert.equal(scriptPathOf("echo hello"), null);

  assert.ok(isFailOpen("import { runHook } from './lib/io.mjs';\nrunHook(fn);"));
  assert.ok(isFailOpen("try {\n  main();\n} catch {\n  allow();\n}"));
  assert.ok(!isFailOpen("main();"));
});
