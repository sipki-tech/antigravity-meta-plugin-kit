# Skills

English | [Русский](skills.ru.md)

Skills are on-demand instruction packages that stay cheap until needed: at
session startup Antigravity indexes only each skill's `name` and `description`,
loading the full `SKILL.md` body only when the task matches or the user invokes
`/<skill-name>`.

## Directory layout and discovery

Place each skill in its own kebab-case directory under `skills/`:

```text
skills/
└── my-plugin-example/
    ├── SKILL.md           # required — YAML frontmatter + instructions
    ├── scripts/           # optional helper CLI / scripts
    ├── resources/         # optional templates, prompt fragments, schemas
    ├── references/        # optional long reference docs loaded on demand
    └── examples/          # optional worked examples
```

Antigravity also supports extra skill paths via `plugin.json`'s `skills` field
or a root `skills.json` registry (`{"entries": [{"path": "..."}]}`). The `name`
in frontmatter must exactly match the directory name (kebab-case).

## Frontmatter and multiline YAML

Antigravity `1.5.17` parses full YAML frontmatter in `SKILL.md`, including
multiline folded (`>`, `>-`, `>+`) and literal (`|`, `|-`, `|+`) scalars:

```markdown
---
name: my-plugin-example
description: >-
  Guides deployment checklists for Acme services. Use when preparing a release,
  verifying staging rollouts, or writing rollback steps. Don't use for local
  unit tests or database schema migrations.
metadata:
  icon: rocket
---

# Deployment checklist
...
```

Supported frontmatter fields:

| Field | Purpose |
|---|---|
| `name` | Required kebab-case identifier matching the folder name and `/<name>` slash command. |
| `description` | Required routing summary shown in the system prompt's `<skills>` index. |
| `disable-model-invocation` | Boolean. When `true`, the skill is **slash-command only** (`/<name>`) and never auto-triggered by the model. |
| `disable-slash-command` | Boolean. When `true`, the model can load the skill automatically, but `/<name>` is hidden from the slash menu. |
| `metadata.icon` / `metadata.logo` | Optional UI badge metadata. |

## Writing strong triggers

The `description` field is the **entire routing surface** for automatic skill
activation — write it like a crisp classifier, not marketing prose:

1. **Lead with concrete capability** (one short sentence).
2. **Add positive triggers:** `"Use when ..."` naming the exact artifacts,
   files, errors, or user phrases that should activate the skill.
3. **Add negative boundaries:** `"Don't use for ..."` naming adjacent tasks
   that belong to other skills or normal coding.

`lint.mjs` fails when a normal skill's `description` lacks trigger cues (and
automatically skips that check for `disable-model-invocation: true`
slash-only skills).

## Controlling invocation: `disable-model-invocation` and `disable-slash-command`

- **Expert reference / workflow skills** (default): leave both flags unset so
  either the model or the user (`/<name>`) can invoke the skill.
- **Deterministic `/slash` commands & subagent wrappers:** set
  `disable-model-invocation: true`. This is the official `agy 1.5.17+`
  replacement for deprecated plugin `workflows/*.md` and the canonical way to
  expose a subagent as `/<cmd>` (see [Subagents](agents.md)).
- **Background-only skills:** set `disable-slash-command: true` when a skill
  should only activate via model routing and should not crowd the `/` menu.

## The 24,000-byte body cap and progressive disclosure

Antigravity enforces a **24,000-byte limit on the `SKILL.md` body** (excluding
frontmatter). Anything larger warns in `agy plugin validate --strict` and is
**silently truncated** at runtime.

Keep `SKILL.md` focused (~50–200 lines) and use progressive disclosure:

- Put the decision tree, invariants, and exact commands in `SKILL.md`.
- Move long checklists, schemas, and lookup tables into `references/*.md` and
  instruct the agent to `read_file` them only when a specific branch applies.
- Move deterministic validation or code generation into `scripts/*.mjs` so the
  agent runs a 1-line command instead of re-deriving logic in prose.

## Bundled scripts and prompt templates

- Reference sibling files with clean relative paths inside `SKILL.md` (for
  example `scripts/check.mjs` or `resources/prompt-template.md`), and note that
  the agent resolves them relative to the skill's directory path shown in the
  `<skills>` index.
- Store reusable structured prompts under `resources/` using explicit XML tags
  (`<context>`, `<constraints>`, `<output_format>`) so the model separates
  template structure from user input cleanly.

Next: [Rules and workflows](rules-workflows.md) · [Subagents](agents.md) · [Testing](testing.md)
