#!/usr/bin/env node
// Executable drift radar for Google Antigravity (`agy` CLI 1.5.17+).
// Verifies documented plugin contracts against the locally installed `agy`
// binary in isolated /tmp workspaces — never modifies ~/.gemini or any repo.
//
// Modes:
//   node ./scripts/probe.mjs [--fast] [--json]    # default (~2s, validator probes only)
//   node ./scripts/probe.mjs --live [--json]      # also runs isolated `agy -p` live runtime probes
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const HELP = `usage: node ./scripts/probe.mjs [--fast] [--live] [--model <id>] [--json]

  --fast          run fast validator oracle probes only (default, ~2s, no LLM calls)
  --live          also run isolated \`agy -p\` runtime probes (hooks, Stop loop, tiers, subagent tools)
  --model <id>    model for --live probes (default: gemini-3.8-flash-low)
  --json          emit machine-readable JSON report`;

function wf(p, content) {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(
    p,
    typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n",
  );
}

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#5B8DEF"/></svg>\n`;

const AGY_SHELL = process.platform === "win32";

function agyValidate(payload, strict = true) {
  const args = ["plugin", "validate", payload, "--json"];
  if (strict) args.push("--strict");
  const res = spawnSync("agy", args, {
    encoding: "utf8",
    timeout: 30000,
    shell: AGY_SHELL,
    env: { ...process.env, TERM: "dumb" },
  });
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {}
  return { status: res.status, parsed, stdout: res.stdout, stderr: res.stderr };
}

