---
name: meta-scaffold
description: >-
  Scaffold and architect a native Google Antigravity plugin repository (agy
  1.5.17+). Use when the user says "meta-scaffold" or asks to start, structure,
  or choose components for a new Antigravity plugin. Don't use for editing
  hooks or writing SKILL.md bodies in an existing plugin.
---

# meta-scaffold — start an Antigravity plugin from a verified skeleton

## Goal

Produce a clean, publishable Google Antigravity plugin repository that passes
both `agy plugin validate --strict --json` and this kit's `lint.mjs --strict`
out of the box, with the right component architecture from day one.

## Bundled tools

Run `create.mjs` and `lint.mjs` from this kit's install directory (`$KIT` =
`~/.gemini/config/plugins/antigravity-meta-plugin-kit` for global install, or
`<project>/.agents/plugins/antigravity-meta-plugin-kit` if vendored).

## Instructions

1. Pick the right Antigravity components before generating anything:
   - **On-demand procedure / slash command** -> `skills/<name>/SKILL.md` (add
     `disable-model-invocation: true` for explicit `/cmd`-only workflows).
   - **Isolated specialist persona / parallel worker** -> `agents/<name>.md`
     (see `meta-agents`; wrap in a slash skill if users need `/<cmd>`).
   - **Always-on or scoped constraints** -> `rules/AGENTS.md` (always-on, no
     frontmatter) or `rules/<name>.md` with `trigger:` (see `meta-rules`).
   - **Deterministic enforcement / arg rewrite / loop gate** -> root
     `hooks.json` + fail-open script (see `meta-hooks`).
   - **External service integration** -> `mcp_config.json` (Streamable HTTP /
     Stdio / MCP Apps) OR a self-contained CLI in `scripts/` + `auth.json` +
     skill (see `meta-mcp`).
   - **Background daemon / scheduler / Aux Pane UI** ->
     `sidecars/<id>/sidecar.json`.
   - **Never use** `workflows/*.md`, `commands/`, or `agents/*.toml` in plugins.
2. Scaffold the repository:
   ```bash
   node "$KIT/scripts/meta-kit.mjs" create <kebab-name> [--minimal] [--with-agents] [--with-sidecar] [--with-cli] [--manifest-layout root|dot-antigravity] [--dry-run]
   ```
   Combine `--minimal --with-cli` for the lightweight Google Workspace pattern
   (bundled Node CLI + `auth.json` + skill, zero hooks or MCP overhead).
3. Know the flat `plugin.json` schema (`agy 1.5.17+`):
   - Supported fields: `name`, `displayName` (no leading `"Antigravity"`),
     `version`, `description`, `logo` (`assets/logo.svg`, square >=128x128),
     `author` (string or `{name, url?, email?}`), `homepage`, `repository`
     (`https://`), `license`, `keywords`, `category`, `suggestedPrompts`
     (max 3), `disabled`, `skills`, `extensions["com.google.antigravity"]`.
   - **Never add** `interface`, `rules`, `hooks`, `agents`, or `mcpServers` to
     `plugin.json` — they are ignored and fail `--strict`.
   - Keep `plugin.json` **strict JSON** (no comments/trailing commas — `agy
     plugin install` rejects JSONC).
4. Replace the `TODO` placeholders, then run all three gates:
   ```bash
   npm test
   node "$KIT/scripts/meta-kit.mjs" lint --strict .
   agy plugin validate --strict --json plugins/<name>
   ```
5. Verify installation: `agy plugin install plugins/<name>`, confirm with
   `agy plugin list`, clean up with `agy plugin uninstall <name>`.

## Definition of Done

- `npm test`, `lint.mjs --strict`, and `agy plugin validate --strict --json`
  all pass with 0 errors and 0 warnings (and 0 notes once `logo` is set).
- No `TODO` placeholders remain in `plugin.json` or `README.md`.

## Constraints

- Keep zero runtime dependencies in generated plugins (Node >= 20 built-ins).
- Never commit `installed_version.json` — Antigravity tracks enablement in
  `~/.gemini/config/config.json` and installs in `import_manifest.json`.

## Rationalizations

- "I'll hand-write `plugin.json` and `rules/style.md`" -> hand-written files
  regularly miss `trigger:` on `rules/*.md`, add dead `interface` keys, or omit
  `logo`; start from `create.mjs` and edit.
- "I'll use `workflows/` for my `/cmd`" -> plugins never load Markdown
  workflows in `agy 1.5.17`; ship a skill with `disable-model-invocation: true`.
