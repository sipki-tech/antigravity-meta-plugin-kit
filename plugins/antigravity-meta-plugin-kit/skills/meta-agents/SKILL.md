---
name: meta-agents
description: Author Antigravity plugin subagents in both validator-known formats and wire them for delegation. Use when the user says "meta-agents" or works on agents/*.toml, agents/*.md, subagent definitions, delegation, or /become-X entry points.
---

# meta-agents — subagents that actually get delegated to

## Goal

Ship plugin subagents (`agents/*`) that the main agent discovers and
delegates to, in a format `agy plugin validate` counts — despite the format
being officially undocumented (validator-known; observed on CLI 1.0.16 and
still intact on 1.1.1).

## Instructions

1. Pick a format — two count as of CLI 1.1.1:
   - **TOML** (the reference convention):

     ```toml
     name = "kit-planner"                # MUST match the filename
     description = "what + when"         # the delegation surface
     nickname_candidates = ["Planner"]   # optional aliases
     model = "gemini-3.5-flash"          # optional per-agent model
     developer_instructions = """
     The system prompt goes here.
     """
     ```

   - **Markdown** (confirmed by probe; matches the community report of a
     JSON→Markdown transition in 1.0.16):

     ```markdown
     ---
     name: md-agent              # MUST match the filename
     description: what + when
     ---
     The system prompt goes in the body.
     ```

2. Write the `description` like a skill trigger — it IS the routing surface.
   Auto-delegation is confirmed: a prompt template injected into the main
   agent lists every installed plugin with its agents' name + description
   ("You can use them just like regular skills or subagents"). State **what**
   the agent does and **when** to hand work to it, third person.
3. The system prompt (`developer_instructions` / markdown body) is layered
   onto Antigravity's own subagent preamble ("You are a subagent of
   Antigravity…") — write the persona and procedure, don't re-explain how to
   be an agent. Declare the rights honestly: read-only reviewer, terminal
   effects, or write access — the parent decides delegation based on the
   description, so a mislabeled agent gets misused.
4. Agents do **not** auto-surface as /slash-commands (the binary has
   `GetSkillSlashCommands` but no agent equivalent — still true on 1.1.1).
   For a deterministic "/become-X" entry point, ship a workflow whose body
   instructs the main agent to delegate to that subagent (this kit's
   `/meta-audit` → `meta-payload-auditor` is the pattern).
5. Validate on both gates:
   - `agy plugin validate <payload>` must report `agents: N processed`.
   - This kit's `lint` checks both formats: `name` present and matching the
     filename, `description` present, balanced `"""` in TOML.
   - `agy agents` (CLI 1.1.1+) lists the agents live sessions can use;
     `agy --agent <name>` selects one for a session.

## Definition of Done

- `agy plugin validate` counts every agent; `lint` passes `agents/*
  minimally valid`.
- Each description names its trigger conditions and its rights.
- Any user-facing entry point exists as a workflow wrapper, not as an
  assumed slash command.

## Constraints

- Keep `name` = filename — the one invariant both formats share.
- The format is undocumented: re-probe after CLI updates (see the
  [researching guide](https://github.com/sipki-tech/antigravity-meta-plugin-kit/blob/main/docs/guides/researching-antigravity.md))
  before relying on new fields.

## Rationalizations

- "The agent will show up as /agent-name, no wrapper needed" → refuted
  against the binary: no `GetAgentSlashCommands` exists (checked 1.0.16 and
  1.1.1). Ship a workflow wrapper.
- "The description is internal metadata, I'll keep it short" → it is the
  delegation surface rendered into the main agent's prompt; a vague
  description means your agent never gets picked.
- "TOML is the official format, markdown is a hack" → neither is official;
  both are validator-known. Markdown was confirmed by probe and Google's own
  transition points that way.
