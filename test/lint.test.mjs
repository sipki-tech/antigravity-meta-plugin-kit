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
import { scaffold } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/scaffold.mjs";
import {
  KNOWN_EVENTS,
  flattenHooks,
  hasTrigger,
  isFailOpen,
  lintPlugin,
  lintTarget,
  resolveAllPayloads,
  resolvePayloadDir,
  scriptPathOf,
  usesPluginRoot,
} from "../plugins/antigravity-meta-plugin-kit/scripts/lib/lint.mjs";

const tempRoots = [];
function freshPayload(opts = {}) {
  const parent = mkdtempSync(join(tmpdir(), "meta-kit-lint-"));
  tempRoots.push(parent);
  const { targetDir } = scaffold({ name: "demo-plugin", parentDir: parent, ...opts });
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

test.after(() => {
  for (const d of tempRoots) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {}
  }
});

test("clean scaffold passes strictly with zero warnings and zero notes", () => {
  const payload = freshPayload();
  const result = lintPlugin(payload);
  assert.ok(result.strictPass, JSON.stringify({ failing: failing(result), warnings: result.warnings }));
  assert.deepEqual(result.notes, []);
});

test("author accepts both string and object; empty object fails", () => {
  const payload = freshPayload();
  editJson(join(payload, "plugin.json"), (m) => {
    m.author = "Alice";
  });
  assert.ok(lintPlugin(payload).strictPass);

  editJson(join(payload, "plugin.json"), (m) => {
    m.author = {};
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["author valid"]);
});

test("legacy unknown manifest keys (interface/rules/hooks) warn and fail --strict", () => {
  const payload = freshPayload();
  editJson(join(payload, "plugin.json"), (m) => {
    m.interface = { displayName: "Legacy" };
    m.rules = "./rules";
    m.hooks = "./hooks.json";
  });
  const res = lintPlugin(payload);
  assert.ok(res.pass);
  assert.equal(res.strictPass, false);
  for (const k of ["interface", "rules", "hooks"]) {
    assert.ok(warningNames(res).includes(`unknown manifest field "${k}"`), JSON.stringify(res.warnings));
  }
});

test("JSONC comments in plugin.json warn (breaks agy plugin install)", () => {
  const payload = freshPayload();
  const p = join(payload, "plugin.json");
  writeFileSync(p, `// comment\n${readFileSync(p, "utf8")}`);
  const res = lintPlugin(payload);
  assert.ok(res.pass);
  assert.ok(warningNames(res).includes("plugin.json uses JSONC syntax"));
});

test("logo validation catches missing file, bad ext, and .github/ dir", () => {
  const payload = freshPayload();
  editJson(join(payload, "plugin.json"), (m) => {
    m.logo = "assets/missing.svg";
  });
  assert.ok(warningNames(lintPlugin(payload)).includes("logo file missing"));

  editJson(join(payload, "plugin.json"), (m) => {
    m.logo = "assets/logo.gif";
  });
  assert.ok(warningNames(lintPlugin(payload)).includes("logo extension unsupported"));

  editJson(join(payload, "plugin.json"), (m) => {
    m.logo = ".github/logo.svg";
  });
  assert.ok(warningNames(lintPlugin(payload)).includes("logo inside dot-prefixed dir"));
});

test("suggestedPrompts > 3 warns", () => {
  const payload = freshPayload();
  editJson(join(payload, "plugin.json"), (m) => {
    m.suggestedPrompts = ["a", "b", "c", "d"];
  });
  assert.ok(warningNames(lintPlugin(payload)).includes("suggestedPrompts exceeds 3"));
});

test(".antigravity-plugin/plugin.json layout resolves and catches misplaced components", () => {
  const payload = freshPayload({ manifestLayout: "dot-antigravity" });
  assert.equal(resolvePayloadDir(payload).payloadDir, payload);
  assert.ok(lintPlugin(payload).strictPass);

  writeFileSync(join(payload, ".antigravity-plugin", "hooks.json"), "{}\n");
  assert.ok(warningNames(lintPlugin(payload)).includes("component inside manifest subfolder"));
});

test("skills: multiline >- description passes; body > 24KB fails; disable-model-invocation skips trigger check", () => {
  const payload = freshPayload();
  const skill = join(payload, "skills", "demo-plugin-example", "SKILL.md");
  writeFileSync(
    skill,
    "---\nname: demo-plugin-example\ndescription: >-\n  Run a slash-only audit.\ndisable-model-invocation: true\n---\n# Body\n",
  );
  assert.ok(lintPlugin(payload).strictPass);

  writeFileSync(
    skill,
    `---\nname: demo-plugin-example\ndescription: Use when testing.\n---\n${"x".repeat(24500)}\n`,
  );
  assert.deepEqual(failing(lintPlugin(payload)), ["skill bodies within 24KB cap"]);
});

test("rules: AGENTS.md passes; lowercase agents.md fails; missing trigger fails; globs array fails; {a,b} braces warn", () => {
  const payload = freshPayload();
  const rulesDir = join(payload, "rules");
  unlinkSync(join(rulesDir, "AGENTS.md"));

  // Lowercase agents.md fails
  writeFileSync(join(rulesDir, "agents.md"), "# lowercase\n");
  assert.deepEqual(failing(lintPlugin(payload)), ["rules triggers valid"]);
  unlinkSync(join(rulesDir, "agents.md"));

  // Missing trigger fails
  writeFileSync(join(rulesDir, "style.md"), "# plain\n");
  assert.deepEqual(failing(lintPlugin(payload)), ["rules triggers valid"]);
  unlinkSync(join(rulesDir, "style.md"));

  // YAML array globs fails
  writeFileSync(join(rulesDir, "ts.md"), "---\ntrigger: glob\nglobs:\n  - '**/*.ts'\n---\nRule\n");
  assert.deepEqual(failing(lintPlugin(payload)), ["rules globs valid"]);

  // Brace expansion warns
  writeFileSync(join(rulesDir, "ts.md"), '---\ntrigger: glob\nglobs: "**/*.{ts,tsx}"\n---\nRule\n');
  const braceRes = lintPlugin(payload);
  assert.ok(braceRes.pass);
  assert.ok(warningNames(braceRes).includes("glob rule uses brace expansion"));

  // Valid comma-separated globs passes cleanly
  writeFileSync(join(rulesDir, "ts.md"), '---\ntrigger: glob\nglobs: "**/*.ts, **/*.tsx"\n---\nRule\n');
  assert.ok(lintPlugin(payload).strictPass);
});

test("agents: valid Markdown passes; TOML fails; bad model tier fails; bad policy fails; unknown tool fails; grep_search warns", () => {
  const payload = freshPayload({ withAgents: true });
  assert.ok(lintPlugin(payload).strictPass);

  const agDir = join(payload, "agents");
  const agFile = join(agDir, "demo-plugin-helper.md");
  const orig = readFileSync(agFile, "utf8");

  // Concrete model ID fails
  writeFileSync(agFile, orig.replace("model: inherit", "model: gemini-3.1-pro"));
  assert.deepEqual(failing(lintPlugin(payload)), ["agents valid (Markdown, tiers, policy)"]);

  // Bad commandExecutionPolicy fails
  writeFileSync(agFile, orig.replace("commandExecutionPolicy: off", "commandExecutionPolicy: ask"));
  assert.deepEqual(failing(lintPlugin(payload)), ["agents valid (Markdown, tiers, policy)"]);

  // Unknown tool name fails (crashes at runtime!)
  writeFileSync(agFile, orig.replace("  - read_file", "  - totally_fake_tool"));
  assert.deepEqual(failing(lintPlugin(payload)), ["agent tools valid"]);

  // Legacy grep_search warns
  writeFileSync(agFile, orig.replace("  - read_file", "  - read_file\n  - grep_search"));
  const grepRes = lintPlugin(payload);
  assert.ok(grepRes.pass);
  assert.ok(warningNames(grepRes).includes('agent uses legacy tool "grep_search"'));

  // Restore valid md, seed a .toml agent -> fails!
  writeFileSync(agFile, orig);
  writeFileSync(join(agDir, "old.toml"), 'name = "old"\ndescription = "x"\n');
  assert.deepEqual(failing(lintPlugin(payload)), ["agents valid (Markdown, tiers, policy)"]);
  unlinkSync(join(agDir, "old.toml"));

  // Subdir agents/<name>/agent.md passes cleanly
  mkdirSync(join(agDir, "subdir-worker"));
  writeFileSync(
    join(agDir, "subdir-worker", "agent.md"),
    "---\nname: subdir-worker\ndescription: Subdir agent.\nmodel: flash\ntools: [read_file]\n---\nHi\n",
  );
  assert.ok(lintPlugin(payload).strictPass);
});

test("hooks: PromptHook fails; Stop without continuation guard warns; model_stop/ephemeralMessage/toolCall warn; $PLUGIN_ROOT warns", () => {
  const payload = freshPayload();
  const hooksFile = join(payload, "hooks.json");

  // PromptHook fails (passes agy --strict, crashes runtime)
  editJson(hooksFile, (doc) => {
    doc["demo-plugin"].PreToolUse[0].hooks[0] = {
      type: "prompt",
      prompt: "check",
      model: "flash",
    };
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["hook entries well-formed"]);

  // Restore valid PreToolUse + add risky Stop hook
  writeFileSync(
    join(payload, "scripts", "stop-risky.mjs"),
    `import { runHook } from "./lib/io.mjs";
runHook((input) => {
  if (input.terminationReason === "model_stop") {
    return { decision: "continue", reason: "loop", injectSteps: [{ ephemeralMessage: "x" }, { toolCall: { name: "x" } }] };
  }
  return { decision: "" };
});
`,
  );
  writeFileSync(
    hooksFile,
    JSON.stringify(
      {
        "demo-plugin": {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: 'node "$PLUGIN_ROOT/scripts/example-guard.mjs"', timeout: 10 }],
            },
          ],
          Stop: [{ type: "command", command: "node ./scripts/stop-risky.mjs", timeout: 10 }],
        },
      },
      null,
      2,
    ) + "\n",
  );
  const res = lintPlugin(payload);
  assert.ok(res.pass, JSON.stringify(failing(res)));
  const w = warningNames(res);
  assert.ok(w.includes("hook matcher uses non-Antigravity tool name"), w);
  assert.ok(w.includes("hook command uses PLUGIN_ROOT variable"), w);
  assert.ok(w.includes("hook uses obsolete terminationReason 'model_stop'"), w);
  assert.ok(w.includes("hook uses deprecated ephemeralMessage"), w);
  assert.ok(w.includes("hook injects toolCall step"), w);
  assert.ok(w.includes("Stop hook missing continuation loop guard"), w);
});

