---
trigger: model_decision
description: Apply ONLY when creating, editing, linting, auditing, or testing a Google Antigravity plugin payload (plugin.json, hooks.json, skills/*/SKILL.md, agents/*.md, rules/*, mcp_config.json, sidecars/*).
---
# Antigravity plugin authoring invariants

- Validate every payload change with **both** gates: `agy plugin validate --strict --json <payload>` and this kit's `lint.mjs --strict <target>`.
- `plugin.json` is flat (no `interface`, `rules`, or `hooks` keys) and must stay strict JSON so `agy plugin install` can read it.
- Subagents live in `agents/<name>.md` or `agents/<name>/agent.md` (never `.toml`). `model:` accepts only `inherit`, `flash_lite`, `flash`, or `pro` (prefer `inherit`); always declare explicit native `tools:` (`read_file`, `edit_file`, `write_file`, `run_command`, `manage_task`, `search_web`) and `inheritMcp: false` for isolated workers; never use `grep_search`.
- Plugin rules live in `rules/AGENTS.md` (exact uppercase, no frontmatter) or `rules/<name>.md` with `trigger: always_on | model_decision | glob | manual` (`globs:` as a flat comma-separated string with no `{a,b}` braces). Never ship Markdown `workflows/` or `commands/` inside plugins.
- Keep hooks fail-open (exit 0 + valid JSON on every path), avoid `type: "prompt"` and `injectSteps[].toolCall`, and guard `Stop` continuations with `continuationActive || executionNum > 0`.
