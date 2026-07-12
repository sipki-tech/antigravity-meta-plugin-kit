# Researching Antigravity internals: sources, techniques, repeatable pipeline

*English | [Русский](researching-antigravity.ru.md)*

How every fact in [internals.md](../internals.md) was obtained, ranked by
reliability, with the exact commands — so the research can be repeated after
any Antigravity update. This is also the `meta-trap-scout` subagent's
playbook.

## Source hierarchy (most → least reliable)

| # | Source | Where | What it yields |
|---|---|---|---|
| 1 | Built-in official docs | `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/` + `antigravity_guide/references/` | canonical specs: plugins, skills, hooks, rules, MCP, registries; app/cli/ide/sdk overviews |
| 2 | Binary strings | `~/.local/bin/agy`, the two apps' `language_server` sidecars | embedded docs, system prompts, proto type names, full event inventory |
| 3 | Validator probes | `agy plugin validate` on seeded payloads | empirical component behavior (what counts, what's skipped) |
| 4 | Live installs | `~/.gemini/config/plugins/*`, settings files | real-world conventions (incl. Google's own plugins) |
| 5 | Official web | antigravity.google/docs, codelabs, agentskills.io, agents.md | narratives, tutorials; less precise than 1 |
| 6 | Community web | blogs, agentpedia, reddit | leads and rumors — **verify against 1–3 before believing** |

Case in point — now a two-act drift lesson: the web insisted a
`SessionStart` hook exists; the 1.0.16 binaries refuted it (agy matches were
TLS `ClientSessionStartReq`, app matches JS `onPanSessionStart` gesture
handlers). Then the 1.1.1 binary grew a real
`SessionStartHookArgs`/`SessionStartHookResult` proto family (2026-07-11).
The rumor was eventually right — but only rank 1–3 evidence could say
*when*, and the wire contract still needs a live probe. Rank 6 never
overrides rank 2; it only files leads.

## Source 1 — built-in docs

Found via `agy changelog` mentioning the "`antigravity_guide` builtin skill"
and a "builtin customizations directory":

```bash
find ~/.gemini/antigravity-cli/builtin -type f
# agy-customizations/docs/{plugins,skills,hooks,rules,mcp_servers,json_configs}.md
# antigravity_guide/references/{app,cli,ide,sdk}.md
```

The dir refreshes with the CLI (`.checksum`). Snapshot before updating,
diff after:

```bash
cp -R ~/.gemini/antigravity-cli/builtin /tmp/builtin-<version>
agy update
diff -r /tmp/builtin-* ~/.gemini/antigravity-cli/builtin
```

## Source 2 — binary strings

Three Go binaries carry the engine (the Electron `app.asar` is a 2 MB
launcher; the UI itself is embedded in the Go sidecar):

```bash
strings -n 5 ~/.local/bin/agy > agy.txt                     # ~490k lines
strings -n 6 "/Applications/Antigravity.app/Contents/Resources/bin/language_server" > app20.txt
strings -n 6 "/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/bin/language_server_macos_arm" > ide.txt
```

Techniques that worked:

- **Counts first, contexts second**: `grep -c pattern` across all dumps to
  spot where something lives, then `grep -n -B1 -A1` or
  `grep -o ".\{80\}pattern.\{120\}"` (Go string tables glue thousands of
  literals into one line — plain `grep -n` prints megabytes).
- **Extract embedded docs**: markdown shipped inside the binary survives as
  clean multi-line text — find a heading (`# Lifecycle Hooks`), then
  `sed -n 'START,ENDp'`. That's how the full official hooks contract was
  recovered before it was ever on the web.
- **Proto names = API inventory**: `grep -o "[A-Za-z]*Hook\(Args\|Result\)" | sort -u`
  enumerates the real event set; `GetSkillSlashCommands` vs the absence of
  a `GetAgentSlashCommands` told us agents don't become slash commands.
- **System prompts are searchable**: "You are a subagent of Antigravity",
  the owl orchestrator routine table, and the plugins-roster template
  ("You can use them just like regular skills or subagents") all came from
  strings.
- **Chase false positives**: every hit needs its context read. `SessionStart`
  (TLS/JS noise) and `owl` (substring of thousands of words) both looked
  real at count level.

Version gotcha: **`agy changelog` lags the binary** (a 1.0.16 install lists
1.0.10 on top). `agy update`'s "current version" line is authoritative.

## Source 3 — validator probes

`agy plugin validate [path]` (discovered via `agy plugin --help`) is a free
oracle: scaffold a payload, seed a variation, read what it counts.

```bash
node plugins/antigravity-meta-plugin-kit/scripts/create.mjs probe && cd probe/plugins/probe
mkdir commands && printf -- "---\ndescription: t\n---\nbody\n" > commands/x.md
TERM=dumb agy plugin validate . | sed 's/\x1b\[[0-9;]*m//g'
# → "commands : 1 processed (converted to skills)"  ← discovery
```

This is how `commands/` (Claude-Code-style, converted to skills),
markdown subagents (`agents/*.md`), root-only hooks.json detection, and
"empty mcpServers = skipped" were established. Strip ANSI; `TERM=dumb`.

## Source 4 — live installs

```bash
ls ~/.gemini/config/plugins/          # Google's own plugins = conventions
cat ~/.gemini/config/plugins/flutter/plugin.json   # {"name":"flutter"} — minimal world
```

Google's plugins proved the "two worlds" model and surfaced
`gemini-extension.json` (an `agy plugin import gemini` compatibility
artifact, per source 2).

## The repeatable pipeline (after any Antigravity update)

1. `agy update` — record the real version.
2. Diff the built-in docs against your snapshot (source 1).
3. Re-dump the three binaries; grep the checklist: event names, `injectSteps`
   keys, `installed_version`, `decision`/`allow_tool`, marketplace, any new
   component nouns; diff counts against the previous dumps.
4. Re-run validator probes: own payload, the reference payload, a probe
   payload with exotic components — watch for new lines in the output.
5. `npm test` in this repo — the dogfood and agy-validate suites encode the
   expected state permanently and fail on drift.
6. Update [internals.md](../internals.md) with new dates, recalibrate the
   linter, and record refuted rumors explicitly.

Or, with the plugin installed: `/meta-scout` — the subagent runs this
playbook and reports drift with provenance.

## Ethics & scope

Everything here reads binaries and configs already installed on your own
machine for interoperability — no network probing, no credentials, no
bypassing protections. Respect the preview's terms; report genuine bugs to
Google rather than relying on them.

*See also: [trap registry](../internals.md) ·
[Using the plugin](using-the-plugin.md)*