test("hooks: legacy hooks/hooks.json location warns; event at top-level fails", () => {
  const payload = freshPayload();
  mkdirSync(join(payload, "hooks"));
  renameSync(join(payload, "hooks.json"), join(payload, "hooks", "hooks.json"));
  assert.ok(warningNames(lintPlugin(payload)).includes("hooks.json not at plugin root"));

  writeFileSync(join(payload, "hooks.json"), JSON.stringify({ PreToolUse: [] }) + "\n");
  assert.ok(failing(lintPlugin(payload)).includes("hooks.json declares named hooks"));
});

test("mcp: /sse warns, PLUGIN_ROOT in command warns, non-builtin command fails unless disabled", () => {
  const payload = freshPayload();
  const mcpFile = join(payload, "mcp_config.json");
  editJson(mcpFile, (mcp) => {
    mcp.mcpServers.remote = { url: "https://example.com/sse" };
    mcp.mcpServers.local = {
      command: "${PLUGIN_ROOT}/bin/srv",
      disabled: true,
      env: { PLUGIN_ROOT: "bad", MY_TOKEN: "${env:MY_TOKEN}" },
    };
  });
  const res = lintPlugin(payload);
  assert.ok(res.pass);
  const w = warningNames(res);
  assert.ok(w.includes('mcp server "remote" uses /sse endpoint'), w);
  assert.equal(
    w.filter((x) => x.includes('uses ${PLUGIN_ROOT} in command')).length,
    1,
    `expected exactly 1 PLUGIN_ROOT warning, got ${JSON.stringify(w)}`,
  );
  assert.ok(w.includes('mcp server "local" sets PLUGIN_ROOT in env'), w);
  assert.ok(w.includes('mcp server "local" uses ${env:...} in env'), w);

  editJson(mcpFile, (mcp) => {
    mcp.mcpServers.local.disabled = false;
  });
  assert.deepEqual(failing(lintPlugin(payload)), ["mcp: non-builtin commands ship disabled"]);
});

