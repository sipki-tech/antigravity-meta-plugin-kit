# Subagents: agents/*.md

*English | [Русский](agents.ru.md)*

> **Format status:** validator-known, officially undocumented (2026-07).
> `agy plugin validate` counts `agents/` entries, but no official doc
> describes the fields. Everything below is the observed convention from
> working plugins — re-validate after Antigravity updates.

A subagent is a specialized persona your plugin brings along: its own name,
its own system prompt, its own model. The main agent can delegate subtasks
to it (the reference antigravity-kit ships three: a planner, an architect,
and a reviewer). Live examples in markdown ship with this kit:
[plugins/antigravity-meta-plugin-kit/agents/](../../plugins/antigravity-meta-plugin-kit/agents/).

## File formats

Two formats count as of CLI 1.0.16 — markdown with frontmatter (the recommended 
convention for complex prompts, confirmed 2026-07) and TOML.

**Markdown** — skill-like shape; the body is the system prompt:

```markdown
---
name: my-plugin-helper
description: Read-only helper: verifies claims against the codebase.
---
You are the my-plugin helper subagent. …
```

**TOML** — one file per subagent in `plugins/<name>/agents/`:

```toml
name = "my-plugin-helper"            # must match the filename
description = "Read-only helper: verifies claims against the codebase."
nickname_candidates = ["Helper"]     # optional chat aliases
model = "gemini-3.5-flash"           # per-agent model choice
developer_instructions = """
You are the my-plugin helper subagent.
Role: …
Constraints: read-only; never edit files.
Output format: …
"""
```

Field notes:

- **`name`** — kebab-case, equals the filename without the extension.
- **`description`** — the delegation surface: the host injects a roster of
  installed plugins' subagents (name + description) into the main agent's
  prompt with "you can use them just like regular skills or subagents"
  (confirmed against all three Antigravity binaries, 2026-07). Same
  discipline as skill descriptions: what + when.
- **`model`** — subagents don't inherit the parent's model; pick per role
  (fast model for mechanical checks, strong model for architecture).
- **`developer_instructions`** — the full system prompt (in TOML). Triple-quoted
  multiline string; keep the `"""` pairs balanced. In Markdown, this is just the body of the file.

## Design guidance

- Default subagents to **read-only** roles (researcher, reviewer, planner);
  give write access only when the job demands it, and say so in the prompt.
- One job per subagent. "Planner that also fixes lint" delegates badly.
- Define the output format explicitly in `developer_instructions` — the
  orchestrator consumes it.

## Scaffolding & validation

```bash
# opt-in: the format is undocumented, so it's behind a flag
node plugins/antigravity-meta-plugin-kit/scripts/create.mjs my-plugin --with-agents
```

This kit's `lint` checks every `agents/*.md` and `agents/*.toml` (when the dir exists):
`name` present and matching the filename, `description` present, balanced
`"""` fences (for TOML) — line heuristics. The official validator
counts them: `agy plugin validate` → `agents: N processed`. On CLI 1.1.1+,
`agy agents` lists the agents available to sessions and `agy --agent <name>`
selects one — the quickest live check that yours registered.

## Pitfalls

- `name` ≠ filename → lint FAIL; delegation may misroute.
- Unbalanced `"""` → the whole file fails to parse.
- Prompt without an output format → the orchestrator gets prose it can't
  consume.

## Checklist

- [ ] one Markdown file per subagent, name == filename
- [ ] description says what + when (delegation surface)
- [ ] model chosen per role
- [ ] developer_instructions: role, constraints, output format
- [ ] `lint` + `agy plugin validate` both count/pass

*See also: [Skills](skills.md) · [trap registry](../internals.md)*
