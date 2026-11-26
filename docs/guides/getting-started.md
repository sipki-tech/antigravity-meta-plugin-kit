# Getting started

English | [Русский](getting-started.ru.md)

Go from zero to a validated, tested Google Antigravity (`agy 1.5.17+`) plugin in
under five minutes.

## Prerequisites

- **Node.js >= 20** (zero npm dependencies are required).
- **Google Antigravity CLI (`agy 1.5.17+`)** on `PATH` for local validation and
  installation (`agy --version`).

## 1. Install in Antigravity and set up `meta-kit`

Install the kit globally — no `git clone` or `npm install` needed:

```bash
agy plugin install https://github.com/sipki-tech/antigravity-meta-plugin-kit
```

Add a shell alias (in `~/.zshrc` or `~/.bashrc`) so you can run `meta-kit` from
any directory:

```bash
alias meta-kit='node ~/.gemini/config/plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs'
```

*(Working from a git checkout of this repo instead? Use
`alias meta-kit="node $(pwd)/plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs"`.)*

## 2. Scaffold a native Antigravity plugin

```bash
meta-kit create my-plugin
```

This creates `./my-plugin/` with:

- `plugins/my-plugin/plugin.json` — strict flat `agy 1.5.17+` manifest with
  `displayName`, `logo`, and `suggestedPrompts`.
- `plugins/my-plugin/README.md` + `assets/logo.svg` — Marketplace-ready readme
  and 256×256 SVG with ~10% transparent padding (0 validator notes).
- `plugins/my-plugin/rules/AGENTS.md` — lean always-on rule (no frontmatter).
- `plugins/my-plugin/hooks.json` + `scripts/example-guard.mjs` +
  `scripts/lib/io.mjs` — symlink-safe, fail-open `PreToolUse` guard.
- `plugins/my-plugin/skills/my-plugin-example/SKILL.md` +
  `resources/prompt-template.md`.
- `plugins/my-plugin/mcp_config.json` — clean JSONC template.
- `test/hook.test.mjs`, `test/manifest.test.mjs`, `package.json`, `README.md`,
  and `.github/workflows/ci.yml`.

### Choose a scaffold profile

Combine flags to match your plugin's exact surface:

| What you are building | Command |
|---|---|
| Standard plugin (hooks + MCP + skill + rule) | `meta-kit create my-plugin` |
| Minimal skill/rule-only plugin | `meta-kit create my-minimal --minimal` |
| Google Workspace pattern (bundled CLI + `auth.json` + skill, zero MCP) | `meta-kit create my-cli --minimal --with-cli` |
| Custom Markdown subagent (`agents/*.md`) + `/<name>-help` slash wrapper | `meta-kit create my-agents --with-agents` |
| Background worker sidecar (`sidecars/<name>-worker/sidecar.json`) | `meta-kit create my-worker --with-sidecar` |
| Manifest under `.antigravity-plugin/plugin.json` (components stay at root) | `meta-kit create my-dot --manifest-layout dot-antigravity` |
| Dry-run preview without writing files | `meta-kit create my-preview --with-agents --with-cli --dry-run` |

## 3. Run tests, offline lint, and the official validator

```bash
cd my-plugin
npm test                                               # node:test suite (green out of the box)
meta-kit lint --strict .                               # offline strict lint + runtime blind spots
agy plugin validate --strict --json plugins/my-plugin  # Google's authoritative validator (findings: [])
```

Both validators should pass with **0 errors and 0 warnings**.

## 4. Diagnose your environment and install locally

Run a read-only check before and after installing to verify there are no plugin
or skill name collisions in `~/.gemini/config/plugins/`:

```bash
meta-kit doctor --workspace .
agy plugin install plugins/my-plugin
agy plugin list --json
```

For workspace-only testing without touching `~/.gemini/config/plugins/`, copy
`plugins/my-plugin` into `<project>/.agents/plugins/my-plugin` and run:

```bash
agy -p "List the skills available from my-plugin." --add-dir <project>
```

## Next steps

- Ready-to-use Antigravity prompts for skills and subagents:
  [Using the plugin](using-the-plugin.md)
- Author custom subagents cleanly: [Subagents](agents.md)
- Add lifecycle hooks safely: [Lifecycle hooks](hooks.md)
- Prepare for GitHub and Marketplace release: [Shipping](shipping.md)