test("mcp: catches boolean tools.*.background, hardcoded secrets in headers, and malformed mcpServers", () => {
  const payload = freshPayload();
  const mcpFile = join(payload, "mcp_config.json");
  writeFileSync(
    mcpFile,
    JSON.stringify({
      mcpServers: {
        srv: {
          url: "https://example.com/mcp",
          headers: { Authorization: "Bearer super-real-token-value-1234567890" },
          tools: { run: { eager: true, background: false } },
        },
      },
    }),
  );
  const res = lintPlugin(payload);
  assert.ok(failing(res).includes("mcp servers well-formed"));
  assert.ok(
    warningNames(res).some((w) => w.includes("possible hardcoded secret in headers.Authorization")),
  );

  writeFileSync(mcpFile, JSON.stringify({ mcpServers: [] }));
  assert.ok(failing(lintPlugin(payload)).includes("mcp servers well-formed"));
});

test("hooks: Stop using continueStopResponse() without guard warns; scriptPathOf strips trailing ';'", () => {
  const payload = freshPayload();
  writeFileSync(
    join(payload, "scripts", "sdk-stop.mjs"),
    'import { continueStopResponse, runHook } from "./lib/io.mjs";\nrunHook(() => continueStopResponse("keep going"));\n',
  );
  writeFileSync(
    join(payload, "hooks.json"),
    JSON.stringify({
      "sdk-stop": {
        Stop: [{ type: "command", command: "node ./scripts/sdk-stop.mjs", timeout: 10 }],
      },
    }),
  );
  const res = lintPlugin(payload);
  assert.ok(
    warningNames(res).includes("Stop hook missing continuation loop guard"),
    JSON.stringify(warningNames(res)),
  );
  assert.equal(scriptPathOf("node ./scripts/a.mjs;"), "scripts/a.mjs");
});

