# Testing plugins

English | [Русский](testing.ru.md)

Reliable Antigravity plugins are verified across four fast, complementary layers
using zero third-party test dependencies (built-in `node:test` + `node:assert/strict`).

## Four verification layers

1. **Unit & hook e2e tests (`npm test`)** — deterministic offline tests in
   `node:test` verifying hook wire contracts, fail-open behavior, and manifest
   invariants.
2. **Offline strict lint (`lint.mjs --strict`)** — runs in CI without `agy`,
   enforcing `agy plugin validate --strict` parity plus runtime blind spots.
3. **Official validator (`agy plugin validate --strict --json`)** — Google's
   authoritative structural oracle locally (and in CI when `agy` is available).
4. **Isolated live `agy -p` smoke test** — verifies real subagent loading, hook
   firing, and tool restrictions in a throwaway `/tmp` workspace.

## 1. Unit and e2e tests with `node:test`

Run the entire suite with:

```bash
npm test    # executes `node --test`
```

The default scaffold includes two starter suites (omitting `hook.test.mjs` with
`--minimal`, and adding `test/cli.test.mjs` with `--with-cli`):
- `test/manifest.test.mjs` — asserts strict JSON parsing, semver `version`,
  kebab-case `name`, existing `logo`, and valid `hooks.json` (when present).
- `test/hook.test.mjs` — spawns the real hook script as a child process, feeds
  realistic camelCase `agy 1.5.17` protojson over `stdin`, and asserts exit
  code `0` plus valid JSON on `stdout`.

### Testing `PreToolUse` and `Stop` hooks end-to-end

Always test **four cases** for every hook script:
1. **Allow / happy path** — benign input returns `{"decision": "allow"}` (or `{}` / `{"decision": ""}`).
2. **Block / rewrite path** — target trigger returns the exact expected `deny`,
   `overwrite`, `injectSteps`, or `continue` payload.
3. **Malformed or empty stdin** — broken JSON or `{}` still exits `0` with the
   fail-open fallback (never throws or exits non-zero).
4. **Loop prevention (for `Stop` hooks)** — confirm the hook returns
   `{"decision": ""}` when `terminationReason !== "NO_TOOL_CALL"`, when
   `continuationActive: true`, **and** when `continuationActive: false` with
   `executionNum: 1` (covering the `agy 1.5.17` `continuationActive` bug).

```js
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";

function runHook(script, stdin) {
  const res = spawnSync(process.execPath, [script], {
    input: typeof stdin === "string" ? stdin : JSON.stringify(stdin),
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(res.status, 0, `hook exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout.trim());
}

test("PreToolUse blocks dangerous command and fails open on garbage", () => {
  const blocked = runHook("plugins/my-plugin/scripts/example-guard.mjs", {
    hookEventName: "PreToolUse",
    toolCall: { id: "1", name: "run_command", args: { CommandLine: "rm -rf /" } },
  });
  assert.equal(blocked.decision, "deny");

  const failOpen = runHook("plugins/my-plugin/scripts/example-guard.mjs", "{not-json");
  assert.equal(failOpen.decision, "allow");
});
```

## 2. Offline strict lint (`lint.mjs --strict`)

Run the kit's linter locally and in every GitHub Actions job:

```bash
node plugins/antigravity-meta-plugin-kit/scripts/lint.mjs --strict .
node plugins/antigravity-meta-plugin-kit/scripts/lint.mjs --strict --json .
```

Pass `--all` in multi-plugin repositories to validate every directory under
`plugins/`. `--strict` promotes warnings to exit code `1` so runtime traps
(`agents/*.toml`, unknown `tools:`, `grep_search`, `type: "prompt"`, missing
`Stop` loop guards, `{a,b}` globs, `/sse` MCP endpoints) break CI immediately.

## 3. Official validator (`agy plugin validate --strict --json`)

Whenever `agy` is installed locally, run Google's validator and assert an empty
`findings` array:

```bash
agy plugin validate --strict --json plugins/my-plugin
```

You can also wrap this check inside a `node:test` file that skips cleanly when
`agy` is not on `PATH` (see `test/agy-validate.test.mjs` in this repository).

## 4. Isolated live `agy -p` smoke test

Before releasing a plugin that adds subagents or hooks, test it in a clean
`/tmp` directory so you never touch `~/.gemini/config/plugins/`:

```bash
WS=$(mktemp -d /tmp/agy-smoke-XXXXXX)
mkdir -p "$WS/.git" "$WS/.agents/plugins"
cp -R plugins/my-plugin "$WS/.agents/plugins/my-plugin"

agy -p "Confirm which subagents and skills from my-plugin are visible." \
  --add-dir "$WS" \
  --model gemini-3.8-flash-low \
  --print-timeout 45s

rm -rf "$WS"
```

Always pass `--add-dir "$WS"` — non-interactive `agy -p` only discovers
workspace `.agents/plugins/` directories explicitly added to the workspace.

## Documentation parity checks

If your plugin maintains bilingual docs (EN + RU), keep a small parity test
(like `test/docs-parity.test.mjs` in this repo) that checks:
- Identical heading-level structure between each `.md` and `.ru.md` pair.
- Russian documents cross-link to `.ru.md` siblings rather than English pages.
- Zero obsolete or broken patterns across docs, skills, agents, and templates.

Next: [Shipping](shipping.md) · [Lifecycle hooks](hooks.md) · [Researching Antigravity](researching-antigravity.md)
