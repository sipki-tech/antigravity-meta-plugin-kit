# Subagents: agents/*.toml

*English | [Русский](agents.ru.md)*

> **Format status:** validator-known, officially undocumented (2026-07).
> `agy plugin validate` counts `agents/` entries, but no official doc
> describes the fields. Everything below is the observed convention from
> working plugins — re-validate after Antigravity updates.

A subagent is a specialized persona your plugin brings along: its own name,
its own system prompt, its own model. The main agent can delegate subtasks
to it (the reference antigravity-kit ships three: a planner, an architect,
and a reviewer).

## File format

One TOML file per subagent in `plugins/<name>/agents/`:

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

- **`name`** — kebab-case, equals the filename without `.toml`.
- **`description`** — shown in UI; also how the orchestrator decides when to
  delegate. Same discipline as skill descriptions: what + when.
- **`model`** — subagents don't inherit the parent's model; pick per role
  (fast model for mechanical checks, strong model for architecture).
- **`developer_instructions`** — the full system prompt. Triple-quoted
  multiline string; keep the `"""` pairs balanced.

## Design guidance

- Default subagents to **read-only** roles (researcher, reviewer, planner);
  give write access only when the job demands it, and say so in the prompt.
- One job per subagent. "Planner that also fixes lint" delegates badly.
- Define the output format explicitly in `developer_instructions` — the
  orchestrator consumes it.

## Scaffolding & validation

```bash
# opt-in: the format is undocumented, so it's behind a flag
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --with-agents
```

This kit's `lint` checks every `agents/*.toml` (when the dir exists):
`name` present and matching the filename, `description` present, balanced
`"""` fences — line heuristics, not a TOML parser. The official validator
counts them: `agy plugin validate` → `agents: N processed`.

## Pitfalls

- `name` ≠ filename → lint FAIL; delegation may misroute.
- Unbalanced `"""` → the whole file fails to parse.
- Prompt without an output format → the orchestrator gets prose it can't
  consume.

## Checklist

- [ ] one TOML per subagent, name == filename
- [ ] description says what + when (delegation surface)
- [ ] model chosen per role
- [ ] developer_instructions: role, constraints, output format
- [ ] `lint` + `agy plugin validate` both count/pass

*See also: [Skills](skills.md) · [trap registry](../internals.md)*
