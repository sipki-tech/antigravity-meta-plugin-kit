# Lifecycle hooks

English | [Русский](hooks.ru.md)

Lifecycle hooks let a plugin inspect, guard, rewrite, or annotate agent turns at
six deterministic points in the Antigravity execution loop. Every wire contract
and trap below was verified live on `agy 1.5.17`.

## Layout and `hooks.json` schema

- Place hooks at `<plugin>/hooks.json` — **root strict JSON** (comments and
  trailing commas hard-error; `hooks/hooks.json` is never loaded in native
  plugins).
- Top-level keys are **named hook groups** (putting event names directly at the
  top level hard-errors). Each group may optionally set `"enabled": false`.
- Every handler uses `"type": "command"`, `"command"` (executed via `sh -c`
  with working directory set to the plugin root), and `"timeout"` (integer
  seconds, default `30`; since `1.5.14`, the entire process group is killed on
  timeout).
- Invoke bundled scripts via relative paths such as `node ./scripts/guard.mjs`.
  Do **not** write `${PLUGIN_ROOT}` or `$PLUGIN_ROOT` in `command` strings —
  `agy plugin validate --strict` rejects it (the runtime already sets `cwd` to
  the plugin root and exports `PLUGIN_ROOT` and, for installed plugins,
  `PLUGIN_DATA` in the environment).

```json
{
  "my-plugin-guards": {
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "node ./scripts/example-guard.mjs",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## The six native events

| Event | Schema shape | When it fires |
|---|---|---|
| `SessionStart` | flat `[handler, ...]` | Once when a new session initializes. |
| `PreToolUse` | grouped `[{"matcher": "<regex>", "hooks": [...]}]` | Before a matching tool runs; can allow, deny, ask, or rewrite args. |
| `PostToolUse` | grouped `[{"matcher": "<regex>", "hooks": [...]}]` | After a matching tool finishes (for logging, telemetry, side effects). |
| `PreInvocation` | flat `[handler, ...]` | Before each model invocation; can inject steps or terminate the turn. |
| `PostInvocation` | flat `[handler, ...]` | After each model invocation; can inject steps, terminate, or `force_continue`. |
| `Stop` | flat `[handler, ...]` | When the agent is about to stop; can allow stop or force one continuation. |

Matcher regexes on `PreToolUse` / `PostToolUse` must match native Antigravity
tool names (such as `run_command`, `write_file`, `edit_file`, `read_file`).
Putting flat handlers on tool events silently fails to fire; putting matcher
groups on flat events hard-errors.

## Common stdin fields

Live probes confirmed that **all 6 events** (including `SessionStart`) receive
the full camelCase protojson common envelope on `stdin`:

- `conversationId` — unique conversation ID
- `workspacePaths` — array of active workspace directories
- `transcriptPath` — path to the conversation transcript file
- `artifactDirectoryPath` — path to the brain/artifact directory
- `modelName` — active model ID
- `lastUserInput` — most recent user message
- `hookEventName` — event name string (`SessionStart`, `PreToolUse`, etc.)
- `cwd` — the **agent's** working directory (distinct from the hook process's
  `process.cwd()`, which is the plugin root)

## Per-event contracts and responses

### `SessionStart`

- **Extra stdin fields:** none beyond the 8 common fields.
- **Stdout:** `{}` (no-op) or `{"injectSteps": [...]}` (typically a
  `systemMessage` step for session bootstrap context).

### `PreToolUse` (including `overwrite`)

- **Extra stdin fields:** `toolCall: { id, name, args }`, `stepIdx`.
- **Stdout:**
  - Allow: `{"decision": "allow"}`
  - Deny: `{"decision": "deny", "reason": "Explain why so the agent adapts"}`
  - Prompt user: `{"decision": "ask", "reason": "...", "permissionOverrides"?: [...]}`
    or `{"decision": "force_ask", ...}`
  - Rewrite tool arguments before execution (**verified live on `1.5.17`**):

```json
{
  "decision": "allow",
  "overwrite": { "CommandLine": "npm test -- --reporter=spec" }
}
```

`overwrite` performs a shallow top-level merge into `toolCall.args` and prefixes
the tool result with a notice listing changed keys.

### `PostToolUse`

- **Extra stdin fields:** `toolCall`, `stepIdx`, `error`.
- **Stdout:** `{}`. Note that proto `overwriteResult` is currently ignored in
  `1.5.17` command hooks — use `PostToolUse` for auditing, metrics, or external
  side effects, not mutating tool output.

### `PreInvocation` and `PostInvocation`

- **Extra stdin fields:** `invocationNum`, `initialNumSteps`.
- **Stdout:** `{"injectSteps": [...], "terminationBehavior": "" | "terminate" | "force_continue"}`
  (`force_continue` is valid on `PostInvocation` only; `terminate` works on both).
- **Valid `injectSteps` items:**
  - `{"systemMessage": {"systemMessage": "...", "metadata": {"user_markdown": "..."}}}`
    — canonical nested object (`metadata.user_markdown` renders for the user
    without going to the model).
  - `{"userMessage": "..."}` — injects a synthetic user message.
  - `{"errorMessage": {"userMessage": "..."}}` — displays an error to the user
    (pair with `"terminationBehavior": "terminate"`).

### `Stop` and the `continuationActive` bug

- **Extra stdin fields:** `executionNum`, `terminationReason`, `error`,
  `fullyIdle`, `continuationActive`.
- **Official `terminationReason` values:** `NO_TOOL_CALL` (normal model stop),
  `MAX_INVOCATIONS`, `MAX_FORCED_INVOCATIONS`, `MAX_TOKEN_BUDGET_EXCEEDED`,
  `ERROR`, `USER_CANCELED`, `TERMINAL_STEP_TYPE`, `TERMINAL_CUSTOM_HOOK`,
  `INJECTED_RESPONSE`.
- **Stdout:** `{"decision": ""}` (allow stop) or
  `{"decision": "continue", "reason": "What must be finished before stopping"}`.

> **Critical `agy 1.5.17` bug:** Live probes observed `continuationActive`
> remaining `false` even on `executionNum: 1` and `executionNum: 2` after a
> previous `{"decision": "continue"}`. A `Stop` hook that checks only
> `input.continuationActive` can loop repeatedly. **Always guard with both:**
> `isStopContinuation(input)` (`Boolean(input?.continuationActive || input?.executionNum > 0)`).

## Writing fail-open handlers with `io.mjs`

A crashed hook (non-zero exit, syntax error, unhandled rejection, or truncated
stdout) breaks the user's session. Every scaffolded plugin ships a zero-dep
fail-open helper at `scripts/lib/io.mjs`:

```js
#!/usr/bin/env node
import {
  ALLOW,
  commandLineOf,
  denyResponse,
  runHook,
} from "./lib/io.mjs";

