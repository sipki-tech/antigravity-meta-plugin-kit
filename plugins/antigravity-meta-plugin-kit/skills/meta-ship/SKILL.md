---
name: meta-ship
description: >-
  Release and distribute a Google Antigravity plugin via agy plugin install,
  Antigravity Marketplace pre-flight, offline CI gates, and SemVer changelogs.
  Use when the user says "meta-ship" or prepares a release, CI workflow, or
  Marketplace submission. Don't use for initial scaffolding or hook design.
---

# meta-ship — release native Google Antigravity plugins

## Goal

Ship a plugin natively through `agy plugin install` (GitHub URL or Antigravity
Marketplace) with green offline + validator CI gates, clean `plugin.json`
metadata, and reproducible version history.

## Instructions

1. **Native GitHub distribution:**
   - Users install directly with:
     `agy plugin install https://github.com/<owner>/<repo>`
   - Update = re-run `agy plugin install <url>` (atomic swap).
   - Native lifecycle commands: `agy plugin list`, `agy plugin enable|disable
     <name>` (stored in `~/.gemini/config/config.json`), `agy plugin uninstall
     <name>`.
   - Per-project scoping = vendor the payload under `<project>/.agents/plugins/<name>/`
     and commit it (`agy plugin install` is global-only).
2. **Antigravity Marketplace pre-flight checklist:**
   - `plugin.json` is **strict JSON** (no JSONC comments/trailing commas).
   - `name`: strict lowercase kebab-case; `displayName`: no leading
     `"Antigravity"` prefix.
   - `version`: SemVer; `description`: concise 120–160 chars; `homepage` &
     `repository`: valid `https://` URLs.
   - `logo`: local 1:1 square `.svg`/`.png` (>=128x128, ~10% transparent
     margin, readable on Light & Dark themes, never inside `.github/`).
   - `suggestedPrompts`: 1–3 crisp starter prompts (max 3).
   - Root `README.md` inside the plugin (rendered in Marketplace UI) and `0755`
     executable permissions on helper scripts.
   - If publishing a catalog `marketplace.json`: validate with **both**
     `node "$KIT/scripts/meta-kit.mjs" lint --strict marketplace.json` and
     `agy plugin validate --strict marketplace.json` (`plugins[i].source` must
     be an object `{"type": "archive", "url": "https://...", "sha256": "<64-hex>"}`
     — `agy 1.5.17` rejects `"git"`, `"github"`, string sources, and entries
     without `sha256`).
3. **Pre-release gates (in order):**
   1. `npm test` — green locally.
   2. `node "$KIT/scripts/meta-kit.mjs" lint --strict .` — 0 FAIL, 0 warnings (this also
      serves as the offline CI gate on GitHub Actions where `agy` is absent).
   3. `agy plugin validate --strict --json plugins/<name>` — `findings: []`.
   4. Fresh install check: `agy plugin install plugins/<name>` -> `agy plugin
      list` -> quick `agy -p` smoke -> `agy plugin uninstall <name>`.
   5. CI green (ubuntu + macOS × Node 20/22); push git tag **after** CI passes.
4. **Release notes:** update `CHANGELOG.md` (Keep a Changelog) and keep EN/RU
   docs in sync if the repo is bilingual.

## Definition of Done

- `npm test`, `lint.mjs --strict`, and `agy plugin validate --strict --json`
  are all green with 0 warnings on the release commit.
- Clean `agy plugin install` -> `agy plugin list` -> `agy plugin uninstall`
  round-trip verified.
- CI green before tagging.

## Constraints

- Never commit `installed_version.json` or symlinks escaping the plugin root
  (rejected by `agy plugin install`).
- Never bundle a custom Node installer — Antigravity CLI handles installation.

## Rationalizations

- "CI passed so `agy plugin validate` must be fine" -> GitHub Actions runners
  usually don't have `agy` installed; always run `lint.mjs --strict` in CI AND
  `agy plugin validate --strict --json` locally before tagging.
