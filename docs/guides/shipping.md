# Shipping: distribution, updates, marketplaces, release gates

*English | [Русский](shipping.ru.md)*

## GitHub-only npx distribution

No npm publish needed. Users run:

```bash
npx github:you/my-plugin install            # cached checkout
npx github:you/my-plugin#main install       # force the latest commit
```

Two packing traps (both handled by this kit's scaffold):

- `npx github:` installs via `npm pack`, which **silently drops files named
  `.gitignore`** and treats nested `package.json` specially. If your repo
  templates such files, store them renamed (`_gitignore`) and rename at
  generation time.
- npx **caches** the checkout — document `#main` in your README or users
  will debug a version you already fixed.

Since CLI 1.0.9, `agy plugin install` also resolves git submodules.

## The update pattern

`update` = re-run install, then report. Compare the version in the installed
`installed_version.json` with the payload's `plugin.json`:

- not installed before → "fresh install (x.y.z)"
- equal → "already up to date (x.y.z) — payload re-synced"
- different → "updated: a.b.c -> x.y.z" + a CHANGELOG link

## verify / uninstall contracts

- **verify** — named checks `{name, pass, note}`, printed as
  `ok /FAIL name (note)`, exit 1 on any fail. Check at minimum: plugin dir,
  manifest parses, author is an object, `installed_version.json` present
  and matching, root hooks.json declares a named hook, hook scripts exist.
- **uninstall** — remove the plugin dirs (and mirrors); prune **only** MCP
  entries identical to what was installed; user edits stay.

## Release gates (in order)

1. `lint` — zero FAIL, zero warnings on your payload.
2. `agy plugin validate plugins/<name>` — `[ok]`, hooks processed.
3. `npm test` — green locally.
4. CI green: matrix ubuntu+macos × Node 20/22, `npm test` + a smoke job
   (install into a temp workspace → verify).
5. Fresh-machine check: `npx github:you/my-plugin#main install --dry-run`
   from a clean temp dir (this also proves the packlist workarounds).
6. Tag **after** CI is green, never before. Release notes = the CHANGELOG
   section.

## Versioning & docs

- SemVer + [Keep a Changelog](https://keepachangelog.com). Park out-of-scope
  ideas in a `Backlog` subsection instead of half-shipping them.
- Bilingual docs change in the same commit, section for section, or not at
  all.

## Other distribution channels

- **Marketplaces**: `agy plugin install plugin@marketplace`;
  `agy plugin link <marketplace> <target>` links one.
- **Claude Code migration**: point users at `agy plugin import claude` —
  Antigravity imports Claude Code plugins (a `commands/` dir is converted to
  skills on ingestion).
- Users manage state with `agy plugin enable|disable <name>`.

## Pitfalls

- Tagging before CI → a broken tag is forever cached by npx.
- Shipping a payload with `installed_version.json` committed → the installer
  and the file fight; lint warns.
- Fixing a bug and telling users to re-run npx without `#main` → they get
  the cached broken version.

## Checklist

- [ ] README documents `#main` and the update command
- [ ] verify/uninstall honor the contracts above
- [ ] CI matrix + smoke green; tag only after
- [ ] CHANGELOG entry + Backlog for deferred ideas
- [ ] EN/RU docs in the same commit

*See also: [Getting started](getting-started.md) · [Testing](testing.md)*
