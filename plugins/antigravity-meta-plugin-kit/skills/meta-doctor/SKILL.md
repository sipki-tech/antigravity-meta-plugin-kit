---
name: meta-doctor
description: >-
  Diagnose the local Google Antigravity installation (~/.gemini/config/plugins/,
  config.json, and workspace .agents/) for plugin collisions, disabled
  mismatches, runtime traps, and hard truncation/budget caps.
disable-model-invocation: true
---

# /meta-doctor

Run a read-only diagnostic pass on the current workspace and local Antigravity
plugin environment.

## Procedure

1. Run the kit's read-only `doctor.mjs` script (where `$KIT` is
   `~/.gemini/config/plugins/antigravity-meta-plugin-kit`, or
   `./plugins/antigravity-meta-plugin-kit` inside a checkout):
   ```bash
   node "$KIT/scripts/meta-kit.mjs" doctor --workspace "<cwd>" --json
   ```
   Never modify `~/.gemini/config/` or installed plugins automatically.
2. Group findings for the user by severity (`error`, `warn`, `info`):
   - **Collisions:** duplicate plugin names (silent drops) or shadowed skills /
     subagents (winner -> shadowed path).
   - **Runtime traps in enabled plugins:** `agents/*.toml`, unknown `tools:` /
     dead `grep_search`, `PromptHook` runtime failures, unguarded `Stop` hooks,
     global `Stop` hooks firing across unrelated workspaces, `/sse` MCP URLs,
     `{a,b}` globs, or malformed `auth.json`.
   - **Hard platform limits:** files over 24,000 bytes (silent truncation) or
     active `always_on` rules approaching/exceeding the 20,000-token
     `defaultRulesBudget` (demotion to path pointers).
3. For each finding, propose the exact minimal command or edit to resolve it
   (such as `agy plugin disable <dir>` or the exact file path to fix).
