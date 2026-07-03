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
```

Keep hooks fail-open (any internal error must resolve to allow, exit 0) and
never commit `installed_version.json` — the installer writes it at install
time; without it the Antigravity loader silently ignores the plugin.
