import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold } from "../lib/scaffold.mjs";
import {
  KNOWN_EVENTS,
  flattenHooks,
  hasTrigger,
  isFailOpen,
  lintPlugin,
  scriptPathOf,
} from "../lib/lint.mjs";

// Each test seeds one defect into a fresh scaffold and asserts that exactly
// the targeted check flips to fail (or the targeted warning appears).
function freshPayload({ withAgents = false } = {}) {
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-lint-"));
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent, withAgents });
  return join(targetDir, "plugins", "demo-plugin");
}

function failing(result) {
  return result.checks.filter((c) => !c.pass).map((c) => c.name);
}

function warningNames(result) {
  return result.warnings.map((w) => w.name);
}

function editJson(file, edit) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  edit(data);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

test("clean scaffold passes with zero warnings", () => {
  const payload = freshPayload();
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
  assert.deepEqual(warningNames(result), []);
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

test("a non-plugin-name hook key passes (names are arbitrary)", () => {
  const payload = freshPayload();
  const hooksFile = join(payload, "hooks.json");
  const doc = JSON.parse(readFileSync(hooksFile, "utf8"));
  writeFileSync(
    hooksFile,
    JSON.stringify({ "totally-different-name": doc["demo-plugin"] }, null, 2) + "\n",
  );
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
});

test("an event name as top-level key fails (Claude Code-style config)", () => {
  const payload = freshPayload();
  const hooksFile = join(payload, "hooks.json");
  const doc = JSON.parse(readFileSync(hooksFile, "utf8"));
  writeFileSync(
    hooksFile,
    JSON.stringify({ PreToolUse: doc["demo-plugin"].PreToolUse }, null, 2) + "\n",
  );
  const names = failing(lintPlugin(payload));
  assert.ok(names.includes("hooks.json declares named hooks"), names);
});

test("timeout above 30 warns but does not fail", () => {
  const payload = freshPayload();
  editJson(join(payload, "hooks.json"), (doc) => {
    doc["demo-plugin"].PreToolUse[0].hooks[0].timeout = 45;
  });
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
  assert.ok(warningNames(result).includes("hook timeout above 30s"));
});

test("missing timeout warns but does not fail", () => {
  const payload = freshPayload();
  editJson(join(payload, "hooks.json"), (doc) => {
    delete doc["demo-plugin"].PreToolUse[0].hooks[0].timeout;
  });
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
  assert.ok(warningNames(result).includes("hook timeout missing"));
});

test("malformed timeout fails", () => {
  const payload = freshPayload();
  editJson(join(payload, "hooks.json"), (doc) => {
    doc["demo-plugin"].PreToolUse[0].hooks[0].timeout = "15s";
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["hook timeouts sane"]);
});

test("omitted type passes; non-command type fails", () => {
  const payload = freshPayload();
  const hooksFile = join(payload, "hooks.json");
  editJson(hooksFile, (doc) => {
    delete doc["demo-plugin"].PreToolUse[0].hooks[0].type;
  });
  assert.ok(lintPlugin(payload).pass);
  editJson(hooksFile, (doc) => {
    doc["demo-plugin"].PreToolUse[0].hooks[0].type = "http";
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["hook entries well-formed"]);
});

test("enabled:false is not treated as an event", () => {
  const payload = freshPayload();
  editJson(join(payload, "hooks.json"), (doc) => {
    doc["demo-plugin"].enabled = false;
  });
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
  assert.deepEqual(warningNames(result), []);
});

test("unknown event warns; SessionStart gets the unverified-contract note", () => {
  const payload = freshPayload();
  editJson(join(payload, "hooks.json"), (doc) => {
    doc["demo-plugin"].SessionStart = [
      { type: "command", command: "node x.mjs", timeout: 10 },
    ];
  });
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
  const w = result.warnings.find((x) => x.name === "unknown hook event");
  assert.ok(w, JSON.stringify(result.warnings));
  assert.match(w.note, /unverified/);
});

test("hook script without a fail-open marker fails", () => {
  const payload = freshPayload();
  writeFileSync(
    join(payload, "scripts", "example-guard.mjs"),
    'process.stdout.write(JSON.stringify({ decision: "allow" }) + "\\n");\n',
  );
  assert.deepEqual(failing(lintPlugin(payload)), ["hook scripts fail-open"]);
});

test("legacy hooks/hooks.json location warns (agy validate won't see it)", () => {
  const payload = freshPayload();
  mkdirSync(join(payload, "hooks"));
  renameSync(join(payload, "hooks.json"), join(payload, "hooks", "hooks.json"));
  editJson(join(payload, "plugin.json"), (m) => {
    m.hooks = "./hooks/hooks.json";
  });
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));
  assert.ok(warningNames(result).includes("hooks.json not at plugin root"));
});

test("root and legacy hooks.json with different content warn about drift", () => {
  const payload = freshPayload();
  mkdirSync(join(payload, "hooks"));
  writeFileSync(
    join(payload, "hooks", "hooks.json"),
    JSON.stringify({ stale: { Stop: [] } }) + "\n",
  );
  const result = lintPlugin(payload);
  assert.ok(warningNames(result).includes("hooks.json duplicated with drift"));
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

test("agents/*.toml: clean scaffold passes, seeded defects fail", () => {
  const payload = freshPayload({ withAgents: true });
  const result = lintPlugin(payload);
  assert.ok(result.pass, JSON.stringify(failing(result)));

  const agentFile = join(payload, "agents", "demo-plugin-helper.toml");
  const original = readFileSync(agentFile, "utf8");

  writeFileSync(agentFile, original.replace(/^name = ".*"$/m, 'name = "other"'));
  assert.deepEqual(failing(lintPlugin(payload)), ["agents/* minimally valid"]);

  writeFileSync(agentFile, original.replace(/^description = .*$/m, ""));
  assert.deepEqual(failing(lintPlugin(payload)), ["agents/* minimally valid"]);

  writeFileSync(agentFile, original + '\nbroken = """\n');
  assert.deepEqual(failing(lintPlugin(payload)), ["agents/* minimally valid"]);
});

test("agents/*.md: markdown subagents validated (CLI 1.0.16)", () => {
  const payload = freshPayload();
  mkdirSync(join(payload, "agents"));
  const agentFile = join(payload, "agents", "helper.md");

  writeFileSync(
    agentFile,
    "---\nname: helper\ndescription: test markdown agent\n---\nYou are a helper.\n",
  );
  assert.ok(lintPlugin(payload).pass);

  writeFileSync(agentFile, "no frontmatter\n");
  assert.deepEqual(failing(lintPlugin(payload)), ["agents/* minimally valid"]);

  writeFileSync(
    agentFile,
    "---\nname: other-name\ndescription: mismatch\n---\nbody\n",
  );
  assert.deepEqual(failing(lintPlugin(payload)), ["agents/* minimally valid"]);
});

test("flattenHooks: named hooks, both shapes, five events", () => {
  const doc = {
    "guard-set": {
      enabled: true,
      PreInvocation: [
        { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/a.mjs"', timeout: 10 },
      ],
      PreToolUse: [
        {
          matcher: "run_command",
          hooks: [
            { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/b.mjs"', timeout: 15 },
            { command: 'node "${PLUGIN_ROOT}/scripts/c.mjs"', timeout: 15 },
          ],
        },
      ],
      PostInvocation: [
        { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/d.mjs"', timeout: 10 },
      ],
      Stop: [
        { type: "command", command: 'node "${PLUGIN_ROOT}/scripts/e.mjs"', timeout: 10 },
      ],
    },
    "second-hook": {
      PostToolUse: [
        {
          matcher: "*",
          hooks: [{ command: 'node "${PLUGIN_ROOT}/scripts/f.mjs"', timeout: 10 }],
        },
      ],
    },
  };
  const { leaves, problems, shapeWarnings, unknownEvents, namedHooks } =
    flattenHooks(doc);
  assert.equal(problems.length, 0);
  assert.equal(shapeWarnings.length, 0);
  assert.equal(unknownEvents.length, 0);
  assert.equal(namedHooks, 2);
  assert.equal(leaves.length, 6);
  assert.equal(leaves.filter((l) => l.matcher === "run_command").length, 2);
});

test("flattenHooks flags shape mismatches as warnings", () => {
  const doc = {
    "odd-shapes": {
      PreToolUse: [{ command: "node x.mjs", timeout: 10 }],
      Stop: [{ matcher: "*", hooks: [{ command: "node y.mjs", timeout: 10 }] }],
    },
  };
  const { shapeWarnings, leaves } = flattenHooks(doc);
  assert.equal(shapeWarnings.length, 2);
  assert.equal(leaves.length, 2);
});

test("helper heuristics", () => {
  assert.equal(KNOWN_EVENTS.length, 5);
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
