# Antigravity plugin internals

The canonical knowledge file of this kit: every trap, contract, and convention
we build the scaffolder, linter, and skills on.

**Provenance tags** — every claim carries one:

- `[OFFICIAL 2026-07]` — from Google's own docs shipped inside the CLI
  (`~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/`,
  CLI 1.0.16) or verified against the `agy` binary / `agy plugin validate`.
- `[OBSERVED 2026-07]` — empirically confirmed on the Antigravity preview by
  debugging real installs; not (yet) in official docs.
- `[MEDIUM]` — partially confirmed (binary strings, single sighting); probe
  before relying on it.

Preview APIs drift: when reality disagrees with this file, trust reality,
update the entry with a new observation date, and recalibrate the linter (the
dogfood CI job keeps rules honest against the reference payload,
[antigravity-kit](https://github.com/sipki-tech/antigravity-kit)).

## The two plugin worlds

`[OFFICIAL 2026-07]` Plugins load through two distinct surfaces with different
expectations:

1. **IDE plugin-manager world** — `~/.gemini/config/plugins/<name>/`
   (mirror: `~/.gemini/antigravity-cli/plugins/<name>/` when that dir exists).
   Rich `plugin.json` (author object, `interface` block), managed installs,
   `installed_version.json`. Google's own plugins live here; some ship a
   minimal manifest (flutter's is literally `{"name": "flutter"}`), but the
   plugin-manager UI renders the rich fields when present.
2. **CLI customization-root world** — `.agents/plugins/<name>/` in a project
   (also `.agent/`, `_agents/`, `_agent/`) or `~/.gemini/config/` globally.
   Officially, `plugin.json` needs only an optional `name` (defaults to the
   directory name); components sit at fixed relative paths: root
   `hooks.json`, `mcp_config.json`, `rules/*.md`, `skills/<name>/SKILL.md`.

This kit's linter enforces an **authoring profile** for world 1 (the strict
manifest rules below); a payload that passes it also satisfies world 2.

`[OBSERVED 2026-07-06]` The plugin machinery of both apps lives in their Go
sidecars (`Antigravity.app/Contents/Resources/bin/language_server`,
`Antigravity IDE.app/…/extensions/antigravity/bin/language_server_macos_arm`)
— the `installed_version.json` literal sits there, not in the Electron/JS
layers. All three binaries share the same five hook events; `SessionStart`
is absent from every one of them (the only matches are TLS internals in agy
and JS pan-gesture handlers in the app bundles). A `gemini-extension.json`
found in some Google plugin dirs is referenced only by agy's
import-from-gemini path — a Gemini CLI compatibility artifact, not something
the Antigravity loader needs `[MEDIUM]`.

## Loader traps

### 1. `installed_version.json` — the silent-ignore trap

`[OBSERVED 2026-07]` The IDE plugin manager writes `{"version": "<semver>"}`
into every installed plugin dir; the loader uses it to recognize the plugin as
installed. A raw copy without it is **silently ignored** — no error, no log.
Any installer must write it; never commit it to the payload.
*Covered by:* installer template writes it; lint warns/notes; scaffolded
`verify` checks it.

### 2. `author` must be an object

`[OBSERVED 2026-07]` `"author": "name"` (a bare string) can trip plugin
validation in the IDE world. Use `"author": {"name": "..."}` (optional
`email`). *Covered by:* lint check; template.

### 3. Skills live inside the plugin directory

`[OFFICIAL 2026-07]` `<plugin>/skills/<skill>/SKILL.md`. There is no global
skills shim; global skills go to `~/.gemini/config/skills/` as their own
customization, not via plugins. *Covered by:* template layout; `meta-skills`.

### 4. `hooks.json` — root of the plugin, named hooks

`[OFFICIAL 2026-07]` The official location is the **plugin root**
(`plugins/<name>/hooks.json`), and `agy plugin validate` looks only there
(it reports `hooks: skipped (not found)` for a payload that keeps hooks in
`hooks/hooks.json`). The IDE world additionally honors the manifest's `hooks`
path field `[OBSERVED 2026-07]`.

Top-level keys are **hook names** — arbitrary strings, not the plugin name.
Named hooks from all configs/plugins are merged; using your plugin name as the
hook name is this kit's convention to avoid collisions, not a requirement.
A top-level key that is an *event* name (`PreToolUse`, ...) is a structural
error — the classic mistake when porting Claude Code `settings.json` hooks.
Each named hook supports `"enabled": false` to disable it temporarily.
*Covered by:* lint checks (root-location warn, named-hooks structure);
template ships root `hooks.json`.

### 5. Useful `plugin.json` fields (authoring profile)

`[OBSERVED 2026-07]` `name`, `version` (semver), `description`, `author`
(object), `repository`, `license`, `keywords`, `skills` (path), `rules`
(path), `hooks` (path), `interface` (`{displayName, shortDescription,
category, capabilities[], defaultPrompt[], brandColor}` — plugin-manager UI).
`[OFFICIAL 2026-07]` Only `name` is required-ish (defaults to dir name); the
rest is the rich profile. *Covered by:* template; lint.

## Hook contracts

`[OFFICIAL 2026-07]` unless marked otherwise. All JSON keys use **camelCase**
(protojson). Hook commands receive JSON on stdin, answer JSON on stdout.

### Events — exactly five

| Event | Fires | Structure |
|---|---|---|
| `PreToolUse` | before a tool step | matcher group `{matcher, hooks:[...]}` |
| `PostToolUse` | after a tool step | matcher group |
| `PreInvocation` | before the model is called | flat handler list |
| `PostInvocation` | after tool calls finish | flat handler list |
| `Stop` | when the execution loop terminates | flat handler list |

`SessionStart` **does not exist** (community rumor; refuted against the CLI
binary, 2026-07 — only a TLS-internal `ClientSessionStartReq` matches).

### Handler fields

`type` (optional, defaults to `"command"`, the only supported type),
`command` (required; run via `sh -c` on Unix / `cmd /c` on Windows; `~`
expands; **cwd = the directory containing hooks.json**), `timeout` (seconds,
**default 30**; set 10–15 explicitly — hooks run synchronously and block the
agent loop). `statusMessage` is an IDE-world nicety `[OBSERVED 2026-07]`, not
an official field. Reserved: `overwrite` in PreToolUse (not implemented).

### Matchers (PreToolUse / PostToolUse only)

`""` or `"*"` = all tools; otherwise a regex (`run_command`,
`run_command|view_file`, `browser_.*`). Tool names are the lowercased
`CORTEX_STEP_TYPE_*` suffixes. Matchers on flat events are ignored.

### Common stdin fields

```json
{
  "conversationId": "…",
  "workspacePaths": ["/path/to/workspace"],
  "transcriptPath": "…/.gemini/antigravity/transcript.jsonl",
  "artifactDirectoryPath": "…/.gemini/antigravity/artifacts",
  "modelName": "auto"
}
```

The transcript/artifact directory segment differs per surface:
`antigravity-cli/` (CLI), `antigravity/` (Antigravity 2.0),
`antigravity-ide/` (IDE).

### PreToolUse

Input adds `toolCall.name`, `toolCall.args` (e.g. `CommandLine`), `stepIdx`.
Output:

```json
{ "decision": "allow" | "deny" | "ask" | "force_ask",
  "reason": "…", "permissionOverrides": ["command(npm test)"] }
```

`ask` prompts the user (respects the "Always Allow" cache); `force_ask`
ignores the cache. `[OBSERVED 2026-07]` The legacy dialect
`{"allow_tool": bool, "deny_reason": "…"}` is still parsed by current builds;
this kit's template emits **both** dialects until the legacy one dies (unknown
keys are ignored, so the pair is safe).

### PostToolUse

Input adds `stepIdx` and `error` (present if the tool failed). Output: an
**empty object `{}`**. (Earlier guidance to return `allow_tool: true` with an
injection payload is obsolete; injection here was never verified.)

### PreInvocation

Input adds `invocationNum`, `initialNumSteps`. Output:

```json
{ "injectSteps": [
    { "userMessage": "…" },
    { "ephemeralMessage": "…" },
    { "toolCall": { "name": "…", "args": {} } } ] }
```

`ephemeralMessage` is a transient system message. Empty `{}` = silent no-op.

### PostInvocation

Input: same shape as PreInvocation. Output:

```json
{ "injectSteps": [], "terminationBehavior": "force_continue" | "terminate" | "" }
```

`force_continue` re-enters the loop — the sanctioned way to build
keep-working agents.

### Stop

Input: `executionNum`, `terminationReason` (`model_stop`,
`max_steps_exceeded`, `error`), `error`, `fullyIdle` (true when background
tasks are done). Output: `{"decision": "continue", "reason": "…"}` blocks the
stop (reason is injected as a system message); any other decision allows it.

### The fail-open law

`[OBSERVED 2026-07]` A throwing/non-zero hook degrades or breaks the host
session. Wrap everything (`runHook()` in the template `io.mjs`): on any
parse/internal error emit the allow/silent response and exit 0. Quote
`${PLUGIN_ROOT}` in commands — paths contain spaces. `${PLUGIN_ROOT}` is the
plugin dir `[OBSERVED 2026-07]`; official docs use hooks.json-relative
`./scripts/...` paths (cwd = hooks.json dir) — both work in plugins.

### Limitations

Only `type: "command"`; hooks are synchronous and block the loop; no HTTP or
prompt hooks yet.

## Other components

### Subagents — `agents/*.toml` and `agents/*.md`

`[OBSERVED 2026-07; validator-known, officially undocumented]`
`agy plugin validate` counts them (`agents: 3 processed` on the reference),
but no official doc describes the format. Two formats count:

**TOML** (the reference convention):

```toml
name = "kit-planner"                # matches the filename
description = "…"                   # shown in UI / routing
nickname_candidates = ["Planner"]   # optional aliases
model = "gemini-3.5-flash"          # per-agent model choice
developer_instructions = """…"""    # the system prompt
```

**Markdown** `[OBSERVED 2026-07-05, probe on CLI 1.0.16]` — matches the
community report of a JSON→Markdown transition in 1.0.16:

```markdown
---
name: md-agent              # matches the filename
description: what + when
---
The system prompt goes in the body.
```

*Covered by:* lint (line heuristics for both formats when `agents/`
exists); scaffold ships a TOML example only with `--with-agents`.

### Subagent runtime flow

`[OBSERVED 2026-07-05, binary strings of CLI 1.0.16]` How subagents actually
run (system prompts and messages embedded in the `agy` binary):

- The main agent spawns subagents via a spawn tool taking a `TypeName` and a
  `Prompt`; built-in types include `owl` — "a deep reasoning orchestrator
  with Planner, PlanReviewer, Researcher, InvestigationReviewer, Coder, and
  CodeReviewer subagents".
- The orchestrator composes **routines** — (parallelism, iteration,
  operation) triples: single vs parallel (spawn up to N subagents),
  non-iterative vs iterative (reviewer subagents as approval gates), over
  operations Planning / Investigation / Coding. Plan approval flows through
  an `implementation_plan.md` artifact with `request_feedback = true`.
- Read-only researcher subagents report back **via a `send_message` tool**;
  the parent reads an inbox (a "message inbox" tool exists: list / read
  full message).
- Write-capable Coder subagents work in an **isolated branched workspace**;
  parallel coders implement candidates that the parent compares/synthesizes.
- Task mode: a spawn flag runs subagents as a background batch that only
  notifies when ALL complete; no follow-up messaging in that mode, and
  branched workspaces are auto-deleted afterwards. Killing a subagent
  deletes its branched workspaces but preserves logs and artifacts.
- Every subagent's system prompt starts from "You are a subagent of
  Antigravity…"; plugin-defined `agents/*` supply the persona
  (`description` is the delegation surface, `developer_instructions`/body
  the system prompt, `model` the per-agent model).
- **Auto-delegation of plugin subagents is CONFIRMED** `[OBSERVED
  2026-07-06, strings of all three binaries: agy CLI, Antigravity 2.0
  language_server, Antigravity IDE language_server]`: a prompt template
  injected into the main agent lists every installed plugin with its
  skills and subagents ("Plugins are bundles of customizations… agents/: a
  directory containing subagents that can be invoked to help with tasks…
  You can use them just like regular skills or subagents"), rendering each
  agent's name + description. Your agent's `description` therefore routes
  delegation exactly like a skill description routes activation.
- Agents do **not** auto-surface as /slash-commands: the binary exposes
  `GetSkillSlashCommands` and `GetSystemSlashCommands`, but no agent
  equivalent. To give users a deterministic "/become-X" entry point, wrap
  the spawn in a workflow or skill whose body instructs the main agent to
  delegate to that subagent. (`/{agent_name}/` strings nearby are
  permission-grant patterns like `command(*)`, not routes.)

### `commands/`

`[OBSERVED 2026-07-05, probe]` A compatibility shim: `agy plugin validate`
reports `commands: N processed (converted to skills)` for both `.md` files
(frontmatter + body, Claude Code slash-command style) and `.toml` files. Write
native skills instead; `commands/` exists so `agy plugin import claude` has a
landing zone. An empty `mcpServers: {}` map, by the way, reports as
`skipped (not found)`.

### Registry files — `skills.json` / `plugins.json`

`[OFFICIAL 2026-07]` Register customizations outside default discovery
locations; both share one schema:

```json
{ "inherits": [ { "path": "/shared/skills.json",
                  "include_only": ["linter-.*"], "exclude": ["deprecated-.*"] } ],
  "entries":  [ { "path": "tools/agents/skills" } ] }
```

Path resolution: `/abs`, `~/home-relative`, otherwise workspace-relative
(repo root). Team pattern: commit skills + a workspace-relative
`.agents/skills.json`.

### Rules

`[OFFICIAL 2026-07]` `GEMINI.md` / `AGENTS.md` are discovered by walking up
from the CWD to the repo root; they are plain markdown without frontmatter,
always active for their directory scope, deduplicated by resolved path.
`[MEDIUM]` Rules under `.agents/rules/*.md` support frontmatter
`trigger: always_on | model_decision` (and likely a `glob` field — present in
binary struct tags); only `always_on` rules load unconditionally.

### Workflows

`[OBSERVED 2026-07]` Thin `.md` aliases with a `description` frontmatter that
become `/slash-commands` (`.agents/workflows/`; mirror `.agent/workflows/`
only when `.agent/` exists). Note: `agy plugin validate` does **not** check
workflows or rules — this kit's linter is the only gate there.
`[OFFICIAL 2026-07]` Skills themselves also surface as slash commands
(`GetSkillSlashCommands` in the binary).

### MCP — `mcp_config.json`

`[OFFICIAL 2026-07]` Global `~/.gemini/config/mcp_config.json` or per-plugin.
Two transports: stdio (`command`, `args`, `env`) and SSE (`serverUrl`).
Plugin servers activate with the plugin; tools are namespaced on conflict.
`[OBSERVED 2026-07]` Ship `"disabled": true` for entries whose `command` is
not a universally available launcher (anything but `node`/`npx`), so a
missing binary can't break sessions; auto-enable at install time when the
binary is detected. Install merge must never overwrite a user-configured
server; uninstall prunes only entries identical to what was installed.

### Loading priority & progressive disclosure

`[OFFICIAL 2026-07]` Priority (high→low): workspace discovery → workspace
declared configs → global (`~/.gemini/config/`) → built-in → global declared.
Skills are not loaded into context by default — only name+description are
injected; the body loads on activation. Hence: **the description is the
routing surface** (this kit's trigger-phrase discipline).

### Official skill style guide

`[OFFICIAL 2026-07]` Frontmatter: `name` (lowercase-hyphenated, = dir name),
`description` (third-person; states **what** it does and **when** to use).
Optional subdirs: `scripts/` (executable helpers, linked relatively),
`examples/`, `resources/` (assets/templates), `references/` (bulky docs —
progressive disclosure). Keep SKILL.md concise; include validation steps; do
not restate general knowledge.

### XML in prompts

`[OFFICIAL 2026-07]` SKILL.md itself is plain markdown — XML is not required.
XML-style sectioning (`<role>`, `<constraints>`, `<context>`, `<task>`,
`<output_format>`) is Google's recommended structure for long, multi-section
prompt **templates** (see the reference kit-spec templates). Put such
templates in `resources/` and link them; don't XML-ify the skill body.

## Artifacts

`[OBSERVED 2026-07-06, strings of CLI 1.0.16 / app language_servers]`
Artifacts (implementation plans, walkthroughs, task lists) are **ordinary
files written via the file tool into the artifact directory**
(`artifactDirectoryPath` from the hook input) — the file-write tool's own
description instructs: "When creating an artifact, always provide an
ArtifactMetadata."

- **Types** (proto enum): `IMPLEMENTATION_PLAN`, `WALKTHROUGH`, `TASK`,
  `OTHER`.
- **Key ArtifactMetadata fields**: `artifact_type`, `artifact_name`,
  `request_feedback` (surfaces the review UI), `user_facing`,
  `artifact_version`, `artifact_comments`.
- **The governing prompts live in the binary**: a Planning Mode Go template
  (conditional on `.IsAutonomous`) — research → write
  `implementation_plan.md` with `request_feedback = true` +
  `user_facing = true` ("the user will automatically see it — DO NOT
  re-summarize") → STOP for approval → execute → verify → write/update
  `walkthrough.md`; plus a `<PLAN>` block that dictates the exact plan
  format: `## [Goal Description]`, `## User Review Required` (GitHub
  alerts), `## Open Questions`, `## Proposed Changes` grouped by component
  with `#### [MODIFY]/[NEW]/[DELETE] <file>`, `## Verification Plan` →
  `### Automated Tests` / `### Manual Verification`. Walkthrough format:
  changes made / what was tested / validation results, embed
  screenshots/recordings, update rather than re-create. `/learn` follows the
  same pattern with a `learning_proposal.md` artifact.
- **A markdown validator** checks artifact files on write and feeds
  warnings back to the agent ("Markdown validation warnings were found in
  the artifact file you just created/edited").
- **Customization levers**: (1) Artifact Review Mode setting —
  `always-proceed | agent-decides | asks-for-review`, global and
  per-project `[OFFICIAL, app.md]`; (2) user rules — injected with "these
  rules take precedence over any following instructions", so
  GEMINI.md/AGENTS.md/plugin rules can extend or override the plan format
  declaratively; (3) skills/workflows imposing their own artifact
  conventions (the reference kit-spec pipeline does); (4) hooks —
  PreInvocation `ephemeralMessage` checklists, or a Stop hook reading
  `artifactDirectoryPath` to block stopping until a walkthrough exists.
  The embedded templates themselves are not editable; config fields like
  `disable_artifact_reminders`, `inject_artifact_reminder_threshold_map`,
  `artifact_review_mode`, `session_summary_prompt_override` exist in the
  proto surface `[MEDIUM — settings location unconfirmed]`.

## Distribution

### `agy plugin` CLI

`[OFFICIAL 2026-07]` `agy plugin install <target>` (supports
`plugin@marketplace`), `uninstall`, `enable`/`disable`, `list` (tracks
*imported* plugins only), `import [gemini|claude]` (imports Claude Code
plugins), `link <marketplace> <target>`, and **`validate [path]`** — the
official structural validator (checks skills/agents/commands/mcpServers/root
hooks.json; ignores rules/workflows/manifest style — run both validators).
CLI 1.0.9+: plugin installs resolve git submodules. Quirk: the built-in
`agy changelog` can lag several versions behind the actual binary (a 1.0.16
install lists 1.0.10 as its top entry) — trust `agy update`'s "current
version" line, not the changelog header.

### GitHub-only npx distribution

`[OBSERVED 2026-07]` `npx github:<owner>/<repo>` installs via `npm pack`,
which silently drops files named `.gitignore` and treats nested
`package.json` specially — template such files under safe names
(`_gitignore`, `_package.json`) and rename at generation. npx caches the
checkout; `#main` forces the latest commit.

## Refuted rumors

- `SessionStart` hook event — **does not exist** (binary check, 2026-07).
- "hooks.json must be namespaced by the plugin name" — top-level keys are
  arbitrary hook names; the plugin-name key is just a sane convention.
- "PostToolUse must return `{"allow_tool": true, ...inject}`" — official
  contract expects `{}`; injection via PostToolUse was never verified.
- "Skills require XML structure" — official skills are plain markdown; XML
  belongs to prompt templates in `resources/`.
