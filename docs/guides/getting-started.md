# Getting started: from zero to an installed Antigravity plugin

*English | [Русский](getting-started.ru.md)*

This guide walks the full path: scaffold → lint → test → install → confirm.
Time budget: about five minutes.

## 1. Scaffold

```bash
S="$(pwd)/plugins/antigravity-meta-plugin-kit/scripts"   # absolute — survives the cd below
node "$S/create.mjs" my-plugin
cd my-plugin
```

Names are kebab-case (`my-plugin`, not `My_Plugin`). Add `--dry-run` to see
the exact file plan without writing, `--dir <parent>` to scaffold elsewhere,
`--with-agents` to include an example subagent.

You get a complete **native-only** repository: the payload under
`plugins/my-plugin/`, tests, and CI — installed via `agy plugin install`, with
no bundled installer. Everything is wired so that the gates below pass
immediately — your job is to replace the examples with real behavior,
re-running the gates as you go.

## 2. Lint

```bash
node "$S/lint.mjs" .
```

`lint` accepts a payload dir or a scaffolded repo root. It prints named
checks (`ok /FAIL name (note)`), then warnings, then notes, and exits 1 on
any FAIL. Every check maps to a real loader failure mode — see the
[trap registry](../internals.md).

Also run the official structural validator (ships with the `agy` CLI):

```bash
agy plugin validate plugins/my-plugin
```

The two cover different ground: `agy` checks CLI-world structure
(skills/agents/commands/mcpServers/root hooks.json); `lint` checks IDE-world
manifest traps, hook content, rules, workflows, and style.

## 3. Test

```bash
npm test
```

The scaffolded suite covers the example hook (unit + e2e over the real
stdin/stdout wire) and any bundled `scripts/` tool (dry-run writes nothing).
Extend it as you add behavior — the [testing guide](testing.md) explains the
doctrine.

## 4. Install

```bash
# install the local payload dir straight through the Antigravity CLI
agy plugin install plugins/my-plugin
```

The CLI copies the payload into `~/.gemini/config/plugins/my-plugin/`,
registers it in `~/.gemini/config/import_manifest.json`, and resolves any
MCP config the plugin ships. Restart Antigravity to pick the plugin up. To
install from GitHub instead, pass the repo URL:
`agy plugin install https://github.com/you/my-plugin`.

## 5. Confirm

```bash
agy plugin list                 # the plugin should be listed
```

`agy plugin list` shows CLI-installed plugins — the fastest confirmation the
install registered. A live session that fires the plugin's skills is the final
proof; `agy plugin uninstall my-plugin` removes it cleanly.

## Where to go next

| You want to… | Guide |
|---|---|
| understand plugin.json and install paths | [Plugin manifest & layouts](plugin-manifest.md) |
| gate/inject/keep-alive with hooks | [Hooks](hooks.md) |
| write skills that actually fire | [Skills](skills.md) |
| add subagents | [Subagents](agents.md) |
| add rules or /slash-command workflows | [Rules & workflows](rules-workflows.md) |
| bundle MCP servers | [MCP servers](mcp.md) |
| release it | [Shipping](shipping.md) |

## Checklist

- [ ] `lint` — zero FAIL, zero warnings
- [ ] `agy plugin validate` — `[ok]`, hooks processed
- [ ] `npm test` — green
- [ ] real `agy plugin install` + `agy plugin list` — plugin listed
- [ ] examples replaced with real behavior (no TODO left in plugin.json)
