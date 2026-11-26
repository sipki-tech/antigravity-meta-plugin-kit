# MCP servers

English | [Русский](mcp.ru.md)

A plugin can ship one or more Model Context Protocol (MCP) servers via a root
`mcp_config.json` file. Antigravity automatically namespaces every server as
`<plugin>_<server>` to prevent collisions across plugins.

## Layout and supported transports

Place MCP configuration at `<plugin>/mcp_config.json`. Unlike `plugin.json` and
`hooks.json`, **`mcp_config.json` accepts JSONC** (comments and trailing
commas).

Antigravity `1.5.17+` supports **two** MCP transports inside `mcp_config.json` —
do **not** set `"type"` or `"httpUrl"` in native plugin configs:

### Stdio servers

Spawns a local process communicating over stdin/stdout. Prefer `"command":
"node"` (with bundled JS) or `"npx"` for cross-platform portability; if a server
requires a non-Node runtime (`python`, `uvx`, `docker`), ship it with
`"disabled": true` and document the prerequisite.

```jsonc
{
  "mcpServers": {
    "local-tools": {
      "command": "node",
      "args": ["${PLUGIN_ROOT}/scripts/mcp-server.mjs"],
      "env": {
        "STATE_DIR": "${PLUGIN_DATA}",
        "API_TOKEN": "${API_TOKEN}"
      },
      "variables": [
        {
          "name": "API_TOKEN",
          "title": "API Token",
          "description": "Personal access token for the service."
        }
      ]
    }
  }
}
```

### Streamable HTTP (never legacy `/sse`)

Connects to a remote MCP endpoint over Streamable HTTP using `url` (or legacy
alias `serverUrl`):

```jsonc
{
  "mcpServers": {
    "remote-api": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      },
      "variables": [
        {
          "name": "API_TOKEN",
          "title": "API Token"
        }
      ]
    }
  }
}
```

> **Legacy `/sse` trap:** Antigravity does **not** support legacy HTTP+SSE MCP
> endpoints. `agy plugin validate --strict` does not warn on `/sse` URLs, so
> `lint.mjs` flags them automatically. If an upstream server only speaks legacy
> SSE, bridge it locally through `mcp-remote` over Stdio instead.

## Exact variable expansion matrix

Antigravity applies strict, asymmetric substitution rules — violating them
causes silent literal `${...}` strings at runtime:

| Placeholder | Expands in | Does **NOT** expand in | Notes |
|---|---|---|---|
| `${PLUGIN_ROOT}`, `${PLUGIN_DATA}` | `args`, `env` values, `cwd` | `command`, `url`, `headers`, `oauth` | Never set `PLUGIN_ROOT` as an `env` key — Antigravity injects it automatically. |
| `${VAR}` declared in per-server `variables[]` | `command`, `args`, `env`, `url`, `headers`, `oauth` | `cwd` | `variables[]` belongs inside each server object, never at the root of `mcp_config.json` or `plugin.json`. Plugins declaring `variables` install **disabled** until the user supplies values. |
| `${env:NAME}` | *(nowhere)* | everywhere | OS environment variables are **not** expanded by Antigravity. |

Never hardcode real tokens (`ghp_`, `github_pat_`, `sk-`, `AIza`, `xoxb-`,
`Bearer ...`) in `env` or `headers` — `lint.mjs` warns on literal secrets.

## Tool loading, `eager`, and timeouts

- **Lazy by default:** plugin MCP tools load on demand via `call_mcp_tool` to
  protect context budgets. Inline tool responses are capped at **10 KB** before
  spilling to a file.
- **Per-tool tuning:** set `"tools": { "<tool>": { "eager": true, "background": "off" } }`
  only for high-frequency tools that must appear directly in the top-level tool
  list. Note that `background` MUST be a string (`"off"` or `"always"`) —
  passing boolean `false` causes Go JSON unmarshaling to skip the entire server.
- **Filtering:** use `"enabledTools": [...]` or `"disabledTools": [...]` to
  restrict a large upstream server to the exact subset your plugin needs.
- **Timeouts:** `"timeoutSeconds"` configures per-call timeout (`-1` disables
  the timeout).

## MCP Apps (`SEP-1865`) and OAuth 2.1

- **MCP Apps (`SEP-1865`):** tools can attach `_meta.ui.resourceUri` pointing to
  a `ui://` HTML resource rendered in `com.google.antigravity/ui` (`aux_pane`,
  `global`, or `file`). Because `agy` CLI renders no iframes and ignores
  `_meta.ui.visibility`, **always return complete plain-text `content`** as a
  fallback alongside any UI resource.
- **OAuth 2.1 / CIMD:** Antigravity supports OAuth 2.1 + PKCE `S256` with
  Client ID Metadata Documents (`https://antigravity.google/oauth/mcp-client.json`)
  and dynamic client registration. Allowlist
  `https://antigravity.google/oauth-callback` (local CLI/App) and
  `https://antigravity.google.com/oauth/callback` (remote Marketplace) in your
  OAuth provider and test auth flows on both CLI and App.

## Alternative pattern: bundled CLI + `auth.json` + skill

Not every integration needs a long-running MCP process. Google's own Workspace
plugins (`gcalendar`, `gdocs`, `gdrive`, `gsheets`, `gslides`) ship:

1. A self-contained CLI binary or Node script in `scripts/` (or `bin/`).
2. A declarative `auth.json` (OAuth2 or API key flow managed natively by
   Antigravity).
3. A lean `SKILL.md` teaching the agent the exact CLI commands and flags.

Choose **bundled CLI + skill** when operations are stateless request/response
commands with small flags (scaffold directly with
`meta-kit.mjs create my-plugin --minimal --with-cli`, and validate `auth.json`
with `lint.mjs --strict`, since `agy plugin validate` currently skips
`auth.json`); choose **MCP** when you need persistent connections, structured
JSON tool schemas, resources, or MCP Apps UI.

Next: [Plugin manifest & layouts](plugin-manifest.md) · [Skills](skills.md) · [Internals](../internals.md)
