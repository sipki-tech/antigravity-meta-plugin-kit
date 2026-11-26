# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/).

## [0.6.0] — 2026-11-26

Complete recalibration to **Google Antigravity `agy 1.5.17+`** (and
`Antigravity.app 2.35.1` / `Antigravity IDE 2.7.0`), verified by a 6-angle
deep research audit and 14 isolated live `agy -p` probes. Drops all legacy
multi-world and non-Antigravity baggage and focuses strictly on production
Antigravity plugin authoring.

### Added

- **Unified CLI router (`scripts/meta-kit.mjs`)** (`meta-kit <create|lint|probe|doctor>`)
  and `package.json` `bin`/`scripts` (`npm run lint|probe|doctor`), keeping
  direct `scripts/{create,lint,probe,doctor}.mjs` entrypoints compatible.
- **Read-only environment diagnostics (`scripts/doctor.mjs` + `/meta-doctor`)**:
  scans `~/.gemini/config/plugins/`, `config.json`, standalone customizations,
  and workspace `.agents/` for plugin/skill/agent name collisions, enablement
  precedence mismatches, active runtime traps, global `Stop` hooks, and hard
  platform caps (24 KB per-file truncation & 20,000-token `defaultRulesBudget`).
- **Executable drift radar (`scripts/probe.mjs`)**: 9 `--fast` validator
  contracts (including `marketplace.json` `archive`+`sha256` and `auth.json`
  validator blind spot) and 4 opt-in `--live` isolated `/tmp` `agy -p` probes
  (hooks, `PromptHook`, subagent `inheritMcp: false`, and `model:` tiers).
- **Two new expert skills** (`meta-rules`, `meta-mcp` — all 8 specialized expert
  skills preserved separately) and **three slash-only wrapper skills**
  (`disable-model-invocation: true`): `/meta-audit`, `/meta-doctor`, `/meta-scout`.
- **Zero-dependency multiline YAML frontmatter parser** (`frontmatter.mjs`):
  supports `>`/`>-`/`|`/`|-` block scalars, flow/block arrays, object arrays,
  1-level nested maps, booleans/numbers, UTF-8 BOM, CRLF, and unquoted-colon
  diagnostics.
- **Modular linter (`scripts/lib/lint/*.mjs`, `lint.mjs --strict --json --all`)**:
  - Split into 11 focused component modules with full backward-compatible facade.
  - Manifest precedence (`.antigravity-plugin/` > `.gemini-plugin/` > root),
    JSONC strict-JSON check, `logo`, `suggestedPrompts`, unknown-key warnings.
  - Subagent validation: FAILs on silently ignored `agents/*.toml`, invalid
    `model` tiers (only `inherit`/`flash_lite`/`flash`/`pro`), invalid
    `commandExecutionPolicy` (`off`/`auto`/`eager`/`sandbox`), unknown `tools:`
    names (prevents spawn crashes), and reserved names; warns on dead
    `grep_search` and legacy IDE aliases. Supports `agents/<name>/agent.md` and
    `agents.json`.
  - Rules validation: uppercase `rules/AGENTS.md`/`GEMINI.md` or valid
    `trigger:`, `globs` string check + `{a,b}` brace warning, 24 KB cap,
    verbose always-on warning.
  - Hooks runtime-trap checks: FAILs on `type: "prompt"` (passes `agy --strict`
    but fails every tool at runtime); warns on missing `Stop` continuation
    guard (`continuationActive || executionNum > 0`), obsolete `model_stop`,
    deprecated `ephemeralMessage`, crashing `injectSteps[].toolCall`, and
    `$PLUGIN_ROOT` / `${PLUGIN_ROOT}` in commands.
  - MCP checks: `/sse` warning, `httpUrl`/`type` warnings, exact
    `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` vs `variables[]` expansion matrix,
    `${env:...}` and literal-secret warnings.
  - **`auth.json` validation** (validator blind spot: strict JSON, `providers`,
    `oauth2` HTTPS URLs/scopes, `delivery`/`env`, literal secret scan).
  - **`marketplace.json` validation** (`meta-kit lint --strict marketplace.json`:
    enforces object `source` with `type: "archive"`, `https://` `url`, and
    64-hex `sha256`).
  - Sidecars validation (`sidecars/<id>/sidecar.json` and `sidecars.json`).
- **New `create.mjs` profiles**: `--minimal`, `--with-agents`, `--with-sidecar`,
  `--with-cli` (Google Workspace pattern: bundled Node CLI + `auth.json` + CLI
  skill + `test/cli.test.mjs`, composable with `--minimal`),
  `--manifest-layout <root|dot-antigravity>`, binary-safe template copying,
  bundled `assets/logo.svg`, `rules/AGENTS.md`, `test/manifest.test.mjs`, and
  `/<name>-help` slash skill alongside `--with-agents`.
