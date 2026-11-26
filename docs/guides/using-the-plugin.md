# Using the plugin

English | [Русский](using-the-plugin.ru.md)

Once installed via `agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit`,
the kit assists your Antigravity agent directly while you design, audit, test,
diagnose, and ship plugins.

## Zero noise outside plugin projects

`antigravity-meta-plugin-kit` `v0.6.0` is strictly non-intrusive:

- **Zero global hooks** — nothing runs on `PreToolUse`, `PostToolUse`, or
  `Stop` in unrelated repositories.
- **Zero always-on rules** — the single bundled rule (`rules/plugin-authoring.md`)
  uses `trigger: model_decision`, so non-plugin workspaces stay untouched.
- **Isolated subagents** — all three subagents declare `inheritMcp: false`,
  `mainAgent: false`, and minimal `tools:` lists.

## Ready-to-use prompts in Antigravity

Copy and adapt these directly in Antigravity CLI, App, or IDE:

| Goal | What to type in Antigravity | Activates |
|---|---|---|
| Start a new CLI + `auth.json` plugin | *"Scaffold a new Antigravity plugin `acme-billing` using the minimal CLI + `auth.json` pattern."* | `meta-scaffold` |
| Design a specialist subagent | *"Create a read-only SQL migration reviewer subagent in `agents/` with `model: inherit` and a `/sql-review` slash wrapper."* | `meta-agents` |
| Build a safe lifecycle hook | *"Design a fail-open `PreToolUse` hook that blocks `git push --force` and includes `node:test` wire tests."* | `meta-hooks` + `meta-hook-smith` |
| Full mechanical + semantic audit | `/meta-audit plugins/acme-billing` | `/meta-audit` + `meta-payload-auditor` |
| Check your local `~/.gemini/config/` | `/meta-doctor` | `/meta-doctor` (`doctor.mjs`) |
| Check for contract drift after `agy` update | `/meta-scout` | `/meta-scout` + `meta-trap-scout` |

## The eight expert skills

Skills load automatically when you ask Antigravity about the matching topic, or
explicitly via `/<skill-name>`:

| Skill | Use it when you want Antigravity to... |
|---|---|
| `meta-scaffold` | Create a new plugin repository with the right `meta-kit create` flags and layout |
| `meta-agents` | Author or fix `agents/*.md` / `agents/*/agent.md`, `model:` tiers, `tools:`, `inheritMcp`, or `/cmd` wrappers |
| `meta-hooks` | Design `hooks.json` and fail-open `io.mjs` scripts for any of the 6 native events |
| `meta-skills` | Write `SKILL.md` files with strong triggers, multiline YAML, and progressive disclosure under 24 KB |
| `meta-rules` | Author `rules/AGENTS.md` or triggered rules, avoid `globs` traps, or migrate dead `workflows/*.md` |
| `meta-mcp` | Configure Stdio or Streamable HTTP `mcp_config.json`, `variables[]`, `eager`, `background`, MCP Apps, or CLI + `auth.json` |
| `meta-test` | Build `node:test` hook wire tests, manifest tests, and isolated `agy -p` smoke tests |
| `meta-ship` | Pass `meta-kit lint --strict`, `agy plugin validate --strict --json`, `marketplace.json`, and Marketplace pre-flight checks |

## Slash-only commands: `/meta-audit`, `/meta-doctor`, and `/meta-scout`

Three thin slash-only skills (`disable-model-invocation: true`) give you
deterministic entry points without ever firing spontaneously:

- **`/meta-audit`** — runs `meta-kit lint --strict` and `agy plugin validate
  --strict --json`, collects the payload file tree, and delegates a deep
  semantic review to the read-only `meta-payload-auditor` subagent.
- **`/meta-doctor`** — runs read-only `meta-kit doctor` across
  `~/.gemini/config/` and `.agents/` to catch plugin/skill/agent name
  collisions, disabled mismatches, runtime traps in enabled plugins, and hard
  24 KB / 20k-token platform caps.
- **`/meta-scout`** — runs `meta-kit probe --fast` (or `--live` when requested)
  and delegates drift inspection to the sandboxed `meta-trap-scout` subagent
  after an Antigravity CLI/App update.

## The three isolated subagents

All three run with `model: inherit` (preserving your parent Neon/Carbon/Argon
or Claude model) and `inheritMcp: false`:

| Subagent | Policy & tools | Role |
|---|---|---|
| `meta-payload-auditor` | `off` · `[read_file]` | Semantic audit beyond static linting: trigger collisions, weak subagent scoping, hook edge cases, always-on rule bloat, manifest coherence. |
| `meta-hook-smith` | `off` · `[read_file]` | Produces a complete, fail-open hook package (`hooks.json` fragment, `io.mjs` handler, `node:test` unit + e2e tests) without modifying files prematurely. |
| `meta-trap-scout` | `sandbox` · `[read_file, run_command, search_web]` | Investigates Antigravity version drift using `probe.mjs`, builtin docs inspection, and binary/string checks. |

Because `mainAgent: false` is set on all three, they stay out of `/agents` and
are invoked cleanly via `invoke_subagent` (or via `/meta-audit` and
`/meta-scout`).

## Recommended day-to-day workflow

1. **Scaffold:** ask Antigravity *"Scaffold a new Antigravity plugin `acme-lint`
   with a subagent and slash command"* (activates `meta-scaffold`).
2. **Add components:** ask specifically for subagents, hooks, rules, or MCP
   servers so the matching `meta-*` skill loads exact `1.5.17+` contracts.
3. **Audit before PR:** run `/meta-audit plugins/acme-lint` to combine
   `meta-kit lint --strict`, `agy plugin validate --strict --json`, and a
   fresh-eyes review from `meta-payload-auditor`.
4. **Check your install:** run `/meta-doctor` whenever something seems shadowed
   or disabled unexpectedly.
5. **Track platform updates:** after upgrading `agy`, run `/meta-scout` to
   verify whether any runtime contract changed.

Next: [Getting started](getting-started.md) · [Testing](testing.md) · [Researching Antigravity](researching-antigravity.md)
