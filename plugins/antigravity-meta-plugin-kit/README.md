<p align="center">
  <img src="assets/logo.svg" width="72" height="72" alt="Meta Plugin Kit" />
</p>

# Meta Plugin Kit (`antigravity-meta-plugin-kit`)

Production engineering toolkit for authoring, linting, diagnosing, probing, and
shipping **Google Antigravity** plugins (`agy 1.5.17+`).

## Slash commands (`disable-model-invocation: true`)

| Command | What it does |
|---|---|
| `/meta-audit` | Runs `meta-kit lint --strict` + `agy plugin validate --strict --json`, collects the payload file tree, and delegates a deep semantic review to `meta-payload-auditor`. |
| `/meta-doctor` | Runs read-only `meta-kit doctor` across `~/.gemini/config/` and `.agents/` to spot collisions, runtime traps, and hard 24 KB / 20k rule caps. |
| `/meta-scout` | Runs `meta-kit probe --fast` (or `--live`) and delegates post-update drift checks to `meta-trap-scout`. |

## Expert skills (8) & isolated subagents (3)

Ask Antigravity directly — the matching skill loads automatically:

- **Scaffold:** *"Scaffold a new Antigravity plugin `acme-tools` with a CLI and `auth.json`"* (`meta-scaffold`)
- **Subagents:** *"Create a read-only security reviewer subagent in `agents/`"* (`meta-agents`)
- **Hooks:** *"Add a fail-open `PreToolUse` hook that blocks force pushes"* (`meta-hooks` + `meta-hook-smith`)
- **Skills / Rules / MCP:** `meta-skills`, `meta-rules`, `meta-mcp`
- **Testing & Shipping:** `meta-test`, `meta-ship`

## CLI alias (no repo clone required)

```bash
alias meta-kit='node ~/.gemini/config/plugins/antigravity-meta-plugin-kit/scripts/meta-kit.mjs'

meta-kit create my-plugin --with-agents
meta-kit lint --strict my-plugin
meta-kit doctor --workspace .
meta-kit probe --fast
```

Full bilingual documentation (EN/RU) and trap registry:
https://github.com/sipki-tech/antigravity-meta-plugin-kit
