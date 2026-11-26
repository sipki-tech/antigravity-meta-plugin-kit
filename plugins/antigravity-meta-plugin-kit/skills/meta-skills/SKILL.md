---
name: meta-skills
description: >-
  Author Google Antigravity SKILL.md files that route accurately and stay under
  the 24 KB body cap. Use when the user says "meta-skills" or writes, reviews,
  or fixes a skill or slash-only skill wrapper. Don't use for rules or agents.
---

# meta-skills — skills that route cleanly and deliver

## Goal

Author `skills/<name>/SKILL.md` runbooks whose descriptions reliably trigger on
real user prompts, avoid false positives, and respect Antigravity's 24,000-byte
body truncation limit.

## Instructions

1. **Directory shape:** `skills/<kebab-name>/SKILL.md`, plus optional
   `scripts/`, `examples/`, `resources/`, `references/` linked relatively (1
   level deep).
2. **YAML frontmatter (`agy 1.5.17+` supports multiline `>-` / `|`):**
   - `name` (required): strict lowercase kebab-case matching the directory name.
   - `description` (required): the **only** text injected before activation.
     State in third person: **what** it does, **when** to use it (with concrete
     trigger phrasing), and **when NOT to use it** (`Don't use for...`). Quote
     any value containing `": "` or use `description: >-`.
   - Optional Antigravity control flags:
     - `disable-model-invocation: true` — makes the skill an explicit
       `/<name>` slash command only (replaces deprecated `workflows/*.md`!).
     - `disable-slash-command: true` — hides the skill from `/` autocomplete.
     - `metadata.icon` / `metadata.logo` — optional UI visuals.
3. **Body structure:**
   - `## Goal` — one concise paragraph of the outcome.
   - `## Instructions` — numbered, concrete commands and paths.
   - `## Definition of Done` — objectively verifiable checks.
   - `## Constraints` — hard guardrails.
   - `## Rationalizations` — 2–3 "excuse -> counter" pairs pre-empting shortcuts.
4. **Token & size discipline:** Antigravity silently **truncates `SKILL.md`
   bodies above 24,000 bytes** (frontmatter excluded; even several official
   Google plugins hit this warning). Keep `SKILL.md` under ~100 lines (~4–8 KB)
   and move heavy reference material into `references/` or `resources/`.
5. **Validate:** run `node "$KIT/scripts/lint.mjs" --strict .` and
   `agy plugin validate --strict --json <payload>`.

## Definition of Done

- Both validators pass with 0 warnings.
- Body size is well below 24,000 bytes.
- Reading only `description`, both positive triggers and negative boundaries
  are unambiguous.

## Constraints

- One skill = one focused job; split unrelated playbooks.
- Never put Markdown `workflows/` or `commands/` inside a plugin — use skills.

## Rationalizations

- "I'll inline the whole reference manual in `SKILL.md`" -> past 24,000 bytes
  Antigravity truncates the tail silently, and long bodies bloat every session
  that activates the skill; link `references/*.md` instead.
- "Positive trigger wording is enough" -> without `Don't use for...`, adjacent
  skills steal turns from each other.
