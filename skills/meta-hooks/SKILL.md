---
name: meta-hooks
description: Author Antigravity plugin hooks with the exact wire formats and the fail-open law. Use when the user says "meta-hooks" or works on hooks.json, PreInvocation, PreToolUse, PostToolUse, or Stop handlers.
---

# meta-hooks — hooks that never break the host session

## Goal

Ship hooks that speak the observed wire formats (2026-07, preview) and are
fail-open: any internal error resolves to the allow/silent response with
exit 0.

## Instructions

1. Register hooks in `hooks/hooks.json`, namespaced by the plugin name:
   ```json
   { "<plugin-name>": { "<Event>": [ ... ] } }
   ```
   Two entry shapes coexist: bare command hooks (used by `PreInvocation`,
   `Stop`) and matcher groups `{"matcher": "run_command", "hooks": [...]}`
   (used by `PreToolUse`, `PostToolUse`). Each command hook:
   `{"type": "command", "command": "node \"${PLUGIN_ROOT}/scripts/x.mjs\"",
   "timeout": 10, "statusMessage": "..."}`. Quote `${PLUGIN_ROOT}` — paths
   contain spaces. Timeouts: 10–15s.
2. Wire formats per event (preview — may drift; use thin adapters, never
   destructure blindly):
   - **PreInvocation** — input has `prompt`, or `steps[].userMessage` (take
     the last), or `transcriptPath` (JSONL; scan recent user records as a
     fallback). Inject context with
     `{"injectSteps": [{"userMessage": "..."}]}`; stay silent with `{}`.
   - **PreToolUse** (matcher e.g. `run_command`) — command line at
     `toolCall.args.CommandLine`, cwd in the input. Respond
     `{"allow_tool": true}` or `{"allow_tool": false, "deny_reason": "..."}`.
   - **PostToolUse** (file-edit matchers) — edited path in the tool args.
     Injection here is UNVERIFIED (no-ops in some builds); unknown response
     keys are ignored, so always return `{"allow_tool": true, ...inject}` —
     it degrades to a plain allow.
   - **Stop** — respond `{"decision": "continue", "reason": "..."}` to keep
     the session going, `{"decision": ""}` to allow stopping. Input may carry
     `fullyIdle`.
3. The fail-open law: route every script through a `runHook(handler,
   fallback)` wrapper (see the scaffolded `scripts/lib/io.mjs`) that catches
   everything, emits the fallback on any error, and exits 0. A throwing hook
   breaks the user's session.
4. Extract inputs through adapter helpers (`commandLineOf`, `promptTextOf`,
   `cwdOf`, `editedFileOf`) that probe the known input variants — preview
   builds disagree on field names.
5. Test both layers: unit-test the exported logic function directly; e2e-test
   the script with `spawnSync(process.execPath, [script], {input: JSON})`,
   asserting exit 0 and the parsed stdout — including on junk input.

## Definition of Done

- Every hook script exits 0 and emits valid JSON on junk, empty, and
  malformed stdin.
- `lint` passes: namespace, timeouts ≤30s, scripts exist, fail-open marker.
- Unit + e2e tests cover deny/allow (or inject/silent) paths.

## Constraints

- Never let a hook write to stdout except the single JSON response line.
- Never exceed a 15s timeout without a written justification; the session
  blocks on your hook.

## Rationalizations

- "My hook can just throw, the host handles it" → observed behavior: a
  failing hook degrades or breaks the session; fail-open or don't ship.
- "The input shape is documented, I'll destructure directly" → it isn't and
  it drifts between preview builds; adapters cost ten lines once.
- "PostToolUse injection worked in my build" → it no-ops in others; always
  shape the response to degrade to a plain allow.
