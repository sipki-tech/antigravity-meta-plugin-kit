# Rules and workflows

English | [Русский](rules-workflows.ru.md)

Rules inject persistent or conditional instructions into the agent's context.
Markdown `workflows/*.md`, by contrast, are **not loaded from plugins** in
`agy 1.5.17+` and must be replaced with slash-only skills.

## Where rules live

Inside a plugin, Antigravity scans **only** two sources:

- `rules/` — flat 1-level directory scan (`rules/*.md`).
- `rules.json` — optional JSON registry at the plugin root
  (`{"entries": [{"path": "..."}]}`).

Do **not** place `AGENTS.md` or `GEMINI.md` at the plugin root — `agy plugin
validate --strict` warns that root instruction files inside plugins are never
loaded. (Root `AGENTS.md` is a *workspace* convention, not a plugin convention.)

## Plain always-on rules: `rules/AGENTS.md` and `rules/GEMINI.md`

Google's recommended way to ship a single always-on rule in a plugin is an exact
uppercase **`rules/AGENTS.md`** or **`rules/GEMINI.md`** file with **no YAML
frontmatter**:

```markdown
# Project conventions

- Keep changes minimal and covered by `node:test`.
- Never log secrets or API tokens to stdout.
```

> **Case-sensitivity trap:** `rules/agents.md` or `rules/gemini.md` (lowercase)
> without frontmatter is a **hard error** — only exact uppercase `AGENTS.md` and
> `GEMINI.md` are exempt from the `trigger:` requirement. (`rules/README.md`
> without frontmatter is ignored.)

## Triggered rules (`rules/<name>.md`)

Every other `.md` file in `rules/` **must** declare a valid `trigger:` in YAML
frontmatter, or Antigravity rejects the rule with a hard error (`rules: 0`):

| `trigger` | Required sibling key | When Antigravity injects it |
|---|---|---|
| `always_on` | *(none)* | Every turn in every workspace where the plugin is enabled. |
| `model_decision` | `description` | Only when the model decides the current task matches `description`. **Preferred for domain-specific plugins** (0 tokens on unrelated repos). |
| `glob` | `globs` (or `glob`) | Only when the agent touches files matching the glob pattern. |
| `manual` | *(none)* | Only when explicitly `@`-mentioned in Antigravity App. |

Example scoped rule (`trigger: model_decision`):

```markdown
---
trigger: model_decision
description: Apply when authoring or auditing Google Antigravity plugins.
---

# Plugin authoring standards

- Author subagents in Markdown (`agents/*.md`), never TOML.
- Run `lint.mjs --strict` and `agy plugin validate --strict --json` before shipping.
```

### Glob syntax traps

Two sharp traps affect `trigger: glob`:

1. **`globs` must be a single comma-separated YAML string — never a YAML
   array.** Writing:
   ```yaml
   globs:
     - "**/*.ts"
     - "**/*.tsx"
   ```
   triggers a hard error: `cannot unmarshal !!seq into string`.
2. **Never use brace alternation like `**/*.{ts,tsx}`.** Antigravity splits
   `globs` on commas *before* passing patterns to `doublestar/v4`, which corrupts
   `{ts,tsx}` into two broken fragments (`**/*.{ts` and `tsx}`). `agy plugin
   validate` does not catch this, so `lint.mjs` emits a warning. Always expand
   explicitly:
   ```yaml
   ---
   trigger: glob
   globs: "**/*.ts, **/*.tsx"
   ---
   ```

## Size limits and token budgets

Antigravity enforces two hard budgets on rules:

- **24,000 bytes per rule file** (measured *after* expanding `@[label](path)`
  file includes). Larger files warn and truncate.
- **20,000-token `defaultRulesBudget`** across all always-on rules loaded in a
  session. When the total exceeds the budget, rules are silently demoted to file
  path pointers instead of full inline text.

Keep always-on rules lean — under **~100–150 lines**. Move detailed reference
tables, checklists, and walkthroughs into [Skills](skills.md) (`skills/<name>/SKILL.md`)
or `references/` files that load on demand.

## Why plugin `workflows/*.md` are dead (and what replaces them)

In `agy 1.5.17+`, `workflows/*.md` and `commands/` inside a plugin are **never
loaded** (`agy plugin validate --strict` fails with `plugins don't load Markdown
workflows`).

### Migrating slash commands to skills

Convert every old `workflows/<cmd>.md` file into a slash-only skill at
`skills/<cmd>/SKILL.md` with `disable-model-invocation: true`:

```markdown
---
name: my-plugin-release
description: Run the release checklist and verify the plugin before tagging.
disable-model-invocation: true
---

# /my-plugin-release

1. Run `npm test`.
2. Run `agy plugin validate --strict --json plugins/my-plugin`.
3. Report any findings before creating a git tag.
```

Users invoke it with `/my-plugin-release`, and `disable-model-invocation: true`
prevents the model from triggering it spontaneously during unrelated tasks.

### Multi-agent orchestration with `run_workflow`

"Workflows" in `agy 1.5.17` refers to **dynamic Python orchestration scripts**
executed via the built-in `run_workflow` tool (fanning out parallel subagents,
pipelines, and aggregation). If your plugin automates multi-agent pipelines,
document the invocation pattern in a skill or bundle a script under
`skills/<name>/scripts/` instead of creating a top-level `workflows/` folder.

Next: [Skills](skills.md) · [Plugin manifest & layouts](plugin-manifest.md) · [Internals](../internals.md)