function runFastProbes(root) {
  const results = [];
  const check = (id, pass, expected, observed) => {
    results.push({ id, status: pass ? "CONFIRMED" : "DRIFT", expected, observed });
  };

  // 1. Baseline clean native plugin passes --strict with 0 findings
  {
    const dir = join(root, "p-clean");
    wf(join(dir, "plugin.json"), {
      name: "p-clean",
      displayName: "Clean Probe",
      version: "1.0.0",
      description: "Baseline probe plugin.",
      logo: "assets/logo.svg",
      suggestedPrompts: ["Try probe"],
    });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(join(dir, "rules", "AGENTS.md"), "# Rules\n- Be concise.\n");
    wf(
      join(dir, "skills", "p-clean-demo", "SKILL.md"),
      "---\nname: p-clean-demo\ndescription: >-\n  Multiline description.\n  Use when testing.\n---\n# Demo\n",
    );
    wf(
      join(dir, "agents", "p-clean-helper.md"),
      "---\nname: p-clean-helper\ndescription: Helper\nsubagent: true\nmainAgent: false\nmodel: inherit\ninheritMcp: false\ncommandExecutionPolicy: off\ntools:\n  - read_file\n---\nReply OK.\n",
    );
    const r = agyValidate(dir, true);
    const c = r.parsed?.components ?? {};
    const pass =
      r.status === 0 &&
      (r.parsed?.findings ?? []).length === 0 &&
      c.skills === 1 &&
      c.agents === 1 &&
      c.rules === 1;
    check(
      "baseline_clean_strict",
      pass,
      "exit 0, 0 findings, skills=1 agents=1 rules=1",
      `exit ${r.status}, findings=${(r.parsed?.findings ?? []).length}, components=${JSON.stringify(c)}`,
    );
  }

  // 2. Legacy manifest keys (`interface`, `rules`, `hooks`) still warn
  {
    const dir = join(root, "p-legacy-manifest");
    wf(join(dir, "plugin.json"), {
      name: "p-legacy-manifest",
      version: "1.0.0",
      logo: "assets/logo.svg",
      interface: { displayName: "X" },
      rules: "./rules",
      hooks: "./hooks.json",
    });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    const r = agyValidate(dir, true);
    const msgs = (r.parsed?.findings ?? []).map((f) => f.message).join(" | ");
    const pass = r.status !== 0 && msgs.includes('unknown field "interface"');
    check(
      "legacy_manifest_fields_warn",
      pass,
      'strict fails with unknown field "interface"',
      `exit ${r.status}: ${msgs}`,
    );
  }

  // 3. Agents: concrete model ID rejected; TOML silently ignored (agents=0)
  {
    const dir = join(root, "p-agents-drift");
    wf(join(dir, "plugin.json"), { name: "p-agents-drift", version: "1.0.0", logo: "assets/logo.svg" });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(
      join(dir, "agents", "bad-model.md"),
      "---\nname: bad-model\ndescription: test\nmodel: gemini-3.1-pro\n---\nBody\n",
    );
    wf(
      join(dir, "agents", "legacy.toml"),
      'name = "legacy"\ndescription = "toml"\ndeveloper_instructions = """Hi"""\n',
    );
    const r = agyValidate(dir, false);
    const msgs = (r.parsed?.findings ?? []).map((f) => f.message).join(" | ");
    const pass =
      r.status !== 0 &&
      r.parsed?.components?.agents === 0 &&
      msgs.includes("Invalid model tier") &&
      !msgs.includes("legacy.toml");
    check(
      "agents_concrete_model_error_and_toml_ignored",
      pass,
      "agents=0, Invalid model tier error, legacy.toml silently ignored",
      `exit ${r.status}, agents=${r.parsed?.components?.agents}: ${msgs}`,
    );
  }

  // 4. Rules: non-AGENTS.md without trigger errors; globs YAML array errors
  {
    const dir = join(root, "p-rules-drift");
    wf(join(dir, "plugin.json"), { name: "p-rules-drift", version: "1.0.0", logo: "assets/logo.svg" });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(join(dir, "rules", "plain.md"), "# No trigger\n");
    wf(join(dir, "rules", "arr.md"), "---\ntrigger: glob\nglobs:\n  - '**/*.ts'\n---\nBody\n");
    const r = agyValidate(dir, false);
    const msgs = (r.parsed?.findings ?? []).map((f) => f.message).join(" | ");
    const pass =
      r.status !== 0 &&
      r.parsed?.components?.rules === 0 &&
      msgs.includes("no valid trigger") &&
      msgs.includes("cannot unmarshal");
    check(
      "rules_trigger_and_globs_string",
      pass,
      "rules=0, no valid trigger + cannot unmarshal seq into string",
      `exit ${r.status}, rules=${r.parsed?.components?.rules}: ${msgs}`,
    );
  }

  // 5. Workflows in plugins warn never loaded
  {
    const dir = join(root, "p-workflows");
    wf(join(dir, "plugin.json"), { name: "p-workflows", version: "1.0.0", logo: "assets/logo.svg" });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(join(dir, "workflows", "demo.md"), "---\ndescription: demo\n---\nDo X\n");
    const r = agyValidate(dir, true);
    const msgs = (r.parsed?.findings ?? []).map((f) => f.message).join(" | ");
    const pass = r.status !== 0 && msgs.includes("plugins don't load Markdown workflows");
    check(
      "workflows_never_loaded_warn",
      pass,
      "strict fails with workflows never loaded",
      `exit ${r.status}: ${msgs}`,
    );
  }

  // 6. Hooks: 6 events valid; PromptHook passes validator (known blind spot!)
  {
    const dir = join(root, "p-hooks");
    wf(join(dir, "plugin.json"), { name: "p-hooks", version: "1.0.0", logo: "assets/logo.svg" });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(join(dir, "scripts", "noop.mjs"), "process.stdout.write('{}\\n');\n");
    wf(join(dir, "hooks.json"), {
      "p-hooks": {
        SessionStart: [{ type: "command", command: "node ./scripts/noop.mjs", timeout: 10 }],
        PreToolUse: [
          {
            matcher: "run_command",
            hooks: [{ type: "prompt", prompt: "allow", model: "flash" }],
          },
        ],
      },
    });
    const r = agyValidate(dir, true);
    const pass = r.status === 0 && r.parsed?.components?.hooks === 1;
    check(
      "hooks_session_start_and_prompt_blind_spot",
      pass,
      "SessionStart + PromptHook pass --strict (validator blind spot still active)",
      `exit ${r.status}, hooks=${r.parsed?.components?.hooks}, findings=${JSON.stringify(r.parsed?.findings)}`,
    );
  }

  // 7. Sidecar validation works
  {
    const dir = join(root, "p-sidecar");
    wf(join(dir, "plugin.json"), { name: "p-sidecar", version: "1.0.0", logo: "assets/logo.svg" });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(join(dir, "sidecars", "demo", "sidecar.json"), {
      command: "node",
      args: ["worker.mjs"],
      restart_policy: "on-failure",
      description: "Demo sidecar",
    });
    const r = agyValidate(dir, true);
    const pass = r.status === 0 && r.parsed?.components?.sidecars === 1;
    check(
      "sidecar_validates",
      pass,
      "exit 0, sidecars=1",
      `exit ${r.status}, sidecars=${r.parsed?.components?.sidecars}`,
    );
  }

  // 8. marketplace.json requires archive source with sha256 (git rejected)
  {
    const mp = join(root, "marketplace.json");
    wf(mp, {
      name: "probe-mp",
      owner: { name: "Probe" },
      plugins: [
        {
          name: "p-no-sha",
          version: "1.0.0",
          description: "Missing sha256",
          source: { type: "archive", url: "https://example.com/p.tar.gz" },
        },
        {
          name: "p-git",
          version: "1.0.0",
          description: "Unsupported git type",
          source: { type: "git", url: "https://github.com/example/p-git.git" },
        },
      ],
    });
    const r = agyValidate(mp, true);
    const msgs = (r.parsed?.findings ?? []).map((f) => f.message).join(" | ");
    const pass =
      r.status !== 0 &&
      msgs.includes("source has no sha256") &&
      msgs.includes('unsupported source type "git"');
    check(
      "marketplace_archive_sha256_contract",
      pass,
      "archive requires sha256; git source rejected",
      `exit ${r.status}: ${msgs}`,
    );
  }

  // 9. auth.json validator blind spot (agy --strict does not validate auth.json)
  {
    const dir = join(root, "p-auth-blind-spot");
    wf(join(dir, "plugin.json"), { name: "p-auth-blind-spot", version: "1.0.0", logo: "assets/logo.svg" });
    wf(join(dir, "assets", "logo.svg"), VALID_SVG);
    wf(join(dir, "auth.json"), { providers: { bad: { type: "bogus" } } });
    const r = agyValidate(dir, true);
    const pass = r.status === 0 && (r.parsed?.findings ?? []).length === 0;
    check(
      "auth_json_validator_blind_spot",
      pass,
      "broken auth.json passes agy --strict (validator blind spot still active)",
      `exit ${r.status}, findings=${JSON.stringify(r.parsed?.findings)}`,
    );
  }

  return results;
}

