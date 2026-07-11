# Using the installed meta-kit plugin day to day

*English | [Русский](using-the-plugin.ru.md)*

What you actually get after
`npx github:sipki-tech/antigravity-meta-plugin-kit install` — and how to
drive it from a live Antigravity session.

## After installing

1. **Restart Antigravity** — the loader picks plugins up on start.
2. Global install serves every workspace; per-project slash commands need
   one extra step in each project:
   `npx github:sipki-tech/antigravity-meta-plugin-kit workflows`
   (drops `/meta-*` aliases into `<project>/.agents/workflows/`).
3. Health check anytime:
   `npx github:sipki-tech/antigravity-meta-plugin-kit verify`.

## The six skills — fire by phrasing

Skills route on their descriptions; say the trigger (or ask in its terms):

| You say | Skill that fires | What you get |
|---|---|---|
| "meta-scaffold — start a new plugin" | `meta-scaffold` | scaffold walkthrough: create → fill TODOs → lint |
| "meta-hooks — design a guard for rm -rf" | `meta-hooks` | event choice + official wire contracts + fail-open law |
| "meta-skills — review my SKILL.md" | `meta-skills` | frontmatter/trigger/structure discipline |
| "meta-agents — add a subagent" | `meta-agents` | both formats, delegation-surface descriptions, workflow wrappers |
| "meta-test — cover my hook with tests" | `meta-test` | the zero-dep node --test doctrine |
| "meta-ship — prepare the release" | `meta-ship` | npx distribution, gates, versioning checklist |

## The four subagents — delegate heavy work

Ask the main agent to delegate, or use the deterministic `/meta-*` commands
(agents don't become slash commands by themselves):

| Command / ask | Subagent | When |
|---|---|---|
| `/meta-audit <payload>` | `meta-payload-auditor` | before shipping: semantic review beyond `lint` |
| `/meta-hook <intent>` | `meta-hook-smith` | you want a new hook designed with tests |
| `/meta-scout` | `meta-trap-scout` | Antigravity updated, or a plugin misbehaves despite green lint |
| `/meta-mirror` | `meta-doc-mirror` | EN docs changed, RU mirror must catch up |

Subagents run with fresh context: give the command everything it needs
(paths, intent) — it cannot see your conversation history.

## A typical authoring session

```text
you:  meta-scaffold — I need a plugin that blocks force-pushes
      → scaffold created, TODOs listed
you:  /meta-hook block `git push --force` on PreToolUse
      → hooks.json block + fail-open script + tests, review and apply
you:  meta-test — anything missing?
      → junk-stdin e2e added
you:  /meta-audit my-plugin
      → BLOCKER/WARN/NIT findings; fix, re-lint
you:  meta-ship — release checklist
      → lint + agy validate + CI gates → tag
```

## Troubleshooting

- **Skills don't fire after install** — did you restart Antigravity? Then
  `verify`; the classic silent killer is a missing
  `installed_version.json` (verify checks it).
- **`/meta-*` unknown in a project** — run the `workflows` command in that
  project; global install alone doesn't add per-project aliases.
- **A subagent doesn't spawn** — the host injects installed plugins'
  subagents into the main agent's prompt (confirmed, see
  [internals](../internals.md)), so a miss usually means the plugin didn't
  load (run `verify`) or the phrasing didn't match the agent's description;
  the workflow body still guides the main agent to do the job itself.
- **Stale version** — `npx github:sipki-tech/antigravity-meta-plugin-kit#main update`
  (mind the `#main`: npx caches).

*See also: [Getting started](getting-started.md) ·
[Subagents](agents.md) · [trap registry](../internals.md)*
