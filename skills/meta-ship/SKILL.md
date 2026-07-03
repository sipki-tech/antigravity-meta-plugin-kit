---
name: meta-ship
description: Ship an Antigravity plugin via GitHub-only npx distribution. Use when the user says "meta-ship" or prepares a release, an update command, CI, or a CHANGELOG for an Antigravity plugin.
---

# meta-ship — release without a registry

## Goal

Distribute the plugin as `npx github:<owner>/<repo> <command>` with a
verifiable install story: verify/uninstall contracts, CI gates, and synced
bilingual docs.

## Instructions

1. Distribution model: no npm publish. Users run
   `npx github:<owner>/<repo> install`. npx caches the checkout — document
   `npx github:<owner>/<repo>#main <command>` as the way to force the latest
   commit, and put `#main` in your `update` examples.
2. Packing gotcha: `npx github:` installs via `npm pack`, which silently
   drops files named `.gitignore` and treats nested `package.json` specially.
   If your repo templates such files, store them renamed (`_gitignore`) and
   rename at generation time.
3. The update pattern: `update` re-runs install, comparing the version in the
   installed `installed_version.json` against the payload's `plugin.json`,
   then prints `old -> new` (or "already up to date") and links the
   CHANGELOG.
4. Contracts to keep:
   - `verify` — named checks `{name, pass, note}` printed as
     `ok /FAIL name (note)`, exit 1 on any fail.
   - `uninstall` — remove the plugin dirs; prune ONLY MCP entries identical
     to what was installed; user-edited entries stay.
5. CI before any tag: matrix ubuntu+macos × Node 20/22 running `npm test`
   plus a smoke job (install into a temp workspace, then verify). Tag only
   on green.
6. Docs per release: CHANGELOG.md (Keep a Changelog; park out-of-scope ideas
   in a `Backlog` subsection instead of half-shipping them). If the repo
   keeps bilingual READMEs, EN and RU change in the same commit, section for
   section.

## Definition of Done

- Fresh-machine test: `npx github:<owner>/<repo>#main install --dry-run`
  works from a clean temp dir.
- `verify` green after a real install; `uninstall` leaves user MCP edits.
- CI green on the release commit; tag pushed after, not before.

## Constraints

- Never overwrite a user-configured MCP server on install.
- No release automation that bypasses the CI gate.

## Rationalizations

- "It works on my machine, ship it" → the loader-ignores-plugin failure mode
  is silent; only `verify` on a clean install proves anything.
- "npx will pick up my push" → it serves the cached checkout; without the
  `#main` hint your users debug a version you already fixed.
- "I'll translate the README next week" → doc drift is permanent; same
  commit or don't touch either.