- **Canonical `assets/logo.svg`** and scoped `trigger: model_decision` rule
  (`rules/plugin-authoring.md`) in the kit's own payload (single canonical
  `io.mjs` kept in scaffold templates, zero duplicate copy).
- **New tests**: `test/io.test.mjs`, `test/doctor.test.mjs`,
  `test/cli-router.test.mjs`, and `test/docs-parity.test.mjs` (EN/RU heading
  parity, `.ru.md` link hygiene, and stale-pattern guard); removed legacy
  external `antigravity-kit` advisory job/skipped test for 100% green CI.

### Changed

- **Pure Antigravity `1.5.17+` focus**: flat `plugin.json` (dropped ignored
  `interface`, `rules`, `hooks`), `displayName: "Meta Plugin Kit"`, `logo`,
  `suggestedPrompts`, `node >= 20`.
- **Canonical subagents (`agents/*.md`)**: all 3 public subagents
  (`meta-payload-auditor`, `meta-hook-smith`, `meta-trap-scout`) migrated to
  `model: inherit` (preserving parent Neon/Carbon/Argon sessions, since live
  probes showed `pro` maps to `gemini-4-hydrogen-tiered-xhigh`),
  `subagent: true`, `mainAgent: false`, `inheritMcp: false`, explicit
  `commandExecutionPolicy`, and native `tools:`.
- **Hook SDK (`io.mjs`)**: clean official camelCase dialect (`ALLOW`,
  `denyResponse`, `askResponse`, `forceAskResponse`, `overwriteResponse`,
  `systemMessageResponse`, `errorTerminateResponse`, `forceContinueResponse`,
  `continueStopResponse`, `isStopContinuation`), modern stdin adapters
  (`lastUserInput`, `cwd`, `args.Path`, `toolCall.id`, `hookEventName`), and
  flush-safe `runHook()`.
- **`test/agy-validate.test.mjs`**: migrated to `agy plugin validate --strict
  --json` asserting `findings: []` and exact component counts across own
  payload and all scaffold profiles.
- **CI**: runs `meta-kit.mjs lint --strict .`, isolated `doctor --json` smoke,
  and scaffolds + tests all 7 `create` profile combinations on Ubuntu and macOS
  × Node 20/22.
- **Docs**: full refresh of `docs/internals.md`, all 11 bilingual guides
  (EN+RU), `README.md`, `README.ru.md`, and `CONTRIBUTING.md`.

### Removed

- Global `walkthrough-guard` `Stop` hook (`hooks.json`,
  `scripts/walkthrough-guard.mjs`, `test/walkthrough-guard.test.mjs`) and
  always-on `rules/artifacts.md` from the kit's own payload so installing the
  toolkit never intrudes on unrelated user projects.
- Dead plugin `workflows/meta-*.md` files (never loaded in `agy 1.5.17`).
- Moved repo-internal `meta-doc-mirror` out of the public plugin payload into
  workspace-local `.agents/agents/meta-doc-mirror.md` +
  `.agents/skills/meta-mirror/SKILL.md`.
- Legacy `allow_tool`/`deny_reason` dialect, deprecated `ephemeralMessage`,
  `agents/*.toml` authoring support, cross-vendor Claude/Codex/Cursor guidance,
  unused `fsutil.mjs` exports, and untracked `scratch/`.

## [0.5.0] — 2026-07-12

Fully native distribution — the kit is Antigravity-only, so it now leans on
Antigravity's own plugin system instead of a parallel npx installer. Verified
by live probes on CLI 1.1.1 (2026-07-12): `agy plugin install` clones a
GitHub URL directly, registers the plugin, and its skills load in a live
session with no `installed_version.json`.

### Changed

- **Install is native — zero npx.** Users run `agy plugin install
  https://github.com/sipki-tech/antigravity-meta-plugin-kit`.
- **`create` and `lint` moved into the plugin** at
  `plugins/antigravity-meta-plugin-kit/scripts/{create,lint}.mjs`.
- **Generated plugins are native-only bare payloads** without `bin/`/`installer/`.

### Removed

- `bin/cli.mjs`, `installer/`, and the `install/update/uninstall/verify/workflows` subcommands.

## [0.4.1] — 2026-07-12

- Confirmed `SessionStart` live on CLI 1.1.1; migrated hooks from `${PLUGIN_ROOT}` to `./scripts/...`.

## [0.4.0] — 2026-07-11

- Recalibrated to CLI 1.1.1; added `meta-agents` skill, `rules/artifacts.md`, and `walkthrough-guard` Stop hook.

## [0.3.0] — 2026-07-05

- Converted the meta-kit into a full Antigravity plugin with bundled skills, subagents, and workflow wrappers.

## [0.2.0] — 2026-07-05

- Synchronized with official in-CLI docs (CLI 1.0.16); added bilingual guides (`docs/guides/`) and `test/agy-validate.test.mjs`.

## [0.1.0] — 2026-07-03

- Initial release: scaffolder, linter, five meta skills, `docs/internals.md`, and CI.
