---
name: meta-skills
description: Write SKILL.md files that actually route and read well. Use when the user says "meta-skills" or authors, reviews, or fixes a skill for an Antigravity plugin (also portable to Claude Code and Codex).
---

# meta-skills — skills that route, then deliver

## Goal

Author SKILL.md files whose descriptions reliably trigger and whose bodies
give an agent an executable playbook, not an essay.

## Instructions

1. Frontmatter discipline: exactly `name` and `description`. `name` must
   equal the directory name. `description` is the ONLY text the router sees —
   it must contain the trigger phrase a user would actually type, ideally
   quoted: `Use when the user says "my-plugin-do-x" or asks to ...`.
2. Body structure (the reference convention):
   - `## Goal` — one paragraph: what outcome this skill produces.
   - `## Instructions` — numbered, concrete steps; commands and file paths,
     not aspirations.
   - `## Definition of Done` — verifiable checks, each answerable by a
     command or an inspectable artifact.
   - `## Constraints` — what NOT to do.
   - `## Rationalizations` — 2–3 "excuse → counter" pairs that pre-empt the
     shortcuts an agent will be tempted to take.
3. Token hygiene: a skill is loaded into a live session. Keep it under ~80
   lines; cut anything the agent can derive; prefer one sharp example over
   three redundant ones.
4. Placement: in an Antigravity plugin, skills live inside the plugin dir
   (`plugins/<name>/skills/<skill>/SKILL.md`). The same format is portable —
   copy the skill dir to `~/.claude/skills/` (Claude Code) or
   `~/.codex/skills/` (Codex).
5. Validate: `npx github:sipki-tech/antigravity-meta-plugin-kit lint .` —
   frontmatter and trigger checks are enforced.

## Definition of Done

- `lint` passes for the skill (frontmatter valid, trigger present).
- Reading only the description, a stranger can guess when the skill fires.
- Every Definition-of-Done item in the skill itself is objectively checkable.

## Constraints

- One skill = one job; split unrelated playbooks.
- No YAML beyond flat `key: value` in frontmatter — parsers downstream are
  deliberately minimal.

## Rationalizations

- "The description is just metadata" → it is the routing surface; a skill
  with a vague description never fires and silently wastes payload tokens.
- "More detail makes the skill better" → past the playbook, every line
  dilutes attention in the session that loads it; cut until it hurts.
- "I'll write the Rationalizations section later" → it exists to catch the
  exact corner you're about to cut now; write it while the temptation is
  fresh.
