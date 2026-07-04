# antigravity-meta-plugin-kit

English | [Русский](README.ru.md)

A meta-kit for authoring [Antigravity](https://antigravity.google) plugins:
a **scaffolder**, a **linter**, and a **skill set** that teach an AI agent
(or a human) to build correct plugins without rediscovering the loader's
undocumented traps.

## Why

Antigravity's plugin loader has failure modes that are silent and
undocumented: a plugin without `installed_version.json` is ignored without a
word; a string `author` trips validation; a throwing hook breaks the user's
session. This kit encodes every trap — from the official in-CLI docs
(2026-07) and from field observation (see
[docs/internals.md](docs/internals.md)) — into a generator and a linter, so
the knowledge is executable instead of tribal.

It complements the official structural validator: run
`agy plugin validate plugins/<name>` for CLI-world structure
(skills/agents/commands/mcpServers/root hooks.json) and this kit's `lint` for
the IDE-world traps plus rules, workflows, and style that the official
validator ignores.

## Quick start

```bash
# scaffold a new plugin repository into ./my-plugin/
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin

# preview without writing anything
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --dry-run

# validate an existing plugin (payload dir or scaffolded repo root)
npx github:sipki-tech/antigravity-meta-plugin-kit lint my-plugin

# also scaffold an example subagent (agents/*.toml — undocumented format)
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --with-agents

# force the latest commit past the npx cache
npx github:sipki-tech/antigravity-meta-plugin-kit#main create my-plugin
```

## What `create` generates

```
my-plugin/
├── plugins/my-plugin/          # the plugin payload
│   ├── plugin.json             # object author, interface block, all fields
│   ├── hooks.json              # at the ROOT (official location); named hooks;
│   │                           # example fail-open PreToolUse guard
│   ├── scripts/example-guard.mjs + scripts/lib/io.mjs  # runHook() fail-open wrapper,
│   │                           # official decision dialect (+legacy compat)
│   ├── skills/my-plugin-example/SKILL.md   # frontmatter + trigger phrase
│   │   └── resources/prompt-template.md    # XML-sectioned prompt template
│   ├── agents/                 # only with --with-agents (example subagent)
│   ├── rules/style.md
│   └── mcp_config.json
├── installer/                  # journal/dry-run, layout detection,
│                               # installed_version.json, non-destructive MCP merge
├── bin/cli.mjs                 # install | verify | uninstall, --workspace, --dry-run
├── test/                       # unit + e2e (node --test), green out of the box
└── .github/workflows/ci.yml
```

## Lint checks

Exit 1 on any FAIL; warnings and notes never affect the exit code.

| Check | Trap it covers |
|---|---|
| plugin.json exists / parses / name matches dir | basic manifest integrity |
| author is an object | string author trips validation |
| version is semver, interface declared | plugin-manager display |
| declared paths exist (skills/rules/hooks) | dangling manifest refs |
| every skill has SKILL.md; frontmatter valid | skills that never load |
| skill descriptions carry a trigger | skills that never route |
| hooks.json parses / declares named hooks | event name at top level (Claude Code-style config never loads) |
| hook entries well-formed (5 events, both shapes, type=command) | malformed handlers |
| hook timeouts sane | non-numeric/negative timeouts |
| hook scripts exist / fail-open | session-breaking hooks |
| agents/*.toml minimally valid | broken subagent definitions |
| mcp: non-builtin commands ship disabled | missing binary breaks sessions |
| workflows have description frontmatter | broken /slash-commands |
| rules non-empty | dead manifest ref |

Warnings (never affect the exit code): hooks.json not at the plugin root
(`agy plugin validate` won't see it), duplicated hooks.json with drift,
missing/oversized timeouts (official default is 30s of blocking), unknown
hook events (`SessionStart` gets a "refuted" note), skill-name style, a
committed `installed_version.json`.

The fail-open check is a heuristic (a `runHook(` wrapper or a try/catch
around the body) — it catches the common miss, not every unsafe script.
The `installed_version.json` trap surfaces as a warning/note, since it is an
install-time artifact, not a payload file.

## Skills

Five portable Agent Skills under [skills/](skills/): `meta-scaffold`,
`meta-hooks`, `meta-skills`, `meta-test`, `meta-ship`. To use them, copy a
skill directory into your host's skills dir — `~/.claude/skills/` (Claude
Code), `~/.codex/skills/` (Codex), `<project>/.agents/skills/` or your
plugin's `skills/` (Antigravity).

## The trap list

[docs/internals.md](docs/internals.md) is the canonical record of every
observed loader trap and hook wire format, annotated with observation dates.
The linter implements it; the skills reference it.

## Relationship to antigravity-kit

[antigravity-kit](https://github.com/sipki-tech/antigravity-kit) is the
reference implementation every pattern here was extracted from — and the
first consumer of this linter: CI clones it and lints its payload on every
push (the dogfood gate).

## Development

```bash
npm test          # node --test; includes the dogfood suite when
                  # ../antigravity-kit is checked out (or AGY_KIT_PAYLOAD is set)
```

Zero runtime dependencies (Node ≥18 built-ins only). See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