test("lint: guards against escaping registry paths, EISDIR, array plugin.json, and resolves --all", () => {
  const payload = freshPayload();
  // Array plugin.json produces a SINGLE "plugin.json parses" check
  const arrDir = mkdtempSync(join(tmpdir(), "meta-kit-arr-"));
  tempRoots.push(arrDir);
  writeFileSync(join(arrDir, "plugin.json"), "[]\n");
  const arrRes = lintPlugin(arrDir);
  assert.equal(
    arrRes.checks.filter((c) => c.name === "plugin.json parses").length,
    1,
    "must not emit duplicate plugin.json parses checks",
  );
  assert.equal(arrRes.pass, false);

  // Registry path traversal warns instead of reading outside plugin root
  writeFileSync(join(payload, "skills.json"), JSON.stringify({ entries: [{ path: "../../outside" }] }));
  assert.ok(warningNames(lintPlugin(payload)).includes("skills.json path escapes plugin root"));

  // Multi-plugin repo resolution
  const mono = mkdtempSync(join(tmpdir(), "meta-kit-mono-"));
  tempRoots.push(mono);
  mkdirSync(join(mono, "plugins", "p-a"), { recursive: true });
  mkdirSync(join(mono, "plugins", "p-b"), { recursive: true });
  writeFileSync(join(mono, "plugins", "p-a", "plugin.json"), '{"name":"p-a","version":"1.0.0"}');
  writeFileSync(join(mono, "plugins", "p-b", "plugin.json"), '{"name":"p-b","version":"1.0.0"}');
  assert.equal(resolveAllPayloads(mono).length, 2);
});

test("sidecars and legacy workflows/ directories are validated", () => {
  const payload = freshPayload({ withSidecar: true });
  assert.ok(lintPlugin(payload).strictPass);

  mkdirSync(join(payload, "workflows"));
  writeFileSync(join(payload, "workflows", "old.md"), "---\ndescription: x\n---\nbody\n");
  assert.ok(warningNames(lintPlugin(payload)).includes("workflows/*.md never loaded in plugins"));
});

