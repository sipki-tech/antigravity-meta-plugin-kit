---
name: {{name}}-example
description: Example skill for the {{name}} plugin. Use when the user says "{{name}}-example" or asks what this plugin can do. Replace this with a real skill before shipping.
---

# {{name}}-example — replace me with a real skill

## Goal

Demonstrate the SKILL.md shape the Antigravity loader expects, so the first
real skill of {{name}} starts from a correct template instead of a blank file.

## Instructions

1. Rename this directory and the `name:` field together — they must match.
2. Rewrite `description:` so it contains the phrase a user would actually say
   to trigger the skill (keep it quoted, e.g. "{{name}}-example").
3. Replace the sections below with the real playbook: concrete steps, not
   aspirations. Bulky material goes into the official subdirs — `scripts/`
   (executable helpers), `references/` (long docs), `resources/` (templates);
   link them relatively, e.g. the XML-structured
   [prompt template](./resources/prompt-template.md).
4. Run `npx github:sipki-tech/antigravity-meta-plugin-kit lint .` from the
   repo root after editing.

## Definition of Done

- The skill triggers when the wake phrase from the description is used.
- `lint` passes: frontmatter valid, trigger phrase present.

## Constraints

- Keep the skill focused on one job; split unrelated playbooks into separate
  skills.
- Keep it short — every line costs context tokens in the host session.

## Rationalizations

- "The description is just metadata" → it is the only text the router sees;
  without a trigger phrase the skill never fires.
- "I'll flesh this out later" → an unfinished skill still routes and wastes
  tokens; finish it or delete it before shipping.
