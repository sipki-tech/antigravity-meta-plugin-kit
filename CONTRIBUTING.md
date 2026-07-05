# Contributing

## Setup

```bash
git clone https://github.com/sipki-tech/antigravity-meta-plugin-kit
cd antigravity-meta-plugin-kit
npm test    # node --test; no install step, no build step
```

For the full dogfood suite, check out the reference repo as a sibling
(`../antigravity-kit`) or set `AGY_KIT_PAYLOAD` to its payload dir.

## Ground rules

- **Zero runtime dependencies.** ESM `.mjs`, Node ≥18 built-ins only. PRs
  adding dependencies need extraordinary justification.
- **Fail-open applies to template code.** Anything `create` puts into a hook
  script must resolve to allow/silent with exit 0 on any internal error —
  scaffolded plugins inherit our bugs.
- **Lint rules are calibrated, not idealized.** Every rule must pass on the
  reference payload (antigravity-kit); the dogfood CI job is a hard gate. If
  a new rule fails there, the rule is wrong until proven otherwise — never
  weaken a check silently to make dogfood pass; surface the finding instead.
- **Every FS mutation goes through the journal** (`lib/fsutil.mjs`), so
  `--dry-run` stays exact and free.
- **Docs are bilingual.** Any README change lands in both `README.md` and
  `README.ru.md` in the same commit, section for section. Code, comments and
  all other artifacts are English.
- **Tests accompany behavior changes.** Logic lives in importable `.mjs`
  functions with unit tests; wire contracts get e2e `spawnSync` tests.
- **Preview observations get dated.** If Antigravity behaves differently
  from `docs/internals.md`, update the entry with the new observation date.

## Layout

| Piece | Path |
|---|---|
| CLI | `bin/cli.mjs` |
| Scaffolder / linter / helpers | `lib/` |
| The kit's own installer | `installer/` |
| The kit's plugin payload (skills, subagents, workflows) | `plugins/antigravity-meta-plugin-kit/` |
| Scaffold templates | `templates/plugin/` (note `_gitignore`, `_package.json` — npm-packlist workaround; deliberately NOT shared with `installer/` — scaffolds must be standalone) |
| Trap registry / guides | `docs/internals.md`, `docs/guides/` (bilingual) |
| Tests | `test/` |

## Commits

Conventional-commit style: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
Update `CHANGELOG.md` for user-visible changes; park out-of-scope ideas in
its Backlog subsection.