test("helper heuristics & flattenHooks", () => {
  assert.equal(KNOWN_EVENTS.length, 6);
  assert.ok(hasTrigger('Use when the user says "demo".'));
  assert.ok(hasTrigger("Don't use for backend code."));
  assert.ok(!hasTrigger("A very nice skill."));

  assert.equal(scriptPathOf('node "./scripts/my guard.mjs"'), "scripts/my guard.mjs");
  assert.equal(scriptPathOf('node "$PLUGIN_ROOT/scripts/x.mjs"'), "scripts/x.mjs");
  assert.equal(scriptPathOf("FOO=./bar echo hi"), null);
  assert.ok(usesPluginRoot('node "$PLUGIN_ROOT/scripts/x.mjs"'));
  assert.ok(!usesPluginRoot("node ./scripts/x.mjs"));

  assert.ok(isFailOpen("runHook(fn);"));
  assert.ok(!isFailOpen("// runHook(fn)\nmain();"));
  assert.ok(isFailOpen("try:\n  main()\nexcept Exception:\n  pass\n", ".py"));

  const flat = flattenHooks({
    "my-group": {
      SessionStart: [{ type: "command", command: "node ./scripts/a.mjs", timeout: 10 }],
      PreToolUse: [{ matcher: "run_command", hooks: [{ command: "node ./scripts/b.mjs", timeout: 10 }] }],
    },
  });
  assert.equal(flat.problems.length, 0);
  assert.equal(flat.leaves.length, 2);
});

test("auth.json validation catches bad providers, missing oauth2 URLs, and hardcoded secrets", () => {
  const payload = freshPayload({ withCli: true });
  assert.ok(lintPlugin(payload).strictPass, JSON.stringify(lintPlugin(payload)));

  // Valid oauth2 provider passes strictly
  writeFileSync(
    join(payload, "auth.json"),
    JSON.stringify({
      providers: {
        google: {
          type: "oauth2",
          domains: ["www.googleapis.com"],
          clis: ["demo"],
          oauth2: {
            authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            tokenUrl: "https://oauth2.googleapis.com/token",
            clientId: "client-123",
            scopes: ["https://www.googleapis.com/auth/userinfo.email"],
          },
          delivery: "env",
          env: { DEMO_TOKEN: "{access_token}" },
        },
      },
    }),
  );
  assert.ok(lintPlugin(payload).strictPass, JSON.stringify(lintPlugin(payload)));

  // Bad provider type + hardcoded secret warns; missing oauth2 URL fails
  writeFileSync(
    join(payload, "auth.json"),
    JSON.stringify({
      providers: {
        bogus: {
          type: "magic_auth",
          delivery: "env",
          env: { MY_API_KEY: "super-real-literal-secret-value-123456" },
        },
        brokenOauth: {
          type: "oauth2",
          oauth2: { authorizeUrl: "http://insecure.example.com", tokenUrl: "", clientId: "", scopes: [] },
        },
      },
    }),
  );
  const res = lintPlugin(payload);
  assert.ok(failing(res).includes("auth.json providers valid"));
  assert.ok(warningNames(res).some((w) => w.includes('unknown provider type "magic_auth"')));
  assert.ok(warningNames(res).some((w) => w.includes("possible hardcoded secret")));
});

test("marketplace.json validation enforces archive source + https url + 64-hex sha256", () => {
  const dir = mkdtempSync(join(tmpdir(), "meta-kit-mp-"));
  tempRoots.push(dir);
  const mp = join(dir, "marketplace.json");

  writeFileSync(
    mp,
    JSON.stringify({
      name: "acme-marketplace",
      plugins: [
        {
          name: "my-plugin",
          version: "1.0.0",
          description: "Archive plugin.",
          source: {
            type: "archive",
            url: "https://example.com/my-plugin-1.0.0.tar.gz",
            sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          },
        },
      ],
    }),
  );
  const good = lintTarget(mp);
  assert.equal(good.kind, "marketplace");
  assert.equal(good.strictPass, true, JSON.stringify(good));

  // String source, git source, and missing sha256 all fail
  writeFileSync(
    mp,
    JSON.stringify({
      name: "acme-marketplace",
      plugins: [
        { name: "p-str", version: "1.0.0", description: "x", source: "./plugins/p-str" },
        { name: "p-git", version: "1.0.0", description: "x", source: { type: "git", url: "https://github.com/a/b" } },
        { name: "p-nosha", version: "1.0.0", description: "x", source: { type: "archive", url: "https://example.com/a.tgz" } },
      ],
    }),
  );
  const bad = lintTarget(mp);
  assert.equal(bad.pass, false);
  assert.ok(failing(bad).includes("marketplace archive sources valid (url + sha256)"));
});
