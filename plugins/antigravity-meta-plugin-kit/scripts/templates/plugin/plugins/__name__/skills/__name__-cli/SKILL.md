---
name: {{name}}-cli
description: >-
  Runs the bundled {{displayName}} CLI (`scripts/cli.mjs`) authenticated via
  `auth.json`. Use when checking {{displayName}} status or running {{name}}
  API commands. Don't use for unrelated shell tasks or editing plugin tests.
---

# {{displayName}} CLI

This plugin uses the lightweight **bundled CLI + `auth.json` + skill** pattern
instead of a long-running MCP server.

## Commands

Resolve `$PLUGIN_DIR` to this plugin's root directory (two levels above this
`SKILL.md`, i.e., parent of `skills/`):

```bash
# Check wiring without credentials
node "$PLUGIN_DIR/scripts/cli.mjs" ping --json

# Check authenticated status ({{ENV_PREFIX}}_API_KEY injected via auth.json / env)
node "$PLUGIN_DIR/scripts/cli.mjs" status --json
```

> Note: `auth.json` declares `"clis": ["{{name}}"]` for when you publish a
> `bin/{{name}}` executable wrapper on `PATH`; during Node development invoke
> `node "$PLUGIN_DIR/scripts/cli.mjs"` directly.

## Rules

- Always pass `--json` when parsing command output programmatically.
- Never print or echo `{{ENV_PREFIX}}_API_KEY` to stdout or commit literal
  secrets into `auth.json`.
