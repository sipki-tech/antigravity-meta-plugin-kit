# Subagents

English | [Русский](agents.ru.md)

Subagents let a plugin delegate bounded, specialist work (auditing, hook design,
research, verification) into a separate conversation with its own system prompt,
model tier, shell policy, and tool surface.

In Google Antigravity `1.5.17+`, subagents are authored in **Markdown** — never
TOML. Every contract below was verified against `agy plugin validate --strict`
and live isolated `agy -p` probes.

## File locations and why TOML is dead

Antigravity loads plugin subagents from three locations at the plugin root:

- `agents/<name>.md` — single-file definition (recommended for most subagents).
- `agents/<name>/agent.md` — directory form when bundling helper scripts or
  references beside the prompt. Keep the filename lowercase `agent.md` so Linux
  filesystems match.
- `agents.json` — optional JSON registry (`{"entries": [{"path": "..."}]}`) for
  custom relative paths.

Two legacy formats do **not** work in public plugins:

- **`agents/*.toml` is completely dead:** `agy 1.5.17` silently skips `.toml`
  files (`agents: 0`) and `agy plugin validate --strict` emits **zero
  warnings**. `lint.mjs` flags every `agents/*.toml` file as a hard `FAIL`.
- **`agents/<name>/agent.json` is internal-only:** the validator warns that
  `agent.json` is never loaded in public builds.

## Canonical Markdown frontmatter

Every agent Markdown file starts with YAML frontmatter followed by the system
prompt in the body:

```markdown
---
name: my-plugin-reviewer
description: >-
  Audits changed files for policy violations. Delegate when reviewing diffs
  or auditing plugin payloads; do not use for editing code.
subagent: true
mainAgent: false
model: inherit
inheritMcp: false
commandExecutionPolicy: off
tools:
  - read_file
---

# Role

You are a read-only policy reviewer. Inspect the files named in the prompt and
return concrete `file:line` findings. Never claim to have edited files.
```

Supported frontmatter fields:

| Field | Type / Values | Behavior in `agy 1.5.17+` |
|---|---|---|
| `name` | kebab-case string *(required)* | Unique identifier. Cannot collide with built-ins (`self`, `browser`, `research`, `deepagent`, `review-agent`, `image-generator`). |
| `description` | string *(required, multiline `>-` supported)* | Routing summary injected into the parent agent's subagent catalog. State **when to delegate** and **when not to**. |
| `subagent` | boolean (default `true`) | Exposes the agent to `invoke_subagent`. |
| `mainAgent` | boolean (default `true`) | Set `false` for pure subagents so they do not clutter `/agents` or `agy --agent`. |
| `model` | `inherit` \| `flash_lite` \| `flash` \| `pro` (or omit) | Concrete model IDs (such as `gemini-4-neon-high` or `auto`) **hard-error** and skip the agent completely. |
| `commandExecutionPolicy` | `off` \| `auto` \| `eager` \| `sandbox` | Any other value **hard-errors** and skips the agent. |
| `tools` | YAML `[]string` | Comma-separated strings hard-error. See tool rules below. |
| `inheritMcp` | boolean (default `true`) | Set `false` so the subagent does not inherit all of the user's MCP servers and schemas. |
| `mcpServers` | `[]object` | Optional list of agent-scoped MCP server objects (strings or maps hard-error). |
| `skills`, `preloadSkills`, `rules`, `hooks`, `plugins`, `agents` | YAML lists | Optional per-agent scoping of bundled components. |
| `inheritCustomizations` | boolean | Mutually exclusive with `inheritScopes`. |
| `hidden`, `disabled`, `icon`, `logo` | metadata | Optional UI metadata; unknown keys are ignored silently. |

## Choosing `model:` (live `agy 1.5.17` tier mapping)

Antigravity accepts **only** the four abstract tiers (`inherit`, `flash_lite`,
`flash`, `pro`) or omitting `model:`. Live probes on `agy 1.5.17` (parent
session running `gemini-4-neon-xhigh`) resolved the tiers as follows:

| `model:` value | Observed runtime model | When to use |
|---|---|---|
| `inherit` *(or omitted)* | **`gemini-4-neon-xhigh`** (exact parent model: Neon, Carbon, Argon, or Claude) | **Default for specialist subagents** (auditors, architects, hook designers, security reviewers). |
| `pro` | `gemini-4-hydrogen-tiered-xhigh` | Explicit high-reasoning Hydrogen tier when you specifically do *not* want the parent's model. |
| `flash` | `gemini-4-hydrogen-tiered-high` | Fast, cheaper multi-step work (scouts, summarizers, log parsers). |
| `flash_lite` | `gemini-3.5-flash-lite` | High-volume classification, trivial extraction, and formatting. |

> **Important trap:** Do **not** assume `model: pro` selects Neon or Carbon. If
> the user is running a frontier parent model, `model: pro` actually switches
> the subagent to Hydrogen xhigh. Use `model: inherit` whenever you want full
> parent capability.

