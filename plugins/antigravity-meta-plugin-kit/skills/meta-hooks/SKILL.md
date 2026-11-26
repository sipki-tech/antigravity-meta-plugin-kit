---
name: meta-hooks
description: >-
  Author Google Antigravity lifecycle hooks (`agy 1.5.17+`) with official wire
  contracts, fail-open scripts, and runtime-trap guards. Use when the user says
  "meta-hooks" or designs, edits, or debugs hooks.json, SessionStart,
  PreToolUse, PostToolUse, PreInvocation, PostInvocation, or Stop hooks. Don't
  use for rules, skills, or MCP configs.
---

# meta-hooks — fail-open Antigravity lifecycle hooks

## Goal

Ship root `hooks.json` handlers and fail-open Node.js scripts that match the
verified `agy 1.5.17` camelCase protojson wire contracts and can never break
the user's session.

## Instructions

1. **Delegate design when starting from scratch:** for complex new hooks,
   invoke the `meta-hook-smith` subagent with the user's intent to draft the
   event choice, `hooks.json`, script, and tests, then review before applying.
2. **File shape (`<plugin>/hooks.json` — strict JSON only):**
   - Must live at the **plugin root** (`hooks/hooks.json` is never loaded in
     native plugins) and be **strict JSON** (no JSONC comments/trailing commas).
   - Top-level keys are **named hook groups** (optional `"enabled": false`).
     Never put an event name at the top level.
   - **Six official events:**
     - Grouped (`[{"matcher": "run_command", "hooks": [...]}]`): `PreToolUse`,
       `PostToolUse` (matcher `""`/`"*"` = all tools, otherwise regex over
       native tool names — never `Bash`/`Read`/`Edit`).
     - Flat (`[handler, ...]`): `SessionStart`, `PreInvocation`,
       `PostInvocation`, `Stop` (matcher groups on flat events hard-error).
   - **Handler fields:** `type: "command"` (never `type: "prompt"` — passes
     `agy --strict` but fails every tool call at runtime in `1.5.17`),
     `command` (`sh -c`, cwd = plugin root -> use `node ./scripts/x.mjs`, never
     `${PLUGIN_ROOT}`/`$PLUGIN_ROOT` in commands; `$PLUGIN_DATA` is available in
     env for installed plugins), `timeout` (integer seconds; default 30 -> set
     10–15 explicitly).
3. **Verified wire contracts (`agy 1.5.17`, camelCase JSON):**
   - **Common stdin (all 6 events, incl. `SessionStart`):** `conversationId`,
     `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, `modelName`,
     `lastUserInput`, `hookEventName`, `cwd` (agent working dir).
   - **`SessionStart`:** output `{}` or `{"injectSteps": [...]}`.
   - **`PreToolUse`:** input adds `toolCall: {id, name, args}`, `stepIdx`.
     Output: `{"decision": "allow"|"deny"|"ask"|"force_ask", "reason"?,
     "permissionOverrides"?, "overwrite"?}` (`overwrite` performs shallow
     top-level merge into `toolCall.args`; `auto_approve` and
     `deny_unless_prior_grant` also work in `1.5.17`).
   - **`PostToolUse`:** input adds `toolCall`, `stepIdx`, `error`. Output `{}`.
   - **`PreInvocation` / `PostInvocation`:** input adds `invocationNum`,
     `initialNumSteps`. Output: `{"injectSteps": [...], "terminationBehavior":
     ""|"terminate"|"force_continue"}` (`force_continue` is `PostInvocation`
     only; `terminate` works on both). Valid `injectSteps` items:
     - `{"systemMessage": {"systemMessage": "...", "metadata"?: {"user_markdown": "..."}}}`
     - `{"userMessage": "..."}`
     - `{"errorMessage": {"userMessage": "..."}}` (pair with `"terminate"`)
     - **Never use** deprecated `ephemeralMessage` or `{"toolCall": ...}`
       (crashes turn with exit 3 in `1.5.17`).
   - **`Stop`:** input adds `executionNum`, `terminationReason`
     (`NO_TOOL_CALL`, `MAX_INVOCATIONS`, `MAX_FORCED_INVOCATIONS`,
     `MAX_TOKEN_BUDGET_EXCEEDED`, `ERROR`, `USER_CANCELED`,
     `TERMINAL_STEP_TYPE`, `TERMINAL_CUSTOM_HOOK`, `INJECTED_RESPONSE`),
     `error`, `fullyIdle`, `continuationActive`. Output
     `{"decision": "continue", "reason": "..."}` or `{"decision": ""}`.
     - **Critical `1.5.17` loop guard:** live probes proved `continuationActive`
       can stay `false` when `executionNum > 0`. Always guard with
       `isStopContinuation(input)` (`continuationActive || executionNum > 0`).
4. **Fail-open law:** route every Node script through `runHook(handler, fallback)`
   from `scripts/lib/io.mjs` (flushes stdout before exit 0; never writes logs
   to stdout).
5. **Validate & test:** unit-test exported logic, e2e `spawnSync` test with
   real/junk/invalid/empty stdin, then run `lint.mjs --strict` and
   `agy plugin validate --strict --json`.

## Definition of Done

- Every hook exits 0 with valid JSON on junk, invalid, and empty stdin.
- `lint.mjs --strict` and `agy plugin validate --strict --json` pass cleanly.
- `Stop` hooks check `terminationReason === "NO_TOOL_CALL"` and
  `isStopContinuation(input)`.

## Constraints

- Only the single JSON response line goes to stdout; use stderr for diagnostics.
- Keep `timeout` <= 15s unless justified (hooks block synchronously).

## Rationalizations

- "`type: 'prompt'` passed `agy plugin validate --strict`" -> live probe on
  `agy 1.5.17` proved it fails every tool call with `prompt hooks are not
  currently supported`; use `type: "command"`.
- "Checking `continuationActive` alone prevents Stop loops" -> live probe on
  `agy 1.5.17` caught `continuationActive: false` at `executionNum: 1` and `2`;
  always check `continuationActive || executionNum > 0`.
