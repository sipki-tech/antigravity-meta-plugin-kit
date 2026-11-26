---
name: {{name}}-example
description: >-
  Example skill for {{displayName}}. Use when the user says "{{name}}-example"
  or asks what this plugin can do. Don't use for unrelated coding tasks.
---

# {{name}}-example — replace me with a real skill

## Goal

Demonstrate the `SKILL.md` anatomy expected by Google Antigravity (`agy 1.5.17+`),
so the first real skill of `{{name}}` starts from a verified skeleton.

## Instructions

1. Rename this directory and the `name:` field together — they must match and be
   strict lowercase kebab-case.
2. Rewrite `description:` with both **when to use** (positive trigger) and
   **when not to use** (`Don't use for...`). Multiline `>-` YAML is supported.
3. Replace these sections with concrete, numbered steps. Put bulky templates or
   reference docs in `resources/` or `references/` and link them relatively (see
   [prompt template](./resources/prompt-template.md)) to stay well below the
   24,000-byte body truncation cap.
4. Validate with both gates from the repository root:
   - `agy plugin validate --strict plugins/{{name}}`
   - `node "$KIT/scripts/lint.mjs" --strict .` (where `$KIT` is
     `~/.gemini/config/plugins/antigravity-meta-plugin-kit`)

## Definition of Done

- Both `agy plugin validate --strict` and `lint.mjs --strict` pass with 0 warnings.
- Body stays concise and well under 24,000 bytes.
- The skill routes reliably when the trigger phrase is used.

## Constraints

- One skill = one focused job; split unrelated playbooks into separate skills.
- Keep it concise — every line costs session context tokens once activated.

## Rationalizations

- "The description is just metadata" -> it is the only text the router sees;
  without clear positive and negative boundaries the skill misfires or never loads.
- "I'll finish this example later" -> an unfinished skill still registers as
  `/{{name}}-example` and wastes metadata tokens; replace or delete it before shipping.