const BLOCKED = [/\brm\s+-rf\s+\/(?:\s|$)/];

runHook((input) => {
  const cmd = commandLineOf(input);
  for (const re of BLOCKED) {
    if (re.test(cmd)) {
      return denyResponse("Refusing destructive root delete.");
    }
  }
  return ALLOW;
}, ALLOW);
```

`runHook(handler, fallback)`:
1. Reads stdin JSON with a 3-second safety timeout so an unclosed pipe never
   hangs the session.
2. Catches any synchronous or async error and emits `fallback` (`ALLOW`,
   `SILENT`, or `STOP_ALLOW`).
3. Flushes `stdout` before calling `process.exit(0)` so large JSON payloads are
   never truncated.

Available `io.mjs` exports:
- **PreToolUse:** `ALLOW`, `denyResponse`, `askResponse`, `forceAskResponse`,
  `overwriteResponse`
- **Session / Invocation:** `SILENT`, `systemMessageResponse`, `injectResponse`,
  `errorTerminateResponse`, `forceContinueResponse`
- **Stop:** `STOP_ALLOW`, `continueStopResponse`, `isStopContinuation`
- **Input adapters:** `hookEventNameOf`, `toolCallIdOf`, `commandLineOf`,
  `promptTextOf`, `transcriptPathOf`, `cwdOf`, `editedFileOf`

## Verified runtime traps

Every trap below passes `agy plugin validate --strict` (or fails silently at
runtime) and is explicitly caught by `lint.mjs`:

1. **`type: "prompt"` hooks crash every matching tool call.** They pass
   `agy plugin validate --strict`, yet `agy 1.5.17` fails at runtime with
   `prompt hooks are not currently supported`. Always use `"type": "command"`.
2. **`injectSteps: [{"toolCall": ...}]` crashes the turn with exit code 3**
   (`unknown injected step type: <nil>`). Never emit `toolCall` steps.
3. **`ephemeralMessage` is deprecated** — use the nested
   `{"systemMessage": {"systemMessage": "..."}}` shape via
   `systemMessageResponse()`.
4. **Never check the obsolete lowercase stop string** — normal model completion
   is `terminationReason === "NO_TOOL_CALL"`.
5. **Never ship global intrusive `Stop` hooks** in a utility plugin. Every
   globally installed hook fires in *every* workspace of every user. Keep hooks
   opt-in, tightly scoped, or workspace-local (`.agents/hooks.json`).

Next: [Testing](testing.md) · [Subagents](agents.md) · [Internals](../internals.md)
