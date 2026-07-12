---
name: meta-scaffold
description: Scaffold a correct Antigravity plugin repository. Use when the user says "meta-scaffold" or asks to start, structure, or bootstrap a new Antigravity plugin. Covers payload anatomy, plugin.json fields, and the loader traps checklist.
---

# meta-scaffold — start an Antigravity plugin from a correct skeleton

## Goal

Produce a plugin repository that the Antigravity loader actually loads, by
starting from a generated skeleton instead of hand-writing files that trip
undocumented validation.

## The bundled tools

This kit's `create` and `lint` scripts ship inside this plugin. Run them from
its install directory — write `$KIT` for that path:
`~/.gemini/config/plugins/antigravity-meta-plugin-kit` for a global install
(shows in `agy plugin list`), or
`<project>/.agents/plugins/antigravity-meta-plugin-kit` when it's vendored into
a project (workspace-discovered — not tracked by `agy plugin list`).

## Instructions

1. Run `node "$KIT/scripts/create.mjs" <name>` (kebab-case name). Preview first
   with `--dry-run` if unsure. It produces a **native-only** plugin repo — a
   bare payload plus tests and CI, installed via `agy plugin install`, with no
   bundled Node installer.
2. Know what you got — payload anatomy under `plugins/<name>/`:
   - `plugin.json` — the manifest. `author` MUST be an object
     (`{"name": "..."}`), never a string. Officially only `name` is needed
     (CLI world); the rich fields (`version`, `description`, `repository`,
     `license`, `keywords`, `skills`/`rules`/`hooks` paths, `interface`
     {displayName, shortDescription, category, capabilities[],
     defaultPrompt[], brandColor}) are the authoring profile for the IDE
     plugin-manager world — ship them.
   - `hooks.json` — at the plugin ROOT (official location; `agy plugin
     validate` looks only there). Top-level keys are hook names — the plugin
     name is a convention, an event name there is an error.
   - `skills/<skill>/SKILL.md` — skills live INSIDE the plugin directory;
     official subdirs: `scripts/`, `examples/`, `resources/`, `references/`.
   - `rules/*.md` — plain markdown, always-on session rules.
   - `agents/*.toml` — optional subagents (`create --with-agents`); format is
     validator-known but officially undocumented.
   - `mcp_config.json` — MCP servers; entries for optional binaries ship
     `"disabled": true`.
3. `installed_version.json` is an install-time artifact, NOT a payload file —
   two install worlds handle it differently: the IDE plugin-manager writes
   `{"version": "<semver>"}` into the installed copy, while `agy plugin
   install` instead registers the plugin in `~/.gemini/config/
   import_manifest.json` and writes no version-file (skills still load —
   probed 2026-07-12). Either way, never commit it to the payload.
4. Fill the TODOs in `plugin.json` and the example skill, then re-run
   `node "$KIT/scripts/lint.mjs" .` from the repo root until every check
   passes. Also run the official structural validator:
   `agy plugin validate plugins/<name>` — the two cover different ground
   (it: CLI-world structure; lint: IDE traps, rules, workflows, style).
5. Verify a real install: `agy plugin install plugins/<name>` (installs the
   local payload dir), then `agy plugin list` to confirm it registered.
   `agy plugin uninstall <name>` cleans up.

## Definition of Done

- `lint` passes with zero FAIL lines and zero warnings.
- `agy plugin validate` reports `[ok]` with hooks/skills processed (when the
  `agy` CLI is available).
- `npm test` inside the scaffolded repo is green.
- A real `agy plugin install` of the payload registers in `agy plugin list`.

## Constraints

- Do not hand-edit generated JSON into shapes the linter rejects "just to
  try" — every lint rule maps to an observed loader failure.
- Do not add runtime dependencies to the plugin; Node built-ins only.

## Rationalizations

- "I'll hand-write plugin.json, it's just JSON" → the string-`author` and
  missing-`interface` traps are exactly what hand-writing produces; scaffold
  and edit instead.
- "A raw copy into the plugins dir worked for me once" → the IDE
  plugin-manager needs `installed_version.json` to recognize a dir; `agy
  plugin install` needs its `import_manifest` entry. A hand-copied dir has
  neither — install through the CLI and let it register the plugin.
- "I'll skip lint until the plugin is finished" → lint is how you find loader
  traps while the diff is still small; run it after every payload change.
