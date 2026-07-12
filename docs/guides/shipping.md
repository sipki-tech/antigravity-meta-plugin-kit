# Shipping: distribution, updates, marketplaces, release gates

*English | [Русский](shipping.ru.md)*

## Native `agy plugin install` distribution

No npm publish, no installer to ship. Users install straight from GitHub with
the Antigravity CLI:

```bash
agy plugin install https://github.com/you/my-plugin   # clone, register, install
```

The CLI clones the repo, scans it for a top-level `plugins/` directory
("bulk plugins directory"), copies each plugin into
`~/.gemini/config/plugins/<name>/`, and registers the install in
`~/.gemini/config/import_manifest.json`. Tell users to restart Antigravity
afterwards. A local checkout installs the same way:

```bash
agy plugin install path/to/my-plugin                  # local payload dir
```

Since CLI 1.0.9, `agy plugin install` also resolves git submodules. Shorthands
like `github:you/repo` or `you/repo` are **rejected** — pass the full
`https://github.com/...` URL or a directory path.

## The update pattern

There is **no** `agy plugin update` subcommand. **Update = re-run install** —
it re-clones the latest `main` and re-registers:

```bash
agy plugin install https://github.com/you/my-plugin
```

Because the CLI writes no version-file, there is no version-diff to print;
link the CHANGELOG so users can see what changed. Note that an Antigravity
re-provisioning can wipe third-party dirs from `~/.gemini/config/plugins/`, so
recommend a post-update `agy plugin list` habit and a re-install if a plugin
went missing (see [internals](../internals.md)).

## enable / disable / uninstall

- **`agy plugin list`** — shows CLI-installed plugins; the fastest confirmation
  an install registered.
- **`agy plugin enable|disable <name>`** — toggle a plugin without removing it.
- **`agy plugin uninstall <name>`** — removes the plugin dir and its
  `import_manifest.json` entry.

There is no separate verify command: `agy plugin validate <payload>` checks
structure, and `agy plugin list` (plus a live session that sees the skills)
confirms the install.

## Release gates (in order)

1. `lint` — zero FAIL, zero warnings on your payload.
2. `agy plugin validate plugins/<name>` — `[ok]`, hooks processed.
3. `npm test` — green locally.
4. CI green: matrix ubuntu+macos × Node 20/22, `npm test` + a structural
   step (`agy plugin validate` when `agy` is on PATH).
5. Fresh-machine check: `agy plugin install https://github.com/you/my-plugin`
   from a clean environment → `agy plugin list` shows it → a session sees its
   skills → `agy plugin uninstall <name>` removes it cleanly.
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

- Tagging before CI → a broken tag ships as the next `agy plugin install`.
- Shipping a payload with `installed_version.json` committed → it is an
  install-time artifact, never a payload file; lint warns.
- Telling users to "update" without re-running `agy plugin install` → nothing
  changes; there is no background auto-update.

## Checklist

- [ ] README documents `agy plugin install` and the re-install update path
- [ ] `agy plugin list` / `uninstall` confirmed on a fresh machine
- [ ] CI matrix + `agy plugin validate` green; tag only after
- [ ] CHANGELOG entry + Backlog for deferred ideas
- [ ] EN/RU docs in the same commit

*See also: [Getting started](getting-started.md) · [Testing](testing.md)*
