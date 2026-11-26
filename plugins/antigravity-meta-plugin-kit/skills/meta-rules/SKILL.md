---
name: meta-rules
description: >-
  Author Google Antigravity plugin rules (rules/AGENTS.md and triggered
  rules/*.md) within the 24 KB file limit and 20k-token budget. Use when the
  user says "meta-rules" or creates, edits, or debugs plugin rules, triggers,
  or globs. Don't use for skills or lifecycle hooks.
---

# meta-rules — high-signal plugin rules without context bloat

## Goal

Ship plugin rules under `rules/` that actually load in `agy 1.5.17+` (never
silently dropped for missing `trigger:`) while minimizing always-on context
token tax.

## Instructions

1. **Choose the right file shape inside `<plugin>/rules/`** (flat 1-level scan
   only; use root `rules.json` for extra paths; never put `AGENTS.md`/`GEMINI.md`
   at the plugin root — plugins ignore root rule files):
   - **Always-on plugin rules (Google's default recommendation):** exact
     uppercase **`rules/AGENTS.md`** (or `rules/GEMINI.md`) — plain Markdown,
     **no frontmatter**. Lowercase `rules/agents.md` is a **hard error**.
   - **Scoped / conditional rules (`rules/<name>.md`):** MUST start with YAML
     frontmatter declaring `trigger:` set to one of exactly 4 values:
     - `always_on` — loaded into every session while the plugin is enabled.
     - `model_decision` — loaded only when the model matches `description:`
       (**ideal for developer toolkits so idle sessions pay 0 tokens!**).
     - `glob` — matched by `globs:` (or `glob:`).
     - `manual` — `@`-mention only in Antigravity App.
2. **Avoid the `globs:` traps:**
   - `globs:` MUST be a **single comma-separated YAML string** (e.g.
     `globs: "**/*.ts, **/*.tsx"`). A YAML array (`["**/*.ts"]`) is a **hard
     error** that skips the rule!
   - **Never use `{ts,tsx}` brace expansion** — Antigravity splits on commas
     first, which breaks braces (and `agy plugin validate` does not catch it;
     `lint.mjs` warns). Prefix workspace-relative patterns with `**/`.
3. **Respect size limits and context budget:**
   - **Per-file cap:** 24,000 bytes (after expanding `@[label](path)` includes);
     anything above is truncated on line boundaries and warns.
   - **Aggregate rules budget:** 20,000 tokens across all always-on/global
     rules (`defaultRulesBudget`); over-budget rules demote to path pointers.
   - **Keep always-on rules ultra-lean (40–100 lines, <=150 max):** include
     only non-discoverable invariants and forbidden patterns; move reference
     docs to a skill's `references/`.
4. **Validate:** run `node "$KIT/scripts/lint.mjs" --strict .` and
   `agy plugin validate --strict --json <payload>` — confirm `components.rules`
   matches the expected rule count.

## Definition of Done

- `agy plugin validate --strict` counts every intended rule (`rules N`).
- `lint.mjs --strict` passes `rules triggers valid`, `rules globs valid`, and
  `rules within 24KB cap` with 0 warnings.
- Always-on rules are short, imperative, and non-redundant with the codebase.

## Constraints

- Never leave a `rules/<name>.md` (other than uppercase `AGENTS.md`/`GEMINI.md`)
  without a valid `trigger:` frontmatter block.
- Never put enforcement that requires hard blocking into a rule alone — rules
  instruct, `PreToolUse` hooks enforce.

## Rationalizations

- "Plain `rules/style.md` without frontmatter loads as always-on" -> false in
  `agy 1.5.17`: it fails with `no valid trigger` and `rules: 0`. Use
  `rules/AGENTS.md` or add `trigger: always_on`.
- "`globs: ['**/*.ts']` is cleaner YAML" -> hard error (`cannot unmarshal !!seq
  into string`). Use a single quoted comma-separated string.
