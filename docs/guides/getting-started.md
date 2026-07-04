# Getting started: from zero to an installed Antigravity plugin

*English | [Русский](getting-started.ru.md)*

This guide walks the full path: scaffold → lint → test → install → verify.
Time budget: about five minutes.

## 1. Scaffold

```bash
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin
cd my-plugin
```

Names are kebab-case (`my-plugin`, not `My_Plugin`). Add `--dry-run` to see
the exact file plan without writing, `--dir <parent>` to scaffold elsewhere,
`--with-agents` to include an example subagent.

You get a complete repository: the payload under `plugins/my-plugin/`, an
installer (`installer/` + `bin/cli.mjs`), tests, and CI. Everything is wired
so that the four verification commands below pass immediately — your job is
to replace the examples with real behavior, re-running the gates as you go.

## 2. Lint

```bash
npx github:sipki-tech/antigravity-meta-plugin-kit lint .
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
stdin/stdout wire) and the installer (dry-run writes nothing; install +
verify pass; uninstall preserves user MCP entries). Extend it as you add
behavior — the [testing guide](testing.md) explains the doctrine.

## 4. Install

```bash
# per-project (committable, shows up in <project>/.agents/)
node bin/cli.mjs install --workspace

# global (all workspaces): ~/.gemini/config/plugins/my-plugin/
node bin/cli.mjs install

# always available:
node bin/cli.mjs install --dry-run
```

The installer copies the payload, writes `installed_version.json` (without
it the loader silently ignores the plugin), and merges MCP servers
non-destructively. Restart Antigravity to pick the plugin up.

## 5. Verify

```bash
node bin/cli.mjs verify --workspace   # or without the flag for global
```

Named checks: plugin dir, manifest parses, author is an object,
installed_version present and matching, hooks.json declares a named hook,
guard script present. Exit 1 on any failure.

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
- [ ] real install + `verify` — green
- [ ] examples replaced with real behavior (no TODO left in plugin.json)
