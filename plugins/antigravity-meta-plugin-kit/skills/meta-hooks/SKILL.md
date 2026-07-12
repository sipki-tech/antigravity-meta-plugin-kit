---
name: meta-hooks
description: Author Antigravity plugin hooks with the official wire contracts and the fail-open law. Use when the user says "meta-hooks" or works on hooks.json, PreToolUse, PostToolUse, PreInvocation, PostInvocation, or Stop handlers.
---

# meta-hooks — hooks that never break the host session

## Goal

Ship hooks that speak the official contracts (in-CLI docs, 2026-07) and are
fail-open: any internal error resolves to the allow/silent response with
exit 0.

## Instructions

1. Put `hooks.json` at the **plugin root** (official location; the built-in
   `agy plugin validate` looks only there). Top-level keys are **hook names**
   — any string; using your plugin name is a sane collision-avoiding
   convention, not a requirement. Never put an event name at the top level
   (that's a Claude Code settings.json shape — it does not load). A named
   hook supports `"enabled": false` for temporary disabling.
2. Six events. `PreToolUse`/`PostToolUse` take matcher groups
   `{"matcher": "run_command", "hooks": [...]}` (matcher: `""`/`"*"` = all
   tools, otherwise regex); `SessionStart`/`PreInvocation`/`PostInvocation`/
   `Stop` take flat handler lists. `SessionStart` is undocumented but
   confirmed live on CLI 1.1.1 (probe 2026-07-12): fires once per
   conversation start, input = the common fields only, respond `{}` (the
   only verified response). Handler fields: `type`
   (optional, only `"command"`), `command` (required; runs via `sh -c`, cwd =
   the hooks.json directory — reference scripts as `node ./scripts/x.mjs`;
   `${PLUGIN_ROOT}` expands to an EMPTY string on CLI 1.1.1 and kills the
   hook), `timeout` (seconds; **default 30** — set 10–15 explicitly, hooks
   block the agent loop synchronously).
3. Wire contracts (stdin/stdout JSON, camelCase keys; common input:
   `conversationId`, `workspacePaths[]`, `transcriptPath`,
   `artifactDirectoryPath`, `modelName`):
   - **PreToolUse** — input has `toolCall.name/args` (e.g. `CommandLine`).
     Respond `{"decision": "allow"|"deny"|"ask"|"force_ask", "reason": "…",
     "permissionOverrides": ["command(npm test)"]}`. Legacy
     `allow_tool`/`deny_reason` still parses; emit both dialects during the
     transition (unknown keys are ignored) — `denyResponse()` in the
     scaffolded `io.mjs` does this.
   - **PostToolUse** — input carries `error` when the tool failed. Respond
     `{}` (do not try to inject here).
   - **PreInvocation** — respond `{"injectSteps": [{"userMessage": "…"} |
     {"ephemeralMessage": "…"} | {"toolCall": {...}}]}` or `{}` to stay
     silent. `ephemeralMessage` = transient system message.
   - **PostInvocation** — same input as PreInvocation; respond
     `{"injectSteps": [...], "terminationBehavior": "force_continue" |
     "terminate" | ""}` — the sanctioned keep-working mechanism.
   - **Stop** — input: `terminationReason` (`model_stop` |
     `max_steps_exceeded` | `error`), `fullyIdle`. Respond
     `{"decision": "continue", "reason": "…"}` to block the stop; anything
     else allows it.
4. The fail-open law: route every script through `runHook(handler, fallback)`
   (scaffolded `scripts/lib/io.mjs`) — catches everything, emits the fallback
   on any error, exits 0. A throwing hook breaks the user's session. Extract
   inputs via the adapter helpers (`commandLineOf`, `promptTextOf`, `cwdOf`,
   `editedFileOf`) — field names drift across builds.
5. Test both layers: unit-test the exported logic; e2e-test the script with
   `spawnSync(process.execPath, [script], {input: JSON.stringify(...)})`
   asserting exit 0 and the parsed response — including on junk input.

## Definition of Done

- Every hook script exits 0 and emits valid JSON on junk, empty, and
  malformed stdin.
- `lint` passes (named hooks, sane timeouts, scripts exist, fail-open) and
  `agy plugin validate` reports `hooks: N processed`, not `skipped`.
- Unit + e2e tests cover deny/allow (or inject/silent) paths.

## Constraints

- Only the single JSON response line goes to stdout.
- Hooks run synchronously — never exceed 15s without written justification.

## Rationalizations

- "My hook can just throw, the host handles it" → observed behavior: a
  failing hook degrades or breaks the session; fail-open or don't ship.
- "The docs are official now, I'll emit only the new response keys" → old
  preview builds are still out there and a deny they can't parse becomes an
  allow; emit both dialects until the legacy one dies (still parsed on
  1.1.1).
- "I'll namespace hooks by my plugin name because the loader needs it" → it
  doesn't; it's just a convention. The real structural error is an event name
  at the top level.
