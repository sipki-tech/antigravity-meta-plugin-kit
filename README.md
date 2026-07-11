# antigravity-meta-plugin-kit — Google Antigravity plugin development toolkit

**Scaffold, lint, and ship [Google Antigravity](https://antigravity.google)
plugins without rediscovering the loader's undocumented traps.** A
zero-dependency Node.js toolkit: a plugin generator, a trap-aware linter, a
set of portable Agent Skills, and bilingual guides for every part of the
Antigravity customization system — plugins, skills (SKILL.md), hooks
(hooks.json), rules, workflows, subagents, and MCP servers.

[![CI](https://github.com/sipki-tech/antigravity-meta-plugin-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sipki-tech/antigravity-meta-plugin-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-success)

English | [Русский](README.ru.md)

---

- [Why this exists](#why-this-exists)
- [Quick start](#quick-start)
- [Install as a plugin](#install-as-a-plugin)
- [What `create` generates](#what-create-generates)
- [Lint checks](#lint-checks)
- [Guides](#guides)
- [Skills](#skills)
- [The trap registry](#the-trap-registry)
- [Relationship to `agy plugin validate`](#relationship-to-agy-plugin-validate)
- [Relationship to antigravity-kit](#relationship-to-antigravity-kit)
- [FAQ](#faq)
- [Development](#development)
- [License](#license)

## Why this exists

The Antigravity plugin loader has failure modes that are **silent**: a plugin
without `installed_version.json` is ignored without a word; a string `author`
trips validation; a throwing hook breaks the user's whole session; a skill
whose description lacks a trigger phrase simply never fires. Some contracts
are documented only inside the CLI binary's built-in docs; others exist only
as field observations.

This kit turns that knowledge into executable form:

- **`create`** — generates a plugin repository that is correct by
  construction: manifest, root `hooks.json` with a fail-open guard, a
  SKILL.md that routes, an installer with dry-run, tests that pass out of the
  box, CI.
- **`lint`** — validates any plugin payload against every known trap, with
  named checks and warnings.
- **Skills + guides** — teach an AI agent (or a human) the whole system, with
  provenance for every claim ([docs/internals.md](docs/internals.md)).

## Quick start

```bash
# scaffold a new plugin repository into ./my-plugin/
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin

# preview without writing anything
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --dry-run

# also scaffold an example subagent (agents/*.toml — undocumented format)
npx github:sipki-tech/antigravity-meta-plugin-kit create my-plugin --with-agents

# validate an existing plugin (payload dir or scaffolded repo root)
npx github:sipki-tech/antigravity-meta-plugin-kit lint my-plugin

# force the latest commit past the npx cache
npx github:sipki-tech/antigravity-meta-plugin-kit#main create my-plugin
```

Then, inside the scaffold:

```bash
cd my-plugin
npm test                                   # green out of the box
node bin/cli.mjs install --workspace       # install into ./.agents/
node bin/cli.mjs verify --workspace        # named health checks
agy plugin validate plugins/my-plugin      # official structural validator
```

## Install as a plugin

The meta-kit is itself an Antigravity plugin. Installing it puts the six
meta skills, four authoring subagents, and the `/meta-*` slash commands
straight into your sessions:

```bash
# global — all workspaces (restart Antigravity afterwards)
npx github:sipki-tech/antigravity-meta-plugin-kit install

# per-project (committable)
npx github:sipki-tech/antigravity-meta-plugin-kit install --workspace

# add /meta-* slash commands to the current project (after a global install)
npx github:sipki-tech/antigravity-meta-plugin-kit workflows

# health check / refresh / removal
npx github:sipki-tech/antigravity-meta-plugin-kit verify
npx github:sipki-tech/antigravity-meta-plugin-kit#main update
npx github:sipki-tech/antigravity-meta-plugin-kit uninstall
```

The bundled subagents (formats: 3× TOML, 1× markdown — both validated):

| Subagent | Rights | Job |
|---|---|---|
| `meta-payload-auditor` | read-only | semantic payload review beyond mechanical lint: trigger quality, hook-script logic, manifest coherence |
| `meta-hook-smith` | read-only | designs hooks: picks the event, produces the hooks.json block, a fail-open script, and tests |
| `meta-trap-scout` | terminal (read-effect) | detects drift between the installed Antigravity and the documented contracts |
| `meta-doc-mirror` | writes `*.ru.md` only | keeps bilingual docs in lockstep, section for section |

Workflow wrappers give them deterministic entry points: `/meta-audit`,
`/meta-hook`, `/meta-scout`, `/meta-mirror` (agents don't auto-surface as
slash commands — see the [subagents guide](docs/guides/agents.md)).

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
| agents/* minimally valid (toml + md) | broken subagent definitions |
| mcp: non-builtin commands ship disabled | missing binary breaks sessions |
| workflows have description frontmatter | broken /slash-commands |
| rules non-empty | dead manifest ref |

Warnings (never affect the exit code): hooks.json not at the plugin root
(`agy plugin validate` won't see it), duplicated hooks.json with drift,
missing/oversized timeouts (official default is 30s of blocking), unknown
hook events (`SessionStart` gets an "unverified contract" note — it surfaced
in the 1.1.1 binary but is still undocumented), skill-name style, a
committed `installed_version.json`.

The fail-open check is a heuristic (a `runHook(` wrapper or a try/catch
around the body) — it catches the common miss, not every unsafe script.
The `installed_version.json` trap surfaces as a warning/note, since it is an
install-time artifact, not a payload file.

## Guides

Deep dives for every block of the Antigravity customization system, each in
English and Russian:

| Guide | Covers |
|---|---|
| [Getting started](docs/guides/getting-started.md) · [RU](docs/guides/getting-started.ru.md) | scaffold → lint → test → install → verify, end to end |
| [Using the plugin](docs/guides/using-the-plugin.md) · [RU](docs/guides/using-the-plugin.ru.md) | day-to-day: skill triggers, /meta-* commands, delegating to subagents, troubleshooting |
| [Plugin manifest & layouts](docs/guides/plugin-manifest.md) · [RU](docs/guides/plugin-manifest.ru.md) | plugin.json fields, the two plugin worlds, installed_version.json, install paths |
| [Hooks](docs/guides/hooks.md) · [RU](docs/guides/hooks.ru.md) | the five documented events (+ SessionStart status), official wire contracts, fail-open law, matchers, timeouts |
| [Skills](docs/guides/skills.md) · [RU](docs/guides/skills.ru.md) | SKILL.md anatomy, trigger phrases, progressive disclosure, XML prompt templates |
| [Subagents](docs/guides/agents.md) · [RU](docs/guides/agents.ru.md) | agents/*.toml format, models, prompts, validation |
| [Rules & workflows](docs/guides/rules-workflows.md) · [RU](docs/guides/rules-workflows.ru.md) | GEMINI.md/AGENTS.md hierarchy, rule triggers, workflow slash-commands |
| [MCP servers](docs/guides/mcp.md) · [RU](docs/guides/mcp.ru.md) | mcp_config.json, stdio/SSE transports, the disabled:true convention, merge/prune |
| [Testing](docs/guides/testing.md) · [RU](docs/guides/testing.ru.md) | zero-dep node --test doctrine, hook e2e, dry-run assertions |
| [Shipping](docs/guides/shipping.md) · [RU](docs/guides/shipping.ru.md) | npx github: distribution, update pattern, marketplaces, CI gates, versioning |
| [Researching Antigravity](docs/guides/researching-antigravity.md) · [RU](docs/guides/researching-antigravity.ru.md) | where every fact came from: built-in docs, binary strings, validator probes — and how to repeat it after updates |

## Skills

Six portable Agent Skills under
[plugins/antigravity-meta-plugin-kit/skills/](plugins/antigravity-meta-plugin-kit/skills/):
`meta-scaffold`, `meta-hooks`, `meta-skills`, `meta-agents`, `meta-test`,
`meta-ship`. The
[plugin install](#install-as-a-plugin) delivers them into Antigravity; for
other hosts, copy a skill directory into `~/.claude/skills/` (Claude Code)
or `~/.codex/skills/` (Codex).

## The trap registry

[docs/internals.md](docs/internals.md) is the canonical record of every
loader trap, hook wire format, and component convention — each claim tagged
`[OFFICIAL 2026-07]`, `[OBSERVED 2026-07]`, or `[MEDIUM]`, with a
"Refuted rumors" section that dates its own reversals (`SessionStart`:
refuted on 1.0.16, surfaced in the 1.1.1 binary, contract still
unverified). The linter
implements it; the skills and guides reference it.

## Relationship to `agy plugin validate`

Antigravity ships its own structural validator. Run **both**:

| | `agy plugin validate` | this kit's `lint` |
|---|---|---|
| skills / agents / commands / mcpServers structure | ✔ | partially |
| root hooks.json presence | ✔ | ✔ (+ content, timeouts, fail-open) |
| manifest style (author object, interface, semver) | — | ✔ |
| rules/ and workflows/ | — | ✔ |
| trigger-phrase routing, skill style | — | ✔ |
| installed_version.json trap | — | ✔ (warn/note) |

## Relationship to antigravity-kit

[antigravity-kit](https://github.com/sipki-tech/antigravity-kit) is the
reference implementation every pattern here was extracted from — and the
first consumer of this linter: CI clones it and lints its payload on every
push (the dogfood gate).

## FAQ

**Does this work with the Antigravity IDE, the CLI (`agy`), or both?**
Both. The scaffold targets the rich IDE plugin-manager profile and stays
compatible with the CLI customization-root world (root `hooks.json`, minimal
manifest requirements). See the
[manifest guide](docs/guides/plugin-manifest.md).

**Why zero dependencies?** The kit is executed via `npx github:` on other
people's machines; every dependency is attack surface and install time.
Node ≥18 built-ins cover everything needed.

**Why did my plugin install but never load?** Almost certainly the
`installed_version.json` trap — see
[the manifest guide](docs/guides/plugin-manifest.md).

**Can hooks be written in something other than Node?** Yes — any executable
(`sh -c` runs it). The fail-open law still applies: exit 0 and valid JSON on
every path. The scaffolded `io.mjs` just makes that easy in Node.

## Development

```bash
npm test          # node --test; includes the dogfood suite when
                  # ../antigravity-kit is checked out (or AGY_KIT_PAYLOAD is set)
                  # and the agy-validate suite when `agy` is on PATH
```

Zero runtime dependencies (Node ≥18 built-ins only). See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