## Restricting capabilities: `tools:`, `inheritMcp`, and `commandExecutionPolicy`

Tight capability scoping makes subagents faster, cheaper (smaller tool schemas),
and safer:

1. **Always set `inheritMcp: false`** unless the subagent explicitly needs the
   user's MCP servers. Live probes confirmed `inheritMcp: false` cleanly strips
   `call_mcp_tool` and all eager MCP tool declarations from the child prompt.
2. **Choose the minimal `commandExecutionPolicy`:**
   - `off` — no shell commands (pair with `tools: [read_file]` for pure
     reviewers and designers).
   - `sandbox` — read-only/sandboxed shell (ideal for scouts running `rg`,
     `probe.mjs`, or `agy plugin validate`).
   - `auto` — standard permission prompts when shell is needed.
   - `eager` — auto-approve safe commands (avoid unless truly necessary).
3. **Always list `tools:` explicitly** as a YAML array. Omitting `tools:` grants
   a default read-only bundle (`read_file`, `search_web`, `schedule`,
   `generate_image`, `manage_task`, `send_message`) plus inherited MCP tools.

### Native tool registry

Only these native `agy 1.5.17` tool names are registered:

- **Files & shell:** `read_file`, `edit_file`, `write_file`, `run_command`,
  `manage_task`
- **Web & media:** `search_web`, `generate_image`
- **Agent & workflow:** `invoke_subagent`, `define_subagent`,
  `manage_subagents`, `send_message`, `ask_question`, `update_steps`,
  `schedule`, `run_workflow`, `swarm`
- **MCP:** `call_mcp_tool`, `list_resources`, `read_resource`

Runtime automatically wires messaging/task plumbing (`send_message`,
`manage_task`) alongside your explicit list.

### Legacy aliases and silent traps

`agy plugin validate --strict` **does not validate tool names** — this is one of
the sharpest runtime blind spots caught by `lint.mjs`:

- **Any unknown or misspelled tool name** passes `--strict`, then **crashes
  subagent startup at runtime** with:
  `unknown component: tool "<name>" not found in registry`.
- **Legacy IDE aliases:** `view_file` silently remaps to `read_file` and
  `replace_file_content` remaps to `edit_file`, **but `grep_search` is silently
  dropped** — leaving the subagent with **zero search tools**. To let a subagent
  search a codebase, grant `run_command` with `commandExecutionPolicy: sandbox`
  (so it can run `rg` or `grep`).

## Visibility: `subagent` vs `mainAgent` and slash commands

- Set `subagent: true` and `mainAgent: false` for internal specialists invoked
  via `invoke_subagent`.
- Set `mainAgent: true` only when users are meant to launch the agent directly
  with `agy --agent <name>` or switch to it in `/agents`.
- **Agents never become `/slash` commands.** If you want users to invoke a
  subagent deterministically via `/my-plugin-audit`, add a thin skill wrapper at
  `skills/my-plugin-audit/SKILL.md` with `disable-model-invocation: true` whose
  body instructs the parent agent to invoke your subagent:

```markdown
---
name: my-plugin-audit
description: Run the read-only my-plugin-reviewer subagent on the current workspace.
disable-model-invocation: true
---

# /my-plugin-audit

Invoke the `my-plugin-reviewer` subagent via `invoke_subagent` with the user's
target path (or the current workspace root if omitted), then present its
`file:line` findings clearly without re-running the audit yourself.
```

## Prompt design for reliable delegation

A subagent starts with an empty conversation — it sees **only** its system
prompt and the prompt string the parent passes to `invoke_subagent`. Design the
body around four elements:

1. **Concrete role & scope:** state exactly what the subagent owns and what is
   out of bounds.
2. **Exact procedure:** 3–5 numbered steps that match the declared `tools:`
   (never tell a `tools: [read_file]` agent to run shell commands).
3. **Structured return format:** define the exact output schema (for example:
   `FAIL` / `WARN` / `PASS` findings with `file:line` citations, or exact JSON).
4. **Honesty boundary:** tell the subagent to report missing files or blocked
   checks directly instead of guessing.

## Checklist

- [ ] Saved as `agents/<name>.md` or `agents/<name>/agent.md` (zero `.toml` files).
- [ ] `name` does not collide with built-ins; `description` states when to
      delegate and when not to.
- [ ] `model:` is `inherit`, `flash_lite`, `flash`, or `pro` (no concrete IDs).
- [ ] `commandExecutionPolicy:` is `off`, `auto`, `eager`, or `sandbox`.
- [ ] `tools:` is a YAML array of verified native tool names (no `grep_search`
      or typos).
- [ ] `inheritMcp: false` set unless user MCP servers are intentionally needed.
- [ ] Pure subagents set `mainAgent: false`; any `/cmd` entry point uses a
      `disable-model-invocation: true` skill wrapper.
- [ ] Both `lint.mjs --strict` and `agy plugin validate --strict --json` report
      zero findings.

Next: [Lifecycle hooks](hooks.md) · [Skills](skills.md) · [Internals](../internals.md)
