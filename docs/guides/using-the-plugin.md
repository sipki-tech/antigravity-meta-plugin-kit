# Using the installed meta-kit plugin day to day

*English | [Русский](using-the-plugin.ru.md)*

What you actually get after
`agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit`
— and how to drive it from a live Antigravity session.

## After installing

1. **Restart Antigravity** — the loader picks plugins up on start.
2. A single install serves every workspace; the `/meta-*` slash commands ship
   inside the plugin payload, so they land wherever the plugin is installed —
   no per-project step.
3. Confirm anytime: `agy plugin list` shows it's registered; `agy plugin
   validate plugins/antigravity-meta-plugin-kit` checks its structure.

## The six skills — fire by phrasing

Skills route on their descriptions; say the trigger (or ask in its terms):

| You say | Skill that fires | What you get |
|---|---|---|
| "meta-scaffold — start a new plugin" | `meta-scaffold` | scaffold walkthrough: create → fill TODOs → lint |
| "meta-hooks — design a guard for rm -rf" | `meta-hooks` | event choice + official wire contracts + fail-open law |
| "meta-skills — review my SKILL.md" | `meta-skills` | frontmatter/trigger/structure discipline |
| "meta-agents — add a subagent" | `meta-agents` | both formats, delegation-surface descriptions, workflow wrappers |
| "meta-test — cover my hook with tests" | `meta-test` | the zero-dep node --test doctrine |
| "meta-ship — prepare the release" | `meta-ship` | native agy plugin install distribution, gates, versioning checklist |

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
  `agy plugin list` to confirm it registered. If you hand-copied the dir into
  `~/.gemini/config/plugins/` instead of using `agy plugin install`, the IDE
  plugin-manager never got its `installed_version.json` and ignores it —
  re-install through the CLI.
- **`/meta-*` unknown in a project** — the commands ship in the payload;
  confirm the plugin itself loaded (`agy plugin list`) and restart Antigravity.
- **A subagent doesn't spawn** — the host injects installed plugins'
  subagents into the main agent's prompt (confirmed, see
  [internals](../internals.md)), so a miss usually means the plugin didn't
  load (`agy plugin list`) or the phrasing didn't match the agent's
  description; the workflow body still guides the main agent to do the job
  itself.
- **Stale version** — re-run `agy plugin install
  https://github.com/sipki-tech/antigravity-meta-plugin-kit` (it re-clones the
  latest `main`); there is no `agy plugin update`.

*See also: [Getting started](getting-started.md) ·
[Subagents](agents.md) · [trap registry](../internals.md)*
