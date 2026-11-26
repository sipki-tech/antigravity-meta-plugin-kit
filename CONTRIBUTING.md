# Contributing

## Setup

```bash
git clone https://github.com/sipki-tech/antigravity-meta-plugin-kit
cd antigravity-meta-plugin-kit
npm test    # node --test; no install step, no build step
```

The dev tools live inside the plugin payload. Run them from a checkout with:

```bash
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs lint --strict .
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs create my-plugin --dry-run
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --fast
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs doctor --workspace .
agy plugin validate --strict --json plugins/antigravity-meta-plugin-kit
```

## Ground rules

- **Antigravity-only, zero runtime dependencies.** ESM `.mjs`, Node >= 20
  built-ins only. Do not add cross-vendor compatibility shims or npm runtime
  dependencies.
- **Fail-open applies to all hook code.** Anything `create` puts into a hook
  script must resolve to allow/silent with exit 0 on any internal error.
- **Every FS mutation goes through the journal**
  (`plugins/antigravity-meta-plugin-kit/scripts/lib/fsutil.mjs`), so
  `--dry-run` stays exact and free.
- **Docs are bilingual (EN + RU).** Any `README.md` or `docs/guides/*.md`
  change lands in both English and Russian in the same commit with identical
  heading structure (enforced by `test/docs-parity.test.mjs`). Inside this
  checkout, `/meta-mirror` (repo-local `.agents/skills/meta-mirror/`) invokes
  `meta-doc-mirror` to keep mirrors synced.
- **Tests accompany behavior changes.** Logic lives in importable `.mjs`
  functions with unit tests; wire contracts get e2e `spawnSync` tests; payload
  and scaffold profiles stay 0-finding clean under `agy plugin validate --strict --json`.
- **Empirical observations get dated.** When Antigravity updates, run
  `scripts/probe.mjs --fast` (and `--live`), update `docs/internals.md` with
  new observation dates, and recalibrate `scripts/lib/lint.mjs`.

## Layout

| Piece | Path |
|---|---|
| Unified CLI & subcommand entrypoints | `plugins/antigravity-meta-plugin-kit/scripts/{meta-kit,create,lint,probe,doctor}.mjs` |
| Parser, modular linter (`lint/*.mjs`), scaffolder, doctor | `plugins/antigravity-meta-plugin-kit/scripts/lib/` |
| Canonical hook SDK (`io.mjs`) & scaffold templates | `plugins/antigravity-meta-plugin-kit/scripts/templates/plugin/` |
| Public plugin payload (11 skills, 3 agents, 1 rule, logo) | `plugins/antigravity-meta-plugin-kit/` |
| Repo-local doc mirror agent & `/meta-mirror` skill | `.agents/{agents,skills}/` |
| Trap registry & bilingual guides | `docs/internals.md`, `docs/guides/` |
| Test suites | `test/` |

## Commits

Conventional-commit style: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
Update `CHANGELOG.md` for user-visible changes.
