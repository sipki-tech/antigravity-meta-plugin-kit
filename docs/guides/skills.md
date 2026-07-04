# Skills: SKILL.md anatomy, trigger phrases, progressive disclosure

*English | [Русский](skills.ru.md)*

A skill is a directory with a `SKILL.md` — a runbook the agent loads **on
demand**. Antigravity injects only the name + description into context
(progressive disclosure); the body loads when the skill activates. Skills
also surface automatically as /slash-commands.

## Directory shape (official)

```
skills/<skill-name>/
├── SKILL.md          # required: frontmatter + instructions
├── scripts/          # optional: executable helpers
├── examples/         # optional: reference implementations
├── resources/        # optional: templates and assets
└── references/       # optional: bulky docs the agent reads on demand
```

## Frontmatter — the routing surface

```markdown
---
name: my-plugin-example
description: Example skill for the my-plugin plugin. Use when the user says "my-plugin-example" or asks what this plugin can do.
---
```

- **`name`** — lowercase-hyphenated, must equal the directory name.
- **`description`** — the ONLY text the router sees. Write it in the third
  person; state **what** the skill does and **when** to use it; include the
  trigger phrase a user would actually type, ideally quoted. A description
  like "Database tools" never routes; "Executes read-only SQL against local
  PostgreSQL. Use when the user asks to inspect the DB" does.

This kit's lint enforces frontmatter validity and a trigger heuristic (a
quoted phrase or "use when/for/always/this").

## Body structure

The reference convention, proven across two plugin generations:

```markdown
# skill-name — one-line what it does

## Goal            ← the outcome, one paragraph
## Instructions    ← numbered, concrete steps; commands and file paths
## Definition of Done  ← objectively checkable items
## Constraints     ← what NOT to do
## Rationalizations    ← 2–3 "excuse → counter" pairs
```

Numbered steps beat prose — agents follow sequences reliably. Include
validation steps ("check the log", "run the dry-run") so the agent can
verify itself. Don't restate general knowledge the model already has.

## Token hygiene & progressive disclosure

Keep SKILL.md under ~80 lines. Move bulky material out and link it
relatively:

- long reference docs → `references/api.md`
- prompt templates → `resources/prompt-template.md`
- multi-step shell work → `scripts/do-thing.sh` (executable, linked)

The agent reads linked files only when needed — that's the token win.

## XML prompt templates

SKILL.md itself stays markdown. XML-style sectioning is Google's recommended
shape for long, multi-part **prompt templates** with placeholders — put
those in `resources/`:

```xml
<role>…</role>
<constraints>1. …</constraints>
<context>{{USER_REQUEST}}</context>
<task>…</task>
<output_format>…</output_format>
```

The scaffold ships a working example
(`skills/<name>-example/resources/prompt-template.md`).

## Portability

The same format works across hosts — copy the skill directory to:

| Host | Location |
|---|---|
| Antigravity plugin | `plugins/<name>/skills/<skill>/` |
| Antigravity project | `<project>/.agents/skills/<skill>/` |
| Antigravity global | `~/.gemini/config/skills/<skill>/` |
| Claude Code | `~/.claude/skills/<skill>/` |
| Codex | `~/.codex/skills/<skill>/` |

## Pitfalls

- Vague description → the skill never fires and silently wastes payload
  tokens.
- `name` ≠ directory name → lint FAIL; routing confusion.
- Everything inlined in SKILL.md → context bloat in every session that
  activates it.
- One skill doing three jobs → split it; descriptions can't route a
  three-headed skill.

## Checklist

- [ ] name lowercase-hyphenated and equal to the dir
- [ ] description: third person, what + when, quoted trigger phrase
- [ ] body ≤ ~80 lines; bulk in subdirs, linked relatively
- [ ] Definition of Done items objectively checkable
- [ ] `lint` passes (frontmatter + trigger checks)

*See also: [Rules & workflows](rules-workflows.md) ·
[trap registry](../internals.md)*