function runLiveProbes(root, model) {
  const results = [];
  const check = (id, pass, expected, observed) => {
    results.push({ id, status: pass ? "CONFIRMED" : "DRIFT", expected, observed });
  };
  const runAgy = (ws, prompt, timeoutSec = 45) =>
    spawnSync(
      "agy",
      [
        "-p",
        prompt,
        "--add-dir",
        ws,
        "--model",
        model,
        "--print-timeout",
        `${timeoutSec}s`,
        "--dangerously-skip-permissions",
      ],
      {
        cwd: ws,
        encoding: "utf8",
        timeout: (timeoutSec + 20) * 1000,
        shell: AGY_SHELL,
        env: { ...process.env, TERM: "dumb" },
      },
    );

  // Live 1: Stop terminationReason == NO_TOOL_CALL & SessionStart 8 fields
  {
    const ws = join(root, "live-hooks");
    mkdirSync(join(ws, ".git"), { recursive: true });
    const pdir = join(ws, ".agents", "plugins", "live-h");
    wf(join(pdir, "plugin.json"), { name: "live-h", version: "1.0.0" });
    wf(
      join(pdir, "scripts", "cap.mjs"),
      `import { appendFileSync } from "node:fs";
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const j = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
appendFileSync("./cap.jsonl", JSON.stringify({ ev: j.hookEventName, keys: Object.keys(j), reason: j.terminationReason ?? null, cont: j.continuationActive ?? null, exec: j.executionNum ?? null }) + "\\n");
process.stdout.write((j.hookEventName === "Stop" ? JSON.stringify({ decision: "" }) : "{}") + "\\n");
`,
    );
    wf(join(pdir, "hooks.json"), {
      "live-h": {
        SessionStart: [{ type: "command", command: "node ./scripts/cap.mjs", timeout: 10 }],
        Stop: [{ type: "command", command: "node ./scripts/cap.mjs", timeout: 10 }],
      },
    });
    const r = runAgy(ws, "Reply strictly OK without calling tools.");
    const lines = existsSync(join(pdir, "cap.jsonl"))
      ? readFileSync(join(pdir, "cap.jsonl"), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      : [];
    const ss = lines.find((x) => x.ev === "SessionStart");
    const st = lines.find((x) => x.ev === "Stop");
    const pass =
      r.status === 0 &&
      Boolean(ss?.keys?.includes("lastUserInput")) &&
      st?.reason === "NO_TOOL_CALL" &&
      typeof st?.cont === "boolean";
    check(
      "live_session_start_and_stop_contract",
      pass,
      "SessionStart has lastUserInput; Stop has NO_TOOL_CALL + continuationActive",
      JSON.stringify({ rc: r.status, ss, st }),
    );
  }

  // Live 2: PromptHook still fails at runtime
  {
    const ws = join(root, "live-prompt-hook");
    mkdirSync(join(ws, ".git"), { recursive: true });
    const pdir = join(ws, ".agents", "plugins", "live-ph");
    wf(join(pdir, "plugin.json"), { name: "live-ph", version: "1.0.0" });
    wf(join(pdir, "hooks.json"), {
      "live-ph": {
        PreToolUse: [
          {
            matcher: "run_command",
            hooks: [{ type: "prompt", model: "flash", prompt: "Allow all." }],
          },
        ],
      },
    });
    const r = runAgy(ws, "Run `echo HI` with run_command and quote any hook error verbatim.");
    const stillUnsupported = /prompt hooks are not currently supported/i.test(r.stdout + r.stderr);
    check(
      "live_prompt_hook_runtime_status",
      stillUnsupported,
      "prompt hooks still fail at runtime (if DRIFT, prompt hooks may now be live!)",
      stillUnsupported ? "still unsupported at runtime" : `CHANGED! stdout=${r.stdout.slice(0, 200)}`,
    );
  }

  // Live 3: Subagent with inheritMcp: false + tools: [read_file] runs cleanly without call_mcp_tool
  {
    const ws = join(root, "live-subagent-tools");
    mkdirSync(join(ws, ".git"), { recursive: true });
    const pdir = join(ws, ".agents", "plugins", "live-st");
    wf(join(pdir, "plugin.json"), { name: "live-st", version: "1.0.0" });
    wf(
      join(pdir, "agents", "probe-isolated.md"),
      `---
name: probe-isolated
description: Reports its own tool names for probe verification.
subagent: true
mainAgent: false
model: inherit
inheritMcp: false
commandExecutionPolicy: off
tools:
  - read_file
---
List the exact names of every tool declared in your system prompt as a single comma-separated line prefixed with TOOLS:. Do not call any tools except send_message if needed.
`,
    );
    const r = runAgy(
      ws,
      "Invoke the 'probe-isolated' subagent using invoke_subagent, wait for its reply, and output its TOOLS: line verbatim.",
      75,
    );
    const out = r.stdout + "\n" + r.stderr;
    const toolsLine = out.split("\n").find((l) => /TOOLS:/i.test(l)) ?? out;
    const hasReadFile = /\bread_file\b/.test(toolsLine);
    const hasCallMcp = /\bcall_mcp_tool\b/.test(toolsLine);
    const pass = r.status === 0 && hasReadFile && !hasCallMcp;
    check(
      "live_subagent_inherit_mcp_false",
      pass,
      "subagent receives read_file and does NOT receive call_mcp_tool",
      `rc=${r.status}, hasReadFile=${hasReadFile}, hasCallMcp=${hasCallMcp}`,
    );
  }

  // Live 4: Subagent model tier resolution (inherit keeps parent; pro resolves to Hydrogen)
  {
    const ws = join(root, "live-subagent-tiers");
    mkdirSync(join(ws, ".git"), { recursive: true });
    const pdir = join(ws, ".agents", "plugins", "live-mt");
    wf(join(pdir, "plugin.json"), { name: "live-mt", version: "1.0.0" });
    wf(
      join(pdir, "scripts", "cap-model.mjs"),
      `import { appendFileSync } from "node:fs";
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const j = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
appendFileSync("./models.jsonl", JSON.stringify({ id: j.conversationId, model: j.modelName, ev: j.hookEventName }) + "\\n");
process.stdout.write("{}\\n");
`,
    );
    wf(join(pdir, "hooks.json"), {
      "live-mt": {
        SessionStart: [{ type: "command", command: "node ./scripts/cap-model.mjs", timeout: 10 }],
      },
    });
    wf(
      join(pdir, "agents", "tier-inherit.md"),
      `---
name: tier-inherit
description: Trivial inherit-tier probe agent.
subagent: true
mainAgent: false
model: inherit
inheritMcp: false
commandExecutionPolicy: off
tools:
  - read_file
---
Reply strictly OK without calling tools.
`,
    );
    wf(
      join(pdir, "agents", "tier-pro.md"),
      `---
name: tier-pro
description: Trivial pro-tier probe agent.
subagent: true
mainAgent: false
model: pro
inheritMcp: false
commandExecutionPolicy: off
tools:
  - read_file
---
Reply strictly OK without calling tools.
`,
    );
    const r = runAgy(
      ws,
      "Invoke BOTH 'tier-inherit' and 'tier-pro' subagents in parallel with invoke_subagent, wait for both replies, then reply DONE.",
      150,
    );
    const rows = existsSync(join(pdir, "models.jsonl"))
      ? readFileSync(join(pdir, "models.jsonl"), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      : [];
    const uniqueModels = [...new Set(rows.map((x) => x.model).filter(Boolean))];
    const sawParent = uniqueModels.includes(model);
    const parentIsAlreadyPro = /hydrogen.*xhigh/i.test(model);
    const sawProTier = parentIsAlreadyPro
      ? uniqueModels.some((m) => /hydrogen|pro/i.test(m))
      : uniqueModels.some((m) => m !== model && /hydrogen|pro/i.test(m));
    const pass = r.status === 0 && rows.length >= 3 && sawParent && sawProTier;
    check(
      "live_subagent_model_tiers",
      pass,
      `inherit keeps parent (${model}); pro resolves to distinct Hydrogen/Pro tier`,
      JSON.stringify({ rc: r.status, sessions: rows.length, models: uniqueModels }),
    );
  }

  return results;
}

function main() {
  const { values } = parseArgs({
    options: {
      fast: { type: "boolean", default: false },
      live: { type: "boolean", default: false },
      model: { type: "string", default: "gemini-3.8-flash-low" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const ver = spawnSync("agy", ["--version"], {
    encoding: "utf8",
    timeout: 10000,
    shell: AGY_SHELL,
  });
  if (ver.status !== 0) {
    console.error("probe: `agy` CLI not found on PATH");
    return 1;
  }
  const agyVersion = ver.stdout.trim();
  const builtinDocsDir = join(
    homedir(),
    ".gemini",
    "antigravity-cli",
    "builtin",
    "skills",
    "agy-customizations",
    "docs",
  );
  const root = mkdtempSync(join(tmpdir(), "meta-kit-probe-"));
  let probes = [];
  try {
    probes = runFastProbes(root);
    if (values.live) {
      probes.push(...runLiveProbes(root, values.model));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const drifted = probes.filter((p) => p.status === "DRIFT");
  const report = {
    agyVersion,
    builtinDocsPresent: existsSync(builtinDocsDir),
    mode: values.live ? "fast+live" : "fast",
    confirmed: probes.length - drifted.length,
    drifted: drifted.length,
    probes,
  };

  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
    return drifted.length === 0 ? 0 : 1;
  }

  console.log(`agy version: ${agyVersion} (builtin docs: ${report.builtinDocsPresent ? "present" : "missing"})`);
  for (const p of probes) {
    console.log(`${p.status.padEnd(9)}  ${p.id}  (${p.observed})`);
  }
  console.log(
    drifted.length === 0
      ? `probe: ${report.confirmed}/${probes.length} contracts confirmed`
      : `probe: ${drifted.length} contract drift(s) detected — update docs/internals.md and lint.mjs`,
  );
  return drifted.length === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`probe: ${err.message}`);
  process.exit(1);
}
