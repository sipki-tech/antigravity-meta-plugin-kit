# Antigravity plugin internals (`agy 1.5.17+`)

The canonical knowledge registry of this kit: every loader contract, runtime
trap, and empirical probe result that `create.mjs`, `lint.mjs`, `probe.mjs`,
and the meta skills encode.

**Provenance tags** — every claim carries one:

- `[OFFICIAL 2026-11]` — directly from Google's built-in docs shipped inside
  `~/.gemini/antigravity-cli/builtin/` or verified via `agy plugin validate
  --strict --json` on CLI `1.5.17`.
- `[OBSERVED 2026-11]` — empirically confirmed by binary inspection or live
  isolated `agy -p` probes on `agy 1.5.17` / `Antigravity.app 2.35.1` /
  `Antigravity IDE.app 2.7.0`.
- `[MEDIUM]` — partial sighting requiring a fresh probe before relying on it.

When a future Antigravity update changes behavior, run
`node plugins/antigravity-meta-plugin-kit/scripts/probe.mjs --fast` (or
`--live`), update this file with a new observation date, and recalibrate
`scripts/lib/lint.mjs`.

## Engine architecture & discovery

`[OBSERVED 2026-11]` **Two Go engine binaries, one unified plugin loader:**

- **`~/.local/bin/agy`** (`1.5.17`) — CLI engine + `agy plugin validate` +
  `--hub` daemon.
- **`/Applications/Antigravity.app/Contents/Resources/bin/language_server`**
  (`2.35.1`) — Antigravity App engine, sharing a byte-for-byte identical
  `exa.hooks_pb` descriptor with `agy`.
- **`Antigravity IDE.app`** (`2.7.0`) removed its separate
  `language_server_macos_arm` binary and spawns `agy --hub` directly. The old
  July 2026 "two plugin worlds" split is gone.

`[OFFICIAL 2026-11]` **Discovery locations & priority (high -> low):**
1. Workspace discovery: `.agents/` (and `.agent/`, `_agents/`, `_agent/`)
   walking up from CWD to repo root. Both wrapped `.agents/plugins/<name>/` and
   flat `.agents/{skills,rules,agents,hooks.json,mcp_config.json}` load. Non-
   interactive `agy -p` requires `--add-dir <project>`.
2. Workspace declared JSON registries: `.agents/{plugins,skills,rules,agents,sidecars}.json`
   (since CLI 1.5.2, workspace registries cannot escape repo root via absolute
   paths, `../`, or symlinks).
3. Global discovery: `~/.gemini/config/plugins/<dir>/` (plus `~/.gemini/config/{skills,rules,agents,hooks.json,mcp_config.json}` and `~/.agents/skills/` added in 1.5.16).
4. Built-in customizations mounted by name.
5. Global declared JSON registries.

`[OFFICIAL 2026-11]` **Enablement & install tracking:**
- `installed_version.json` is **obsolete** (0 files across all Google plugins
  installed on disk). Any directory under `~/.gemini/config/plugins/<dir>/`
  with a valid `plugin.json` auto-loads.
