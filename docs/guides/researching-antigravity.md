# Researching Antigravity

English | [Русский](researching-antigravity.ru.md)

How to verify plugin contracts directly against your installed Google
Antigravity build after every release — without guessing or relying on outdated
posts.

## Why verify empirically

Antigravity ships rapidly: between July and November 2026 alone, Antigravity
unified the IDE and CLI loaders (`Antigravity IDE 2.7.0` -> `agy --hub`),
replaced `agents/*.toml` with Markdown `agents/*.md`, dropped plugin
`workflows/*.md`, added `SessionStart`, changed `Stop` termination enums, and
shipped `agy plugin validate --strict`.

Every rule in [docs/internals.md](../internals.md) and `scripts/lib/lint.mjs`
carries an explicit provenance tag (`[OFFICIAL 2026-11]`, `[OBSERVED 2026-11]`,
`[MEDIUM]`) backed by reproducible checks.

## Authoritative sources on disk

Inspect these four local sources first whenever Antigravity updates:

1. **Authoritative CLI version:**
   ```bash
   agy --version
   ```
   (`agy --version` is always accurate; `agy changelog` can lag behind.)
2. **Built-in customization docs** shipped with the CLI:
   `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/`
   Covers manifest fields, rules, skills, agents, hooks, MCP, sidecars, and
   discovery priority directly from Google.
3. **The two Go engine binaries:**
   - `~/.local/bin/agy` (CLI engine + validator + `--hub`)
   - `/Applications/Antigravity.app/Contents/Resources/bin/language_server`
     (Antigravity App engine)
   Compare strings or embedded protobuf descriptors (`exa.hooks_pb`) to confirm
   CLI and App remain in lockstep.
4. **Live `agy plugin validate --strict --json` + isolated `agy -p` probes:**
   The validator catches schema changes; isolated `/tmp` runs catch runtime
   behavior that the validator does not check (such as `PromptHook`, `Stop`
   `continuationActive`, `model:` tier resolution, and subagent `tools:`).

## Automated drift radar (`probe.mjs`)

Instead of re-running probes by hand, run the kit's executable drift detector:

```bash
# Fast (~2s, zero LLM calls): tests 9 validator contracts in /tmp
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --fast

# Machine-readable JSON output
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --fast --json

# Live (opt-in): also runs 4 isolated `agy -p` runtime probes (hooks + subagents) in /tmp
node plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs probe --live
```

`probe.mjs` never modifies `~/.gemini/` or your workspace — every synthetic
fixture is created inside a temporary directory and removed on exit. Exit code
`0` means every contract is `CONFIRMED`; exit code `1` pinpoints the exact
`DRIFT` probe ID.

You can also invoke `/meta-scout` inside Antigravity to run `probe.mjs` and
delegate a deeper diff to the sandboxed `meta-trap-scout` subagent.

## Repeatable post-update pipeline

Run this five-step checklist after upgrading `agy` or `Antigravity.app`:

1. Record versions: `agy --version` and `Antigravity.app` / `Antigravity IDE`
   `Info.plist` `CFBundleShortVersionString`.
2. Run `node plugins/antigravity-meta-plugin-kit/scripts/probe.mjs --fast`.
3. Diff `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/docs/`
   against [docs/internals.md](../internals.md) for any new manifest keys,
   hook events, agent frontmatter fields, or validator checks.
4. Run `probe.mjs --live` if hooks, subagent tiers, or `PromptHook` changed in
   release notes.
5. Check whether any previously confirmed runtime bug was fixed (for example,
   if `PromptHook` starts working or `Stop.continuationActive` flips to `true`
   on `executionNum: 1`).

## Updating `docs/internals.md` and `lint.mjs`

When a probe reports `DRIFT`:

1. Update [docs/internals.md](../internals.md) with the new `[OFFICIAL YYYY-MM]`
   or `[OBSERVED YYYY-MM]` observation and move retired claims to **Refuted &
   superseded assumptions**.
2. Update `scripts/lib/lint/*.mjs`, the canonical template hook SDK
   (`scripts/templates/plugin/plugins/__name__/scripts/lib/io.mjs`), and
   `scripts/probe.mjs` expectations to match the verified runtime behavior.
3. Mirror any user-facing change across both English and Russian guides and run
   `npm test` (which enforces EN/RU parity via `test/docs-parity.test.mjs`).

Next: [Internals](../internals.md) · [Testing](testing.md) · [Using the plugin](using-the-plugin.md)
