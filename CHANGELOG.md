# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/).

## [Unreleased]

## [0.2.0] — 2026-07-05

Synchronized with the official customization docs Google now ships inside the
CLI (1.0.10, `builtin/skills/agy-customizations/docs/`).

### Added

- `docs/internals.md` v2: provenance-tagged registry (OFFICIAL / OBSERVED /
  MEDIUM) — the two plugin worlds, all five hook events incl. `PostInvocation`
  (`terminationBehavior: force_continue`), official response dialect
  (`decision: allow|deny|ask|force_ask`), `ephemeralMessage` injection,
  `enabled: false`, common stdin fields, `agents/*.toml`, `commands/`
  (probed: converted to skills), `skills.json`/`plugins.json` registries,
  rules triggers, marketplace/`agy plugin import claude`, and a
  "Refuted rumors" section (`SessionStart` does not exist).
- Linter: recognizes all five events and both entry shapes across arbitrary
  hook names; flags an event name at the top level (Claude Code-style config);
  validates `agents/*.toml` (TOML-lite heuristics); warns when hooks.json is
  not at the plugin root (`agy plugin validate` won't see it), on duplicated
  hooks.json drift, on missing/oversized timeouts, on unknown events, and on
  skill-name style.
- Scaffold: root-level `hooks.json` (official location — `agy plugin
  validate` now reports it processed), guard emits the official decision
  dialect plus legacy keys, `io.mjs` v2 (`denyResponse`, `ephemeralResponse`,
  `workspacePaths` in `cwdOf`), XML-sectioned
  `resources/prompt-template.md` in the example skill, `--with-agents` flag.
- `test/agy-validate.test.mjs`: integration with the official validator
  (skips when `agy` is not on PATH).
- Skills: `meta-hooks` rewritten to the official contracts; the other four
  updated (two worlds, official skill style guide, XML-template guidance,
  `agy plugin validate` as a companion gate).
- Bilingual guides (`docs/guides/`, EN+RU): getting started, plugin manifest
  & layouts, hooks, skills, subagents, rules & workflows, MCP servers,
  testing, shipping. README rewritten with TOC, FAQ, and a validator
  comparison table.

### Changed

- Timeout rule split: malformed fails; missing or >30s warns (official
  default is 30).
- `hooks.json namespaced by plugin name` replaced by named-hooks structure
  checks; the plugin-name key is documented as a convention.

### Removed

- The `statusMessage` warning (not an official field; IDE-world nicety).

## [0.1.0] — 2026-07-03

### Added

- `create <plugin-name>` — scaffolds a complete Antigravity plugin repository:
  payload (object author, namespaced hooks.json, example fail-open PreToolUse
  hook via a verbatim `runHook()` io.mjs, SKILL.md with a trigger phrase,
  rules and MCP stubs), installer (journal/dry-run, global+workspace layout
  detection with CLI mirror, `installed_version.json` writing, non-destructive
  MCP merge, verify/uninstall), tests (`node --test`, green out of the box),
  CI workflow, README. Kebab-case validation, `--dir`, `--dry-run`.
- `lint <plugin-dir>` — validates a payload (or scaffolded repo root) against
  every observed loader trap: manifest integrity, object author, semver,
  interface, declared paths, SKILL.md frontmatter + trigger heuristic, both
  hooks.json shapes, timeouts ≤30s, script existence, fail-open heuristic,
  MCP `disabled: true` for non-builtin commands, workflow frontmatter.
  Warnings/notes for the `installed_version.json` trap.
- Five portable Agent Skills: `meta-scaffold`, `meta-hooks`, `meta-skills`,
  `meta-test`, `meta-ship` (each with a Rationalizations block).
- `docs/internals.md` — the canonical Antigravity trap list with observation
  dates (2026-07, preview).
- CI: ubuntu+macos × Node 20/22 matrix, create→lint→scaffolded-tests smoke,
  and a hard dogfood gate that clones antigravity-kit and lints its payload.
- Bilingual docs (README.md / README.ru.md), CONTRIBUTING.md.

### Backlog (recorded, not implemented)

- `install-skills --host <claude-code|codex>` command for the meta skills.
- `create --minimal` for CLI-world plugins (2-file payloads).
- Lint profiles (`--cli-world`) relaxing the rich-manifest rules.
- Linting `skills.json`/`plugins.json` registries and global
  `~/.gemini/config/hooks.json`.
- A `meta-agents` skill once the subagent TOML format is documented.
- Upstreaming io.mjs v2 + root hooks.json migration to antigravity-kit.
- Optional workflows/ scaffolding in `create`.
- `lint --fix` for mechanically correctable findings.
- Marketplace publishing, npm publish, signed releases.
- Drop the legacy `allow_tool`/`deny_reason` dialect from the template
  (target: 0.3.0).
