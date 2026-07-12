# Hooks: lifecycle events, wire contracts, and the fail-open law

*English | [Русский](hooks.ru.md)*

Hooks run external commands at fixed points of the agent loop: gate tool
calls, inject context, keep the session alive. Contracts below are from the
official in-CLI docs (2026-07, CLI 1.0.16; unchanged on 1.1.1),
cross-checked against the binary.

## hooks.json — file shape

Location: the **plugin root** (`plugins/<name>/hooks.json`) — the official
spot and the only one `agy plugin validate` sees. Top-level keys are **hook
names** (any string; the plugin name is a good collision-avoiding
convention). Never put an event name at the top level — that's the Claude
Code `settings.json` shape and it does not load here.

```json
{
  "my-plugin": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "node ./scripts/example-guard.mjs",
            "timeout": 10,
            "statusMessage": "my-plugin: guard"
          }
        ]
      }
    ],
    "Stop": [
      { "type": "command", "command": "node ./scripts/keep-going.mjs", "timeout": 10 }
    ]
  }
}
```

- Named hooks from all configs/plugins **merge**; handlers for the same
  event run sequentially.
- `"enabled": false` disables a named hook temporarily.
- Handler fields: `type` (optional; only `"command"` exists), `command`
  (required; `sh -c` on Unix, `cmd /c` on Windows; `~` expands; **cwd = the
  hooks.json directory**), `timeout` (seconds, **default 30** — set 10–15
  explicitly; hooks block the loop synchronously). `statusMessage` is an
  IDE nicety, not an official field.

## The six events

| Event | Fires | Structure |
|---|---|---|
| `SessionStart` | at conversation start | flat list |
| `PreToolUse` | before a tool step | matcher group |
| `PostToolUse` | after a tool step | matcher group |
| `PreInvocation` | before the model is called | flat list |
| `PostInvocation` | after tool calls finish | flat list |
| `Stop` | when the loop terminates | flat list |

`SessionStart` is the odd one out: absent from the official docs (they list
five), refuted against the 1.0.16 binary, then confirmed live on 1.1.1
(probe, 2026-07-12) — it fires once per conversation start.

Matchers (grouped events only): `""`/`"*"` = all tools; otherwise regex
(`run_command`, `run_command|view_file`, `browser_.*`). Tool names are the
lowercased `CORTEX_STEP_TYPE_*` suffixes.

## Wire contracts

JSON on stdin → JSON on stdout. All keys camelCase. Common input fields:
`conversationId`, `workspacePaths[]`, `transcriptPath`,
`artifactDirectoryPath`, `modelName` (transcript dir segment differs per
surface: `antigravity-cli/`, `antigravity/`, `antigravity-ide/`).

### SessionStart — conversation start (undocumented; probed 2026-07-12)

Input: the common fields only — no event-specific additions. Respond `{}`
(the only verified response; a result proto exists, so richer responses may
work — probe before relying on them).

### PreToolUse — gate tool calls

Input adds `toolCall.name`, `toolCall.args` (e.g. `CommandLine`), `stepIdx`.

```json
{ "decision": "deny", "reason": "rm -rf / is not happening", "permissionOverrides": [] }
```

`decision`: `allow` | `deny` | `ask` (prompt the user; respects the
"Always Allow" cache) | `force_ask` (ignore the cache). Legacy dialect
`{"allow_tool": bool, "deny_reason": "…"}` still parses on current builds
(re-checked on 1.1.1) — the scaffolded `denyResponse()` emits **both**
dialects until the legacy one dies.

### PostToolUse — observe results

Input carries `error` when the tool failed. Output: **`{}`**. Don't try to
inject here — never verified, and the official contract expects empty.

### PreInvocation — inject context

```json
{ "injectSteps": [
    { "userMessage": "visible injected message" },
    { "ephemeralMessage": "transient system message" },
    { "toolCall": { "name": "…", "args": {} } } ] }
```

`{}` = silent no-op.

### PostInvocation — keep-working mechanism

Input mirrors PreInvocation. Output:

```json
{ "injectSteps": [], "terminationBehavior": "force_continue" }
```

`force_continue` re-enters the loop; `terminate` stops it; `""`/omitted =
default.

### Stop — block premature stops

Input: `executionNum`, `terminationReason` (`model_stop` |
`max_steps_exceeded` | `error`), `error`, `fullyIdle`.

```json
{ "decision": "continue", "reason": "tests are still running" }
```

Any decision other than `"continue"` allows the stop; `reason` is injected
as a system message when continuing.

## The fail-open law

A throwing or non-zero hook degrades or breaks the user's session. Route
every script through a wrapper that catches **everything** and emits the
safe response with exit 0 — the scaffolded `scripts/lib/io.mjs`:

```js
import { pathToFileURL } from "node:url";
import { runHook, commandLineOf, denyResponse } from "./lib/io.mjs";

export function checkCommand(cmd) {
  return /\brm\s+-rf\s+\//.test(cmd) ? denyResponse("blocked") : { decision: "allow", allow_tool: true };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  runHook((input) => checkCommand(commandLineOf(input)));
```

Extract inputs via the adapter helpers (`commandLineOf`, `promptTextOf`,
`cwdOf`, `editedFileOf`) — field names drift between preview builds. Only
the single JSON response line goes to stdout.

## Pitfalls

- Event name as a top-level key → hook never loads (lint FAILs it).
- `hooks/hooks.json` instead of the root → invisible to `agy plugin
  validate` (lint warns).
- `${PLUGIN_ROOT}` in a command → expands to an **empty string** on CLI
  1.1.1 ("Cannot find module '/scripts/…'", observed 2026-07-12; it worked
  on earlier builds). Use hooks.json-relative paths: `node ./scripts/x.mjs`
  (cwd = the hooks.json dir). Lint warns on it.
- Missing timeout → 30s of silent blocking on a hung script.
- Emitting logs to stdout → corrupts the JSON response; use stderr.

## Checklist

- [ ] hooks.json at the plugin root, named hooks only
- [ ] every handler: command + explicit 10–15s timeout
- [ ] every script: runHook()-wrapped, exits 0 on junk/empty/malformed stdin
- [ ] e2e test per hook (see the [testing guide](testing.md))

*See also: [trap registry](../internals.md) · [Testing](testing.md)*
