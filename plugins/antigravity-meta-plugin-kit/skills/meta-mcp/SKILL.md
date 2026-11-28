---
name: meta-mcp
description: >-
  Configure Google Antigravity plugin MCP servers (mcp_config.json), Streamable
  HTTP vs Stdio transports, variables[], eager/background tools, MCP Apps, or
  decide when a CLI + auth.json is better. Use when the user says "meta-mcp" or
  adds or debugs MCP servers in an Antigravity plugin. Don't use for hooks or
  rules.
---

# meta-mcp — Antigravity MCP servers & tool packaging

## Goal

Bundle reliable, secure, zero-surprise MCP servers in `<plugin>/mcp_config.json`
(or deliberately choose a lightweight CLI + `auth.json` + skill instead when
MCP overhead isn't justified).

## Instructions

1. **Choose MCP vs CLI + `auth.json`:**
   - Use **MCP** when you need persistent stateful connections, OAuth-managed
     remote APIs, or interactive **MCP Apps** UI panels.
   - Consider a **bundled CLI (`scripts/cli.mjs`) + `auth.json` + skill**
     (the pattern used by Google's own Workspace plugins — scaffold directly
     with `meta-kit.mjs create <name> --minimal --with-cli`) when wrapping a
     simple REST API. Note that `agy plugin validate --strict` skips
     `auth.json` validation, so run `lint.mjs --strict` to verify `auth.json`
     provider schemas and catch literal secrets.
2. **Author `<plugin>/mcp_config.json`** (JSONC comments/trailing commas are
   allowed; plugin servers auto-namespace as `<plugin>_<server>`):
   - **Stdio (local):** `command`, `args`, `env`, `cwd`. Prefer `"command":
     "node"` (Antigravity falls back to its bundled Node.js runtime). Ship
     `"disabled": true` for any non-`node`/`npx` binary that may not be
     installed.
   - **Streamable HTTP (remote):** `url` (or legacy alias `serverUrl`, never
     `httpUrl` and never `"type"` in native `mcp_config.json`). **Legacy
     HTTP+SSE (`/sse`) is unsupported** — point at `/mcp` or wrap legacy SSE
     with `npx -y mcp-remote <url>`.
   - **Tool loading & timeouts:** tools default to lazy loading (`call_mcp_tool`,
     10 KB inline cap). Use `"tools": { "<name>": { "eager": true,
     "background": "off" | "always" } }` strictly for hot-path tools; set
     `enabledTools` / `disabledTools` and `timeoutSeconds` (`-1` disables).
3. **Variable expansion rules (`agy 1.5.17` exact matrix):**
   - `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` expand ONLY in **`args`, `env`,
     `cwd`** — **never** in `command`, and never set `PLUGIN_ROOT` as a key in
     `env` (injected automatically).
   - User-prompted credentials go in per-server `variables: [{name, title?,
     description?, link?}]` (never at root!) and expand in **`command`, `args`,
     `env`, `url`, `headers`, `oauth`** — **never** in `cwd`. Plugins declaring
     `variables` install **disabled** until the user fills them in.
   - Never use `${env:X}` (not expanded) and never commit literal secrets.
4. **OAuth & MCP Apps (`SEP-1865`):**
   - Remote OAuth 2.1 + PKCE `S256` + CIMD: allowlist
     `https://antigravity.google/oauth-callback` (local CLI/App) and
     `https://antigravity.google.com/oauth/callback` (remote Marketplace).
   - For MCP Apps (`_meta.ui.resourceUri` -> `ui://` HTML, `com.google.antigravity/ui`
     `aux_pane`/`global`/`file`): remember `agy` CLI renders no iframes and
     ignores `_meta.ui.visibility`, so **always return clean plain-text
     `content`** alongside `structuredContent`.
5. **Validate:** run `node "$KIT/scripts/lint.mjs" --strict .` and
   `agy plugin validate --strict --json <payload>`.

## Definition of Done

- `lint.mjs --strict` and `agy plugin validate --strict --json` pass cleanly.
- No `/sse` endpoints, no `${PLUGIN_ROOT}` in `command`, no hardcoded secrets,
  and non-`node`/`npx` binaries ship `disabled: true`.

## Constraints

- Prefix server keys if needed and never declare root-level `variables`.
- Keep `eager: true` restricted to 1–3 core tools to protect context tokens.

## Rationalizations

- "`agy plugin validate` didn't complain about my `/sse` URL" -> `agy` doesn't
  inspect URL paths, but legacy HTTP+SSE fails at runtime; use Streamable HTTP
  or `mcp-remote`.
- "I'll pass `${env:...}` inside `mcp_config.json` `env`" -> Antigravity does
  not expand `${env:...}` in plugin MCP configs; declare it in `variables[]`
  instead.
