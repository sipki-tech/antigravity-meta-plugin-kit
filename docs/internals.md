# Antigravity plugin internals, as observed

Everything below was learned empirically by debugging real installs on the
**Antigravity preview, observed 2026-07**. Preview APIs drift: when reality
disagrees with this file, trust reality, update this file with a new
observation date, and recalibrate the linter (the dogfood CI job keeps the
rules honest against the reference payload,
[antigravity-kit](https://github.com/sipki-tech/antigravity-kit)).

Each trap notes what covers it: a lint check, a scaffold template, or docs
only.

## Loader traps

### 1. `installed_version.json` — the silent-ignore trap

The plugin manager writes `{"version": "<semver>"}` into every installed
plugin dir; the loader uses it to recognize the plugin as installed. A raw
copy without it is **silently ignored** — no error, no log, the plugin just
doesn't load. Any installer must write it; never commit it to the payload.
*Covered by:* installer template writes it; lint warns on a committed copy,
warns when a repo's installer never mentions it, and notes the trap in
payload-only mode; scaffolded `verify` checks it.

### 2. `author` must be an object

`"author": "name"` (a bare string) can trip plugin validation. Use
`"author": {"name": "..."}`.
*Covered by:* lint check `author is an object`; template.

### 3. Skills live inside the plugin directory

`~/.gemini/config/plugins/<name>/skills/<skill>/SKILL.md`. There is NO global
skills dir and NO shim mechanism.
*Covered by:* template layout; `meta-skills` skill.

### 4. `hooks.json` is namespaced by plugin name

The top-level key is the plugin name; hooks are defined under it.
*Covered by:* lint check `hooks.json namespaced by plugin name`; template.

### 5. Two hook-entry shapes coexist

Bare command-hook arrays (`PreInvocation`, `Stop`) and matcher groups
`{"matcher": "...", "hooks": [...]}` (`PreToolUse`, `PostToolUse`). A linter
or loader-shim that assumes one shape breaks on real plugins.
*Covered by:* `flattenHooks` in the linter handles both.

### 6. Useful `plugin.json` fields

`name`, `version` (semver), `description`, `author` (object), `repository`,
`license`, `keywords`, `skills` (path), `rules` (path), `hooks` (path),
`interface` (`{displayName, shortDescription, category, capabilities[],
defaultPrompt[], brandColor}` — what the plugin manager displays).
*Covered by:* template `plugin.json`; lint checks semver/interface/paths.

## Hook wire formats (preview — use thin adapters)

Field names drift between preview builds; extract inputs through adapter
helpers that probe known variants (see the scaffolded `scripts/lib/io.mjs`).

### PreInvocation

Input: `prompt`, or `steps[].userMessage` (take the last), or
`transcriptPath` (JSONL; scan recent user-role records as a fallback).
Inject context: `{"injectSteps": [{"userMessage": "..."}]}`. Stay silent: `{}`.

### PreToolUse (matcher e.g. `run_command`)

Command line at `toolCall.args.CommandLine`; cwd in the input.
Respond `{"allow_tool": true}` or
`{"allow_tool": false, "deny_reason": "..."}`.

### PostToolUse (file-edit matchers)

Edited path in the tool args. Injection here is **UNVERIFIED** (no-ops in
some builds); unknown response keys are ignored, so always return
`{"allow_tool": true, ...inject}` — it degrades to a plain allow.

### Stop

Respond `{"decision": "continue", "reason": "..."}` to keep the session
going, `{"decision": ""}` to allow stopping. Input may carry `fullyIdle`.

### Fail-open law and timeouts

Hook timeouts in `hooks.json`: 10–15s (lint allows up to 30). Scripts must be
fail-open: wrap everything; on any parse/internal error return the
allow/silent response and exit 0. A throwing hook breaks the host session.
Quote `${PLUGIN_ROOT}` in commands — paths contain spaces.
*Covered by:* `runHook()` in the template `io.mjs`; lint checks timeouts and
a fail-open marker (heuristic: `runHook(` or a try/catch wrapper).

## Layouts

### Global

Plugin: `~/.gemini/config/plugins/<name>/`. MCP config:
`~/.gemini/config/mcp_config.json`. Mirror: if
`~/.gemini/antigravity-cli/plugins/` exists, copy the plugin there too.

### Workspace

Plugin: `<project>/.agents/plugins/<name>/`. MCP:
`<project>/.agents/mcp_config.json`. Workflows:
`<project>/.agents/workflows/` (mirror into `.agent/workflows/` only when
`.agent/` already exists).
*Covered by:* installer template `paths.mjs`.

### Workflows

Thin `.md` aliases with a `description` frontmatter that point at skills;
they become `/slash-commands`.
*Covered by:* lint check `workflows have description frontmatter`.

### SKILL.md frontmatter

`name` + `description`; the description must contain the trigger phrase
("Use when the user says ..."). Plain Agent Skills format — portable to
Claude Code (`~/.claude/skills/`) and Codex (`~/.codex/skills/`).
*Covered by:* lint checks 8–10 (trigger heuristic: a quoted phrase or
"use when/for/always/this").

### MCP entries for optional binaries

Ship `"disabled": true` so a missing binary can't break sessions; auto-enable
only when the binary is detected at install time. On install, never overwrite
a server the user configured; on uninstall, prune only entries identical to
what was installed.
*Covered by:* lint check `mcp: non-builtin commands ship disabled`; installer
template merge/prune.

## Distribution traps

### npm-packlist drops `.gitignore`

`npx github:<owner>/<repo>` installs via `npm pack` of the git checkout,
which silently excludes files named `.gitignore` and treats nested
`package.json` manifests specially. Repos that template such files must store
them renamed (this repo uses `_gitignore`, `_package.json`) and rename on
generation.
*Covered by:* scaffolder renames; `meta-ship` skill.

### npx caches the checkout

`npx github:<owner>/<repo>#main <command>` forces the latest commit; without
`#main` users may run a stale cached version.
*Covered by:* CLI help; `meta-ship` skill.
