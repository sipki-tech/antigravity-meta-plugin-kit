---
name: meta-scaffold
description: Scaffold a correct Antigravity plugin repository. Use when the user says "meta-scaffold" or asks to start, structure, or bootstrap a new Antigravity plugin. Covers payload anatomy, plugin.json fields, and the loader traps checklist.
---

# meta-scaffold — start an Antigravity plugin from a correct skeleton

## Goal

Produce a plugin repository that the Antigravity loader actually loads, by
starting from a generated skeleton instead of hand-writing files that trip
undocumented validation.

## Instructions

1. Run `npx github:sipki-tech/antigravity-meta-plugin-kit create <name>`
   (kebab-case name). Preview first with `--dry-run` if unsure.
2. Know what you got — payload anatomy under `plugins/<name>/`:
   - `plugin.json` — the manifest. `author` MUST be an object
     (`{"name": "..."}`), never a string. Useful fields: `name`, `version`
     (semver), `description`, `repository`, `license`, `keywords`,
     `skills` (path), `rules` (path), `hooks` (path), and `interface`
     (`displayName`, `shortDescription`, `category`, `capabilities[]`,
     `defaultPrompt[]`, `brandColor`) — what the plugin manager displays.
   - `hooks/hooks.json` — namespaced: the top-level key is the plugin name.
   - `skills/<skill>/SKILL.md` — skills live INSIDE the plugin directory;
     there is no global skills dir and no shim mechanism.
   - `rules/*.md` — plain markdown, always-on session rules.
   - `mcp_config.json` — MCP servers; entries for optional binaries ship
     `"disabled": true`.
3. The `installed_version.json` trap: the plugin manager writes
   `{"version": "<semver>"}` into the installed plugin dir; a raw copy
   without it is SILENTLY ignored by the loader. The scaffolded installer
   writes it — never commit it to the payload.
4. Fill the TODOs in `plugin.json` and the example skill, then re-run
   `npx github:sipki-tech/antigravity-meta-plugin-kit lint .` from the repo
   root until every check passes.
5. Verify a real install: `node bin/cli.mjs install --workspace` in a scratch
   project, then `node bin/cli.mjs verify --workspace`.

## Definition of Done

- `lint` passes with zero FAIL lines and zero warnings.
- `npm test` inside the scaffolded repo is green.
- A real (or `--workspace`) install followed by `verify` is green.

## Constraints

- Do not hand-edit generated JSON into shapes the linter rejects "just to
  try" — every lint rule maps to an observed loader failure.
- Do not add runtime dependencies to the plugin; Node built-ins only.

## Rationalizations

- "I'll hand-write plugin.json, it's just JSON" → the string-`author` and
  missing-`interface` traps are exactly what hand-writing produces; scaffold
  and edit instead.
- "A raw copy into the plugins dir worked for me once" → without
  `installed_version.json` the loader ignores the plugin silently; you were
  probably looking at a copy the plugin manager had registered earlier.
- "I'll skip lint until the plugin is finished" → lint is how you find loader
  traps while the diff is still small; run it after every payload change.
