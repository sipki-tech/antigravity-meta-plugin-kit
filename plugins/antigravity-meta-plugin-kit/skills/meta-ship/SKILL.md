---
name: meta-ship
description: Ship an Antigravity plugin via the native agy plugin install path. Use when the user says "meta-ship" or prepares a release, CI, or a CHANGELOG for an Antigravity plugin.
---

# meta-ship — release through Antigravity's own plugin system

## Goal

Distribute the plugin natively — `agy plugin install
https://github.com/<owner>/<repo>` — with a verifiable install story: the
official validator, CI gates, and synced bilingual docs. No npm publish, no
`npx`, no hand-rolled installer.

## Instructions

1. Distribution model: **native**. Users run
   `agy plugin install https://github.com/<owner>/<repo>`. The CLI clones the
   repo, finds each plugin under a top-level `plugins/` directory ("bulk
   plugins directory"), copies it into `~/.gemini/config/plugins/`, and
   registers it in `~/.gemini/config/import_manifest.json`. Tell users to
   restart Antigravity afterwards. A local checkout works too:
   `agy plugin install <dir>`.
2. Manage state natively — document the ones that apply:
   `agy plugin list` (tracks CLI-installed plugins), `agy plugin
   enable|disable <name>`, `agy plugin uninstall <name>`. **Update** = re-run
   `agy plugin install <url>` (it re-clones). There is no separate `update`
   subcommand and no version-diff to print — link the CHANGELOG instead.
3. `installed_version.json`: never ship it. It is an install-time artifact of
   the IDE plugin-manager; the CLI `agy plugin install` path registers the
   plugin in `import_manifest.json` and writes no version-file (skills still
   load — probed 2026-07-12). Lint warns if it is committed.
4. Distribution beyond a raw GitHub URL: marketplaces —
   `agy plugin install <plugin>@<marketplace>`, and `agy plugin link
   <marketplace> <target>` to link one; Claude Code users can be pointed at
   `agy plugin import claude`. Mention what applies in the README.
5. Pre-release gates: this kit's `lint` (zero FAIL, zero warnings) AND the
   official `agy plugin validate plugins/<name>` must both be clean — they
   cover different ground. CI before any tag: matrix ubuntu+macos × Node
   20/22 running `npm test`, plus a structural-validation step (`agy plugin
   validate` when `agy` is on PATH). Tag only on green.
6. Docs per release: CHANGELOG.md (Keep a Changelog; park out-of-scope ideas
   in a `Backlog` subsection instead of half-shipping them). If the repo
   keeps bilingual READMEs, EN and RU change in the same commit, section for
   section.

## Definition of Done

- Fresh-machine test: `agy plugin install https://github.com/<owner>/<repo>`
  succeeds, `agy plugin list` shows the plugin, a live session sees its
  skills, and `agy plugin uninstall <name>` removes it cleanly.
- `lint` and `agy plugin validate` both clean on the release commit.
- CI green on the release commit; tag pushed after, not before.

## Constraints

- Keep hooks fail-open: exit 0 and valid JSON on every path, or a throwing
  hook breaks the user's session regardless of how it was installed.
- No release automation that bypasses the CI gate.
- The payload ships as a bare plugin directory under `plugins/` — no bundled
  installer, no `bin/` CLI; the Antigravity CLI does the installing.

## Rationalizations

- "It works on my machine, ship it" → the loader-ignores-plugin failure mode
  is silent; only a clean `agy plugin install` from GitHub followed by
  `agy plugin list` (and a session that sees the skills) proves anything.
- "I'll add an installer so users don't need agy" → the plugin only runs
  inside Antigravity, which ships `agy`; a parallel installer just duplicates
  `agy plugin install` and drifts from it.
- "I'll translate the README next week" → doc drift is permanent; same
  commit or don't touch either.