- Active/disabled state lives strictly in `~/.gemini/config/config.json` under
  `plugins.<dir>.enabled` (keyed by **install directory name**, never
  `plugin.json`'s `name`; always wins over `"disabled": true` in `plugin.json`).
- `agy plugin install` performs an atomic swap, rejects escaping symlinks/FIFOs
  (1.5.6+), and records local/GitHub installs in
  `~/.gemini/config/import_manifest.json`.
- Deep links in UI use `customization://<dir>` (never `plugin://`).

## Manifest (`plugin.json`)

`[OFFICIAL 2026-11]` **Manifest paths & precedence:**
1. `.antigravity-plugin/plugin.json` (highest)
2. `.gemini-plugin/plugin.json`
3. `<plugin>/plugin.json` (root; filename check is case-insensitive)

Shadowed lower-priority manifests emit a warning. **All components (`skills/`,
`rules/`, `agents/`, `hooks.json`, `mcp_config.json`, `sidecars/`) MUST stay at
the plugin root**, never inside `.antigravity-plugin/`.

`[OFFICIAL 2026-11]` **Syntax trap (JSON vs JSONC):** the runtime loader
accepts JSONC (comments, trailing commas) and UTF-8 BOM, **but `agy plugin
install` requires strict JSON** — `agy plugin validate --strict` fails on
comments or trailing commas. Always commit strict JSON.

`[OFFICIAL 2026-11]` **Accepted top-level keys (0 warnings in `agy 1.5.17`):**
- `name` — strict lowercase kebab-case (global unique key; collisions drop one
  plugin silently; Marketplace rejects non-kebab-case).
- `displayName` (`display_name`) — UI title; avoid leading `"Antigravity"` for
  Marketplace.
- `version` — SemVer string (required for Marketplace listing).
- `description` — 1–2 sentences (120–160 chars for Marketplace search/cards).
- `logo` — plugin-relative `.png`, `.svg`, `.jpg`, `.jpeg`, or `.webp` (square
  >=128x128, ~10% transparent margin, NOT inside dot-prefixed dirs like
  `.github/`), or an `https://` URL on a Google domain (`google.com`,
  `gstatic.com`, `googleusercontent.com`, `googleplex.com`). Missing `logo`
  emits a `note` (passes `--strict`).
- `suggestedPrompts` (`suggested_prompts`) — up to **3** starter prompt chips
  (>3 or empty string warns).
- `author` — **string OR `{name, email?, url?}`** (`url` must be `https://`).
- `homepage` — `https://` URL.
- `repository` — `https://` URL string OR `{"type": "git", "url": "https://..."}`.
- `license` (SPDX string), `keywords` (`string[]`), `category` (non-empty
  string), `disabled` (bool — ships turned off until user enables).
- `skills` — string or `string[]` of extra skill paths relative to plugin root.
- `extensions` — `extensions["com.google.antigravity"].contextProviders`.

`[OFFICIAL 2026-11]` **Dead top-level keys (ignored & fail `--strict`):**
`interface`, `rules`, `hooks`, `agents`, `commands`, `mcpServers`, `sidecars`,
`variables`, `contextProviders`, `bundleMembers`. All emit `unknown field
"<k>" is ignored`.

## Subagents (`agents/`)

`[OFFICIAL 2026-11]` `[OBSERVED 2026-11]` **Markdown ONLY — TOML is dead:**
- Supported paths: `agents/<name>.md`, `agents/<name>/agent.md` (lowercase
  `agent.md` for Linux), and root `agents.json` (`{"entries":[{"path":"..."}]}`).
- **`agents/*.toml` is COMPLETELY IGNORED** (`agents: 0`) with **zero
  warnings** from `agy plugin validate` (blind spot caught by `lint.mjs`).
- `agents/<name>/agent.json` warns `never loaded by this build` (internal
  Google builds only).
- Agents do **not** become `/slash` commands (`GetAgentSlashCommands` does not
  exist). Wrap deterministic `/cmd` triggers in a thin skill with
  `disable-model-invocation: true`.

### Frontmatter schema & verified runtime behavior

| Key | Type / Allowed Values | Verified Behavior (`agy 1.5.17`) |
|---|---|---|
| `name` | string *(required)* | Cannot collide with built-ins (`self`, `browser`, `research`, `deepagent`, `review-agent`, `image-generator`). |
| `description` | string *(required)* | Routing surface injected into the parent agent's subagent list. |
| `subagent` / `mainAgent` | bool (default `true`) | `mainAgent: false` keeps pure subagents out of `/agents` and `agy --agent`. |
| `model` | **`inherit` \| `flash_lite` \| `flash` \| `pro`** (or omit) | **HARD ERROR** on any concrete model ID (`gemini-3.1-pro`, `gemini-4-neon-high`, `auto`) — skips the agent! |
| `commandExecutionPolicy` | **`off` \| `auto` \| `eager` \| `sandbox`** | **HARD ERROR** on any other value — skips the agent! |
| `tools` | **YAML `[]string`** (CSV string hard-errors!) | Must use native `agy 1.5.17` tool names (see below). |
| `inheritMcp` | bool (default `true`) | Set `false` to prevent inheriting all user MCP tools into the subagent. |
| `mcpServers` | `[]object` | List of MCP server objects (strings or map hard-error). |
| Other keys | `skills`, `preloadSkills`, `rules`, `hooks`, `plugins`, `agents`, `inheritCustomizations` (mutually exclusive with `inheritScopes`), `hidden`, `disabled`, `icon`, `logo` | Unknown keys like `nickname_candidates` are silently ignored. |

### Verified live `model:` tier mapping (`[OBSERVED 2026-11]`, live probe)

When the parent session ran on `gemini-4-neon-xhigh`:
- `model: inherit` (or omitted) -> **`gemini-4-neon-xhigh`** (keeps parent Neon/Carbon/Argon/Claude!)
- `model: pro` -> **`gemini-4-hydrogen-tiered-xhigh`**
- `model: flash` -> **`gemini-4-hydrogen-tiered-high`**
- `model: flash_lite` -> **`gemini-3.5-flash-lite`**

### Verified live `tools:` & `inheritMcp` traps (`[OBSERVED 2026-11]`, live probes)

- **Native tool registry:** `read_file`, `edit_file`, `write_file`,
  `run_command`, `manage_task`, `search_web`, `invoke_subagent`,
  `define_subagent`, `manage_subagents`, `send_message`, `ask_question`,
  `update_steps`, `schedule`, `run_workflow`, `swarm`, `call_mcp_tool`,
  `list_resources`, `read_resource`, `generate_image`.
- **Omitted `tools:`** grants: `send_message`, `read_file`, `search_web`,
  `schedule`, `generate_image`, `manage_task` + inherited MCP (`call_mcp_tool`,
  `list_resources`, `read_resource` + eager MCP tools) — no write/shell tools.
- **Explicit `tools: [read_file, run_command]`** with `inheritMcp: false`
  grants ONLY those tools + messaging/task plumbing (`send_message`,
  `manage_task`, `list_resources`, `read_resource`), cleanly stripping
  `call_mcp_tool` and all eager MCP servers.
- **Unknown/misspelled tool name** passes `agy plugin validate --strict` but
  **fails fast at subagent startup**: `unknown component: tool "<x>" not found
  in registry` (blind spot caught by `lint.mjs`).
- **Legacy IDE aliases:** `view_file` -> `read_file`, `replace_file_content` ->
  `edit_file`, **`grep_search` -> SILENTLY DROPPED (0 search tools!)**. Grant
  `run_command` + `commandExecutionPolicy: sandbox` for `rg`/`grep`.

## Skills (`skills/`) & deprecated `workflows/`

`[OFFICIAL 2026-11]`
- Location: `skills/<kebab-name>/SKILL.md`, optional `scripts/`, `examples/`,
  `resources/`, `references/`, plus optional `manifest.skills` and root
  `skills.json`.
- Full YAML frontmatter: `name`, `description` (supports multiline `>-`/`|`),
  `disable-model-invocation: true` (slash-only `/<name>`),
  `disable-slash-command: true`, `metadata.{icon,logo}`.
- **24,000-byte body cap** (frontmatter excluded): bodies above 24,000 bytes
  warn and are **truncated silently** at runtime.
- **`workflows/*.md` and `commands/` are NEVER LOADED in native plugins**
  (validator warns and fails `--strict`). Convert every slash command to a
  skill with `disable-model-invocation: true`. Dynamic workflows in `1.5.17`
  are Python scripts executed via `run_workflow`.

## Rules (`rules/`)

`[OFFICIAL 2026-11]` `[OBSERVED 2026-11]`
- Plugins load rules **only** from `rules/` (flat 1-level scan) or root
  `rules.json`. Root `AGENTS.md` / `GEMINI.md` in a plugin warns `never loaded`.
- **Two valid forms:**
  1. Exact uppercase **`rules/AGENTS.md`** or **`rules/GEMINI.md`** (plain
     Markdown, no frontmatter, always-on — officially recommended; lowercase
     `agents.md`/`gemini.md` **hard-errors**!).
  2. **`rules/<name>.md`** with YAML frontmatter `trigger:` set to one of:
     `always_on`, `model_decision` (needs `description`), `glob` (needs
     `globs`/`glob`), or `manual` (App `@`-mention only). Missing/invalid
     `trigger` is a **hard error** (`rules: 0`). `rules/README.md` without
     frontmatter is skipped.
- **`globs:` syntax trap:** must be a **comma-separated YAML string** (a YAML
  array hard-errors: `cannot unmarshal !!seq into string`). Antigravity splits
  on commas before `doublestar/v4` matching, so **`**/*.{ts,tsx}` breaks**
  (validator does not warn; `lint.mjs` warns — expand to `"**/*.ts, **/*.tsx"`).
- **Size & token limits:** **24,000 bytes** per file (after `@[label](path)`
  includes) + **20,000-token** aggregate `defaultRulesBudget` across always-on
  rules (over-budget rules demote to path pointers). Keep always-on rules under
  ~100–150 lines.

## Lifecycle hooks (`hooks.json`)

`[OFFICIAL 2026-11]` `[OBSERVED 2026-11]`
- Must live at `<plugin>/hooks.json` (`hooks/hooks.json` is never loaded in
  native plugins) and be **strict JSON** (comments/trailing commas hard-error).
- Top-level keys are **named hook groups** (`"enabled": false` supported; event
  names at top level hard-error).
- **Exactly 6 native events:**
  - Grouped (`[{"matcher": "<regex>", "hooks": [...]}]`): `PreToolUse`,
    `PostToolUse` (flat handlers never run; invalid regex or non-Antigravity
    tool names warn).
  - Flat (`[handler, ...]`): `SessionStart`, `PreInvocation`, `PostInvocation`,
    `Stop` (matcher groups hard-error).
- **Handler fields:** `type: "command"`, `command` (`sh -c`, cwd = plugin root
  -> use `node ./scripts/x.mjs`; `${PLUGIN_ROOT}` / `$PLUGIN_ROOT` in commands
  fail `--strict`; `PLUGIN_ROOT` and, for installed plugins, `PLUGIN_DATA` are
  exported in env), `timeout` (int seconds, default 30, process group killed on
  timeout since 1.5.14).
- **`PromptHook` runtime trap (`[OBSERVED 2026-11]`):** `{"type": "prompt",
  "prompt": "...", "model": "flash"}` **passes `agy plugin validate --strict`**,
  but **fails every tool call at runtime** (`prompt hooks are not currently
  supported`). `lint.mjs` fails on `type: "prompt"`.

### Verified wire contracts (camelCase protojson, live probes 2026-11-26)

- **Common stdin (all 6 events, confirmed on `SessionStart` too):**
  `conversationId`, `workspacePaths`, `transcriptPath`,
  `artifactDirectoryPath`, `modelName`, `lastUserInput`, `hookEventName`, `cwd`
  (agent working dir).
- **`SessionStart`:** output `{}` or `{"injectSteps": [...]}`.
- **`PreToolUse`:** input adds `toolCall: {id, name, args}`, `stepIdx`.
  Output: `{"decision": "allow"|"deny"|"ask"|"force_ask", "reason"?,
  "permissionOverrides"?, "overwrite"?}`.
  - `overwrite` is **live** (shallow top-level arg merge; tool output prefixed
    with `A pre-tool hook changed the arguments of this tool call before it
    ran. Changed: <keys>.`).
  - Undocumented `auto_approve` and `deny_unless_prior_grant` also work in
    `1.5.17`; legacy `allow_tool`/`deny_reason` fallback still works in `1.5.17`
    but is superseded by `decision`/`reason`.
- **`PostToolUse`:** input adds `toolCall`, `stepIdx`, `error`. Output `{}`
  (proto `overwriteResult` is ignored in `1.5.17` command hooks).
- **`PreInvocation` & `PostInvocation`:** input adds `invocationNum`,
  `initialNumSteps`. Output: `{"injectSteps": [...], "terminationBehavior":
  ""|"terminate"|"force_continue"}` (`force_continue` is `PostInvocation`
  only; `terminate` works on both).
  - Valid `injectSteps` items:
    - `{"systemMessage": {"systemMessage": "...", "metadata"?: {"user_markdown": "..."}}}`
    - `{"userMessage": "..."}`
    - `{"errorMessage": {"userMessage": "..."}}` (non-zero exit in `-p`)
  - `ephemeralMessage` is **deprecated** (use nested `systemMessage`).
  - **`injectSteps: [{"toolCall": ...}]` CRASHES the turn with exit 3**
    (`unknown injected step type: <nil>`) — never emit it!
- **`Stop`:** input adds `executionNum`, `terminationReason`
  (`NO_TOOL_CALL`, `MAX_INVOCATIONS`, `MAX_FORCED_INVOCATIONS`,
  `MAX_TOKEN_BUDGET_EXCEEDED`, `ERROR`, `USER_CANCELED`,
  `TERMINAL_STEP_TYPE`, `TERMINAL_CUSTOM_HOOK`, `INJECTED_RESPONSE`), `error`,
  `fullyIdle`, `continuationActive`. Output `{"decision": "continue",
  "reason": "..."}` or `{"decision": ""}`.
  - **Live `1.5.17` bug (`[OBSERVED 2026-11]`):** `continuationActive` stayed
    `false` on `executionNum: 1` and `2` after `{"decision": "continue"}`.
    Always guard loops with `continuationActive || executionNum > 0`.

## MCP (`mcp_config.json`), MCP Apps, `auth.json` & Sidecars

- **`mcp_config.json`** `[OFFICIAL 2026-11]`: JSONC supported; auto-namespaced
  `<plugin>_<server>`. Only **Stdio** (`command`, `args`, `env`, `cwd`; prefer
  `"command": "node"`) and **Streamable HTTP** (`url` or legacy alias
  `serverUrl`; **legacy HTTP+SSE `/sse` is unsupported** — validator does not
  warn on `/sse`, `lint.mjs` does). Never use `httpUrl` or `"type"` in native
  `mcp_config.json`.
  - **Exact variable expansion matrix:**
    - `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` expand ONLY in `args`, `env`, `cwd`
      (never `command`; never set `PLUGIN_ROOT` as an `env` key).
    - Per-server `variables: [{name, title?, description?, link?}]` (never at
      root!) expand ONLY in `command`, `args`, `env`, `url`, `headers`, `oauth`
      (never `cwd`); plugins with `variables` install **disabled**.
    - OS `${env:...}` is NOT expanded.
  - Tool controls: lazy by default (10 KB inline cap), `tools.<name>.{eager,
    background}` (`background` MUST be a string `"off"` | `"always"` — boolean
    `false` causes Go JSON unmarshaling to skip the entire server!),
    `enabledTools`, `disabledTools`, `timeoutSeconds` (`-1` disables).
  - OAuth 2.1 + PKCE `S256` + CIMD (`https://antigravity.google/oauth/mcp-client.json`):
    allowlist `https://antigravity.google/oauth-callback` (local CLI/App) and
    `https://antigravity.google.com/oauth/callback` (remote Marketplace).
- **MCP Apps (`SEP-1865`)** `[OFFICIAL 2026-11]`: `_meta.ui.resourceUri` ->
  `ui://` HTML (`com.google.antigravity/ui` `aux_pane`, `global`, `file`).
  `agy` CLI renders no iframes and ignores `_meta.ui.visibility` — always
  return clean plain-text `content`.
- **CLI + `auth.json` alternative** `[OBSERVED 2026-11]`: Google's own
  Workspace plugins (`gcalendar`, `gdocs`, `gdrive`, `gsheets`, `gslides`) ship
  a self-contained CLI in `scripts/` (or `bin/`) + `auth.json` (OAuth2 / API
  key: `providers.<id>.{type, domains, clis, oauth2?, delivery, env, identity?}`)
  + a lean `SKILL.md` instead of an MCP server. **Validator blind spot:**
  `agy plugin validate --strict` currently skips `auth.json` validation
  entirely (malformed providers return `findings: []`) — `lint.mjs` validates
  `auth.json` automatically.
- **Sidecars (`sidecars/<id>/sidecar.json` or root `sidecars.json`)**
  `[OFFICIAL 2026-11]`: namespaced `<plugin>/<id>`; `command` XOR `builtin`
  (`"schedule"` with `CRON_TZ`), `args`, `env`, `restart_policy`
  (`always` | `on-failure` | `never`), `display_name`, `description`,
  `has_web_ui`, `ui_config.views`, `agent_permissions`, `arguments`, `sandbox`.

## Distribution & `agy` CLI surface

`[OFFICIAL 2026-11]`
- `agy --version` (read-only and authoritative; `agy changelog` can lag).
- `agy plugin install <https-github-url | local-dir | plugin@marketplace>`,
  `uninstall`, `enable`, `disable`, `list [--json]`, `link <mp> <target>`,
  `validate [dir | plugin.json | .zip | github-url | marketplace.json] [--strict] [--json]`.
- `marketplace.json` `[OBSERVED 2026-11]`: `plugins[i].source` MUST be an
  object `{"type": "archive", "url": "https://...", "sha256": "<64-hex>"}`.
  String sources fail JSON unmarshaling, `"git"` and `"github"` fail with
  `unsupported source type`, and missing `sha256` skips the plugin (`source has
  no sha256`). Validated offline by `meta-kit.mjs lint --strict marketplace.json`.
- Key CLI flags: `--add-dir`, `--agent`, `--model`, `--effort`, `--mode
  auto|accept-edits|plan`, `-p/--print`, `--print-timeout` (default `0s`),
  `--output-format text|json|stream-json`, `--json-schema`,
  `--disable-slash-commands`, `--settings`, `--sandbox`,
  `--dangerously-skip-permissions`.

## Refuted & superseded assumptions

- `installed_version.json` is required for IDE loading -> **obsolete** (`IDE
  2.7.0` delegates to `agy --hub`; enablement lives in `config.json`).
- `plugin.json` requires `interface`, `rules`, `hooks`, and object-only
  `author` -> **superseded** (flat schema; `interface`/`rules`/`hooks` warn
  and fail `--strict`; `author` accepts string or object).
- `agents/*.toml` is the primary subagent format -> **dead** (silently ignored
  by `agy 1.5.17`; Markdown `.md` only).
- `model: pro` runs the strongest frontier model -> **false on `1.5.17`** (`pro`
  maps to `gemini-4-hydrogen-tiered-xhigh`; `inherit` keeps Neon/Carbon/Argon).
- `workflows/*.md` ship slash commands in plugins -> **dead** (never loaded in
  plugins; use skills with `disable-model-invocation: true`).
- `Stop` uses `terminationReason: "model_stop"` -> **false** (`NO_TOOL_CALL`).
- `PreInvocation` supports `injectSteps: [{"toolCall": ...}]` -> **crashes
  with exit 3** in `1.5.17`.
- `type: "prompt"` hooks work because `agy plugin validate --strict` accepts
  them -> **false** (runtime error `prompt hooks are not currently supported`).
- Remote MCP uses SSE (`serverUrl: .../sse`) -> **unsupported** (Streamable
  HTTP only).
