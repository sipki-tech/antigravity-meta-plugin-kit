# {{name}}

An Antigravity plugin, scaffolded by
[antigravity-meta-plugin-kit](https://github.com/sipki-tech/antigravity-meta-plugin-kit).

TODO: describe what {{name}} does.

## Install

```bash
# global — all workspaces
node bin/cli.mjs install

# per-project (committable)
node bin/cli.mjs install --workspace

# preview without writing anything
node bin/cli.mjs install --dry-run

# health check / removal
node bin/cli.mjs verify
node bin/cli.mjs uninstall
```

Once pushed to GitHub, the same commands work remotely:
`npx github:TODO-owner/{{name}} install`.

## Layout

| Piece | Path |
|---|---|
| Plugin payload | `plugins/{{name}}/` |
| Installer | `installer/` + `bin/cli.mjs` |
| Tests | `test/` (`npm test`) |

## Development

```bash
npm test
# re-lint after any payload change:
npx github:sipki-tech/antigravity-meta-plugin-kit lint .
# official structural validator (checks skills/agents/mcpServers/root hooks.json):
agy plugin validate plugins/{{name}}
```

Run both validators: `agy plugin validate` covers the CLI-world structure;
the meta-plugin-kit linter covers the IDE-world traps plus rules, workflows,
and style that the official validator ignores.

Keep hooks fail-open (any internal error must resolve to allow, exit 0) and
never commit `installed_version.json` — the installer writes it at install
time; without it the Antigravity loader silently ignores the plugin.
