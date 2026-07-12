# {{name}}

An Antigravity plugin, scaffolded by
[antigravity-meta-plugin-kit](https://github.com/sipki-tech/antigravity-meta-plugin-kit).

TODO: describe what {{name}} does.

## Install

Push this repo to GitHub, then install with the Antigravity CLI — it clones the
repo, registers the plugin, and restart Antigravity to pick it up:

```bash
agy plugin install https://github.com/TODO-owner/{{name}}
```

Manage it natively: `agy plugin list`, `agy plugin disable {{name}}`,
`agy plugin uninstall {{name}}`. To install from a local checkout instead of
GitHub: `agy plugin install plugins/{{name}}`.

## Layout

| Piece | Path |
|---|---|
| Plugin payload | `plugins/{{name}}/` |
| Tests | `test/` (`npm test`) |

## Development

```bash
npm test
# official structural validator (skills/agents/mcpServers/root hooks.json):
agy plugin validate plugins/{{name}}
```

For the deeper IDE-world trap checks (rules, workflows, manifest style,
trigger-phrase routing) run the meta-plugin-kit linter from a checkout:

```bash
git clone https://github.com/sipki-tech/antigravity-meta-plugin-kit
node antigravity-meta-plugin-kit/plugins/antigravity-meta-plugin-kit/scripts/lint.mjs .
```

Keep hooks fail-open (any internal error must resolve to allow, exit 0). Never
commit `installed_version.json` — it is an install-time artifact: the IDE
plugin-manager writes it into the installed copy, while `agy plugin install`
tracks the plugin in `~/.gemini/config/import_manifest.json` instead.
