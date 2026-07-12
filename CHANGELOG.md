# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/).

## [0.5.0] — 2026-07-12

Fully native distribution — the kit is Antigravity-only, so it now leans on
Antigravity's own plugin system instead of a parallel npx installer. Verified
by live probes on CLI 1.1.1 (2026-07-12): `agy plugin install` clones a
GitHub URL directly, registers the plugin, and its skills load in a live
session with no `installed_version.json`.

### Changed

- **Install is native — zero npx.** Users run `agy plugin install
  https://github.com/sipki-tech/antigravity-meta-plugin-kit` (clones,
  registers in `~/.gemini/config/import_manifest.json`, managed via
  `agy plugin list|enable|disable|uninstall`). Update = re-run install.
- **`create` and `lint` moved into the plugin** at
  `plugins/antigravity-meta-plugin-kit/scripts/{create,lint}.mjs` (from
  `bin/cli.mjs` + `lib/`), so they ship with the payload and survive
  `agy plugin install`; invoke them via the meta-scaffold skill or
  `node .../scripts/…`.
- **Generated plugins are native-only bare payloads** — `create` no longer
  scaffolds `bin/`/`installer/`; the template installs via `agy plugin
  install` and its CI runs `npm test` + `agy plugin validate`.

### Removed

- `bin/cli.mjs`, `installer/` (install.mjs, paths.mjs), and the
  `install/update/uninstall/verify/workflows` subcommands — `agy plugin`
  does all of it. The npx distribution model and the `#main` cache-bypass
  guidance are gone; root `package.json` is now a dev-only manifest (no
  `bin`, no `files`).

### Added

- internals.md `[OBSERVED 2026-07-12]`: the **two install worlds** — the IDE
  plugin-manager writes `installed_version.json`; `agy plugin install`
  instead registers the plugin in `import_manifest.json` and writes no
  version-file. `agy plugin install <target>` accepts an https git URL
  (clones + "bulk plugins directory" scan), a local dir, or
  `plugin@marketplace`.
- **Per-project use is workspace discovery, not an install command**
  `[OBSERVED 2026-07-12]`: `agy plugin install` is global-only; to scope a
  plugin to one project you vendor it under `.agents/` and commit it.
  Discovery picks up both a wrapped `.agents/plugins/<name>/` and a flat
  `.agents/skills/<name>/` (+ `rules/`, `hooks.json`, `mcp_config.json`).
  Non-interactive `-p` needs `--add-dir <project>`; interactive uses the
  launch dir. Documented in README (EN+RU), internals.md, plugin-manifest
  guide.

### Fixed

- Lint dropped the obsolete "installer never writes installed_version.json"
  warning (native install handles registration); the committed-in-payload
  warning stays. Payload-only lint no longer emits the stale
  silent-ignore note.

## [0.4.1] — 2026-07-12

Two live-probed contract flips on CLI 1.1.1, caught within a day of 0.4.0.

### Added

- **`SessionStart` is the sixth KNOWN_EVENT**: confirmed live (probe
  2026-07-12) — fires once per conversation start, flat handler list,
  input = the common stdin fields only, `{}` is the verified response.
  Recorded in internals.md (wire contract + "flipped, then confirmed"
  narrative), hooks guides EN+RU, meta-hooks skill; linter accepts it and
  the "unverified" warning is gone.
- Lint warning **`hook command uses ${PLUGIN_ROOT}`**: the variable expands
  to an **empty string** on CLI 1.1.1 and every hook using it dies with
  `Cannot find module '/scripts/...'` (observed live in both kits'
  installed hooks). `scriptPathOf` now also resolves the official
  hooks.json-relative form (`node ./scripts/x.mjs`; cwd = the hooks.json
  dir).
- internals.md: hook loading is **lazy** (per-conversation, not CLI
  startup — the startup `loaded 0 named hooks` line is misleading); probe
  hygiene notes (hook processes could not write into `/private/tmp` from a
  sandboxed session).

### Changed

- Own payload + scaffold template hooks.json migrated from
  `${PLUGIN_ROOT}` to `./scripts/...` commands.

## [0.4.0] — 2026-07-11

Recalibrated against Antigravity CLI **1.1.1** (research pipeline re-run:
builtin docs diff, binary strings, validator probes) and a sixth meta skill.

### Added

- **`meta-agents` skill** — authoring subagents in both validator-known
  formats (TOML + markdown), description-as-delegation-surface discipline,
  workflow wrappers for /become-X entry points, `agy agents` live checks.
  The payload is now 6 skills + 4 agents.
- `docs/internals.md`, 1.1.1 findings: **SessionStart flipped** — refuted
  on the 1.0.16 binary, it now has a full proto family
  (`SessionStartHookArgs`/`Result`, 2026-07-11) while staying absent from
  the builtin docs; kept `[MEDIUM]` until a live probe lands. `SupportsHook`
  internal RPC noted. New CLI surface recorded: `agy agent/agents`,
  `agy models`, `--agent`, `-p/--print` (+ hook-discovery log lines as a
  debugging tool).
