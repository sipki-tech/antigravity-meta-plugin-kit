# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/).

## [Unreleased]

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
- Linting `agents/*.toml` content (needs a zero-dep TOML parser).
- Optional workflows/ scaffolding in `create`.
- `lint --fix` for mechanically correctable findings.
- Marketplace publishing, npm publish, signed releases.
