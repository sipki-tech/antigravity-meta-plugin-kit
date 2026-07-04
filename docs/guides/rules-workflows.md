# Rules & workflows: always-on guardrails and /slash-commands

*English | [Русский](rules-workflows.ru.md)*

## Rules — always-on behavioral guardrails

Rules are plain markdown that constrains the agent while it works in a
scope: coding style, API restrictions, safety protocols, output tone.

### Where rules live

| Location | Scope | Frontmatter |
|---|---|---|
| `GEMINI.md` / `AGENTS.md` in any directory | that dir + subdirs (discovered by walking up from CWD to the repo root) | none — always active |
| `.agents/rules/*.md` in a project | project | `trigger: always_on \| model_decision` (observed; `glob` likely — MEDIUM confidence) |
| `plugins/<name>/rules/*.md` | while the plugin is enabled | none observed |

Hierarchy: `GEMINI.md` (Antigravity-specific, highest) → `AGENTS.md`
(portable cross-tool standard — the same file works in Cursor and Claude
Code) → tool-specific files. Rules are deduplicated by resolved path — a
rule loads once per conversation even if discovered via several routes.

### Writing rules that work

- Imperative, short lines. Every rule line costs context tokens in every
  session — a rules file is a tax, keep it lean.
- Group by concern (the reference plugin ships `safety.md`, `workflow.md`,
  `output-style.md`).
- State enforceable facts, not vibes: "never read .env files" beats "be
  careful with secrets".
- If a hook enforces the same thing (e.g. a danger-guard), say so in the
  rule — the rule instructs, the hook enforces.

## Workflows — files that become /slash-commands

A workflow is a thin `.md` with a single frontmatter field:

```markdown
---
description: Plan non-trivial work before coding — numbered plan with scope and risks
---

1. Load and follow the `my-plugin-plan` skill playbook.
2. Restate the task: what changes, why, definition of done.
3. Write the plan to a file; do not write code.
```

- Filename → command: `my-plugin-plan.md` becomes `/my-plugin-plan`.
- **`description` is required** — it's the command's help text (lint checks
  it; note that `agy plugin validate` ignores workflows entirely — this
  kit's linter is the only gate).
- Keep workflows as thin aliases pointing at skills: the skill holds the
  playbook, the workflow is the invocation surface. Don't duplicate logic.
- Location: `<project>/.agents/workflows/` (installer mirrors into
  `.agent/workflows/` only when `.agent/` already exists). Skills also
  surface as slash commands automatically, so a workflow earns its place
  only when it adds wording or arguments on top of the skill.

## Pitfalls

- A rules file that grows into documentation — the agent pays for it every
  turn. Move reference material into a skill's `references/`.
- Workflow without `description` → broken /slash-command help (lint FAIL).
- Duplicating the playbook in both the skill and the workflow → they drift.
- Committing personal-preference rules into a team repo — keep those in
  your global `~/.gemini/GEMINI.md`.

## Checklist

- [ ] rules: short, imperative, grouped by concern, deduplicated with hooks
- [ ] AGENTS.md for anything that must work across tools
- [ ] every workflow has a description and points at a skill
- [ ] `lint` passes (rules non-empty, workflow frontmatter)

*See also: [Skills](skills.md) · [Hooks](hooks.md)*
