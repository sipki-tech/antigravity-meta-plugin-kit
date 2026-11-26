---
name: meta-agents
description: >-
  Author and design Google Antigravity custom agents and subagents (agents/*.md,
  agents/*/agent.md, agents.json) with exact agy 1.5.17+ model tiers, native
  tools, isolation flags, and delegation prompts. Use when the user says
  "meta-agents" or creates, edits, or debugs plugin agents or subagents. Don't
  use for general skills or lifecycle hooks.
---

# meta-agents — canonical Google Antigravity agents & subagents

## Goal

Ship Markdown agents (`agents/<name>.md` or `agents/<name>/agent.md`) that
load cleanly in `agy 1.5.17+`, delegate reliably, carry least-privilege native
tools, and never silently drop or crash at spawn time.

## Instructions

1. **File layout (Markdown ONLY):**
   - Supported: `agents/<name>.md`, `agents/<name>/agent.md` (lowercase
     `agent.md` for Linux), or root `agents.json` (`{"entries":[{"path":"..."}]}`).
   - **Never ship `agents/*.toml`** — `agy 1.5.17` silently skips `.toml` files
     (`agents: 0`) with **zero warnings**. Never ship `agent.json` (internal
     Google builds only).
2. **YAML frontmatter — exact `agy 1.5.17` schema:**
   ```markdown
   ---
   name: my-auditor
   description: >-
     Read-only code auditor. Use when reviewing diffs for bugs or policy gaps.
     Don't use for editing files or running builds.
   subagent: true
   mainAgent: false
   model: inherit
   inheritMcp: false
   commandExecutionPolicy: off
   tools:
     - read_file
   ---
   ```
   - `name` (required): unique; cannot be reserved (`self`, `browser`,
     `research`, `deepagent`, `review-agent`, `image-generator`).
   - `description` (required): injected directly into the parent agent's
     delegation roster. Write third-person **what + when + `Don't use for...`**.
   - `subagent` / `mainAgent` (booleans, both default `true`): set
     `mainAgent: false` for pure subagents so they don't clutter `/agents` or
     `agy --agent`.
   - **`model` — strictly 4 abstract tiers (or omit = `inherit`):**
     `inherit`, `flash_lite`, `flash`, `pro`. Any concrete model ID
     (`gemini-3.1-pro`, `gemini-4-neon-high`, `auto`) is a **hard error** that
     skips the agent!
     - **Verified live tier resolution (`agy 1.5.17`, Nov 2026):**
       - `inherit` -> exact parent model (**keeps Neon / Carbon / Argon / Claude**)
       - `pro` -> `gemini-4-hydrogen-tiered-xhigh`
       - `flash` -> `gemini-4-hydrogen-tiered-high`
       - `flash_lite` -> `gemini-3.5-flash-lite`
     - **Rule of thumb:** use `model: inherit` (or omit) for serious specialists
       so they don't downgrade from Neon/Carbon to Hydrogen; pick `flash` or
       `flash_lite` only for intentionally cheap routine workers.
   - **`tools` — MUST be a YAML list (`[]string`); CSV strings hard-error!**
     - Native `agy 1.5.17` tools: `read_file`, `edit_file`, `write_file`,
       `run_command`, `manage_task`, `search_web`, `invoke_subagent`,
       `define_subagent`, `manage_subagents`, `send_message`, `ask_question`,
       `update_steps`, `schedule`, `run_workflow`, `swarm`, `call_mcp_tool`,
       `list_resources`, `read_resource`, `generate_image`.
     - **Omitted `tools:`** grants a small read-only set (`read_file`,
       `search_web`, `schedule`, `generate_image`, `send_message`,
       `manage_task` + inherited MCP) — no write or shell tools.
     - **Unknown/misspelled tool** passes `agy plugin validate --strict` but
       **crashes subagent startup** (`tool "..." not found in registry`).
     - **`grep_search` trap:** silently dropped in `agy 1.5.17` (grants 0
       search tools!). For search/grep, grant `run_command` with
       `commandExecutionPolicy: sandbox`.
   - **`commandExecutionPolicy`**: strictly `off`, `auto`, `eager`, or `sandbox`
     (any other value skips the agent).
   - **`inheritMcp`** (default `true`): set `inheritMcp: false` on isolated
     subagents so they don't bloat context with all user MCP tools.
   - Additional supported keys: `skills`, `preloadSkills`, `rules`,
     `mcpServers` (YAML list of objects — not strings/map!), `hooks`,
     `plugins`, `agents`, `inheritCustomizations` (mutually exclusive with
     `inheritScopes`), `hidden`, `disabled`, `icon`, `logo`.
3. **System prompt body:** Antigravity prepends its own subagent preamble. Write
   only the role, hard constraints, and exact `send_message` output schema.
4. **Deterministic `/slash` entry point:** agents still do **not** become slash
   commands (`GetAgentSlashCommands` does not exist). Ship a thin skill
   `skills/<cmd>/SKILL.md` with `disable-model-invocation: true` that calls
   `invoke_subagent`.
5. **Validate with both gates:** `agy plugin validate --strict --json <payload>`
   AND `node "$KIT/scripts/lint.mjs" --strict .` (which catches `.toml`,
   `grep_search`, and unknown `tools:` entries).

## Definition of Done

- `agy plugin validate --strict` counts every agent (`agents N`) with 0 errors.
- `lint.mjs --strict` passes `agents valid` and `agent tools valid`.
- Every subagent declares explicit `model`, `subagent`/`mainAgent`,
  `inheritMcp`, `commandExecutionPolicy`, native `tools:`, and output format.

## Constraints

- Never use concrete model IDs, `agents/*.toml`, CSV `tools:`, or `grep_search`.
- One focused job per subagent; split reviewers from writers.

## Rationalizations

- "I'll set `model: pro` for my smartest auditor" -> on `agy 1.5.17`, `pro`
  resolves to Hydrogen xhigh, downgrading Neon/Carbon sessions; use `inherit`.
- "`agy plugin validate --strict` passed, so my `tools:` list is fine" ->
  `agy` does not validate tool names; a typo crashes at spawn and `grep_search`
  silently gives 0 search tools. Always run `lint.mjs --strict`.
