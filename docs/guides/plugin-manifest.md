# Plugin manifest & layouts: plugin.json, the two worlds, install paths

*English | [Русский](plugin-manifest.ru.md)*

## The two plugin worlds

Antigravity loads plugins through two surfaces with different expectations:

1. **IDE plugin-manager world** — `~/.gemini/config/plugins/<name>/`
   (mirrored into `~/.gemini/antigravity-cli/plugins/<name>/` when that dir
   exists). Rich manifests, managed installs, `installed_version.json`.
2. **CLI customization-root world** — `<project>/.agents/plugins/<name>/`
   (also `.agent/`, `_agents/`, `_agent/`) or `~/.gemini/config/` globally.
   Officially a plugin here needs only a `plugin.json` with an optional
   `name` (defaults to the directory name); components sit at fixed relative
   paths.

A scaffolded payload satisfies both: it ships the rich manifest (world 1
renders it, world 2 ignores the extra fields) and keeps `hooks.json` at the
plugin root (world 2's official location, world 1 finds it via the manifest
path).

World 2 is a *discovery* mechanism, not an install command — `agy plugin
install` is global-only. To scope a plugin to one project, vendor it under the
project's `.agents/` and commit it; `[OBSERVED 2026-07-12]` both a wrapped
`.agents/plugins/<name>/` and a flat `.agents/skills/<name>/` (plus
`.agents/rules/`, `.agents/hooks.json`, `.agents/mcp_config.json`) are picked
up. In non-interactive `-p` runs name the workspace with `--add-dir <project>`;
interactive sessions use the launch directory.

## plugin.json — the authoring profile

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "One line on what it does.",
  "author": { "name": "you", "email": "optional@example.com" },
  "repository": "https://github.com/you/my-plugin",
  "license": "MIT",
  "keywords": ["antigravity", "plugin"],
  "skills": "./skills",
  "rules": "./rules",
  "hooks": "./hooks.json",
  "interface": {
    "displayName": "My Plugin",
    "shortDescription": "Shown in the plugin manager.",
    "category": "Developer Tools",
    "capabilities": ["Skills", "Rules", "Hooks"],
    "defaultPrompt": ["my-plugin-example show me what you do"],
    "brandColor": "#5B8DEF"
  }
}
```

Field notes:

- **`name`** — must match the payload directory name (lint enforces it).
- **`author`** — **must be an object**, never a bare string; a string can
  trip validation silently (observed 2026-07).
- **`version`** — semver; the IDE plugin-manager copies it into
  `installed_version.json` at install time (you never write that file).
- **`skills` / `rules` / `hooks`** — relative paths; every declared path must
  exist (lint: "declared paths exist").
- **`interface`** — pure UI metadata for the plugin manager; no runtime
  effect. Ship at least `displayName` + `shortDescription`.

## The `installed_version.json` trap — one file, two worlds

`installed_version.json` is an **install-time artifact**, never a payload
file — and the two install paths handle it differently:

- **IDE plugin-manager** writes `{"version": "<semver>"}` into every installed
  plugin dir and uses it to recognize the plugin as installed. A raw hand-copy
  into `~/.gemini/config/plugins/` without it is **silently ignored** by that
  surface — no error, no log line.
- **CLI `agy plugin install`** writes **no** version-file. It records the
  install centrally in `~/.gemini/config/import_manifest.json`, and the
  plugin's skills and hooks still load (probed 2026-07-12).

Consequences:

- let the install path write the file — the IDE plugin-manager does it, and
  `agy plugin install` registers the plugin instead; you write neither;
- never commit it into the payload (the scaffolded `.gitignore` excludes it;
  lint warns if it sneaks in);
- to confirm an install, use `agy plugin list` and `agy plugin validate`
  rather than checking for the file by hand.

## Install layouts

| Scope | Plugin dir | MCP config |
|---|---|---|
| Global | `~/.gemini/config/plugins/<name>/` | `~/.gemini/config/mcp_config.json` |
| Global mirror | `~/.gemini/antigravity-cli/plugins/<name>/` (only when `antigravity-cli/plugins/` exists) | — |
| Workspace | `<project>/.agents/plugins/<name>/` | `<project>/.agents/mcp_config.json` |

Workflows go to `<project>/.agents/workflows/` (mirror into
`.agent/workflows/` only when `.agent/` already exists).

## Loading priority

High → low: workspace discovery → workspace-declared configs
(`skills.json`/`plugins.json`) → global (`~/.gemini/config/`) → built-in →
globally declared. Name conflicts resolve toward the higher priority.

## Registry files (`skills.json` / `plugins.json`)

To load customizations from non-standard locations (e.g. a shared team dir
committed in the repo):

```json
{
  "entries":  [ { "path": "tools/agents/skills" } ],
  "inherits": [ { "path": "/shared/skills.json", "exclude": ["deprecated-.*"] } ]
}
```

Paths: `/abs`, `~/home-relative`, otherwise workspace-relative.

## Pitfalls

- String `author` → silent validation failure.
- A hand-copied dir in the IDE world without `installed_version.json` →
  silently ignored; install through `agy plugin install` instead.
- Manifest `hooks` pointing at `hooks/hooks.json` → works in the IDE world
  but invisible to `agy plugin validate`; keep the file at the root.
- Renaming the payload dir without updating `name` → "name matches
  directory" fails, and world-2 auto-naming changes.

## Checklist

- [ ] `author` is an object; `version` is semver
- [ ] all declared paths exist; `hooks` points at root `hooks.json`
- [ ] `installed_version.json` never committed to the payload (the install
      path writes it, or `agy plugin install` registers instead)
- [ ] `lint` and `agy plugin validate` both green

*See also: [Getting started](getting-started.md) ·
[Hooks](hooks.md) · [trap registry](../internals.md)*