- `docs/internals.md`, new trap **1b**: an Antigravity re-provisioning
  wiped third-party plugins from `~/.gemini/config/plugins/` while
  Google-managed ones survived (observed 2026-07-10; CLI logs prove both
  kits loaded on 07-06 and were gone by 07-11) — run `verify` after every
  update.
- Payload: `rules/artifacts.md` — artifact quality conventions (exact
  verification commands, Rollback section for risky plans, both validators
  for plugin payloads, walkthrough discipline) layered on top of the
  built-in Planning Mode prompts via the rules-precedence mechanism.
- Payload: `walkthrough-guard` Stop hook — when the session produced an
  implementation plan but no `walkthrough.md`, the model's idle stop is
  turned into a nudge to write it (fail-open; silent on user stops, running
  background work, or any ambiguity; self-clearing once walkthrough.md
  exists). Root `hooks.json`, canonical `io.mjs`, installer verify checks,
  unit + e2e tests.
- `docs/internals.md`: Artifacts section — types, ArtifactMetadata fields,
  the embedded Planning Mode / `<PLAN>` prompt formats, markdown validator,
  customization levers.

### Changed

- Linter: the `SessionStart` warning no longer says "refuted" — new text
  states it surfaced in the 1.1.1 binary with an unverified wire contract;
  it stays out of `KNOWN_EVENTS` until probed live.
- Guides/skills/README refreshed to the 1.1.1 state (legacy PreToolUse
  dialect re-checked as still parsed; `agy agents` listing in the
  subagents guide; SessionStart status everywhere it was mentioned).

### Fixed

- Stale docs: hooks guide promised dropping the legacy dialect "until
  0.3.0" (now: until the legacy dialect dies); README lint table still
  said `agents/*.toml` for the check renamed to `agents/*` in 0.3.0; the
  hooks-guide io.mjs snippet lacked the `pathToFileURL` import.

## [0.3.0] — 2026-07-05

The meta-kit becomes a full Antigravity plugin — and its own third dogfood
consumer (self-lint + `agy plugin validate` on its own payload in CI).

### Added

- Plugin payload `plugins/antigravity-meta-plugin-kit/`: the five meta
  skills (moved from the repo root), four authoring subagents —
  `meta-payload-auditor` (read-only semantic payload review),
  `meta-hook-smith` (hook design: event choice, hooks.json, fail-open
  script, tests), `meta-trap-scout` (drift detection against the installed
  Antigravity), `meta-doc-mirror` (EN/RU parity keeper; markdown-format
  agent) — and four workflow wrappers `/meta-audit`, `/meta-hook`,
  `/meta-scout`, `/meta-mirror`.
- Installer (`installer/` + CLI commands `install | update | verify |
  uninstall | workflows`, with `--workspace` and `--dry-run`): journal-based,
  writes `installed_version.json`, mirrors into `antigravity-cli/plugins`
  when present, installs workflow aliases into `.agents/workflows`
  (+ `.agent/workflows` mirror), reference-style `update` versioning.
- Tests: installer suite (12 new cases), strengthened dogfood (own payload
  lints with zero FAILs/warnings; plugin.json version synced with
  package.json), `agy plugin validate` case for the own payload
  (skills: 5, agents: 4), CLI install/verify e2e.
- CI: self-lint step and install→verify→uninstall smoke in the test matrix.
- Lint: `agents/*.md` markdown subagents validated (frontmatter name +
  description, name matches filename) — format confirmed by probe on
  CLI 1.0.16; check renamed to `agents/* minimally valid`.

### Changed

- Skills moved: `skills/meta-*` → `plugins/antigravity-meta-plugin-kit/skills/meta-*`
  (the payload must be self-contained). If you copied skills from the repo
  root, update your path.

### Fixed

- CLI version attribution corrected to 1.0.16 across docs/templates: the
  built-in `agy changelog` lags behind the actual binary (documented in
  internals.md), so earlier observations were mislabeled as 1.0.10 — the
  contracts themselves are unchanged.

## [0.2.0] — 2026-07-05

Synchronized with the official customization docs Google now ships inside the
CLI (1.0.16, `builtin/skills/agy-customizations/docs/`).

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
- ~~A `meta-agents` skill once the subagent TOML format is documented~~
  (shipped in 0.4.0 — the format stayed undocumented, the observations
  matured instead).
- Upstreaming io.mjs v2 + root hooks.json migration to antigravity-kit.
- Optional workflows/ scaffolding in `create`.
- `lint --fix` for mechanically correctable findings.
- Marketplace publishing, npm publish, signed releases.
- Drop the legacy `allow_tool`/`deny_reason` dialect from the template
  (target: 0.3.0).
