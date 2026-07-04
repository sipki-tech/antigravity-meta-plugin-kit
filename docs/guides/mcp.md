# MCP servers: mcp_config.json, transports, the disabled:true convention

*English | [Русский](mcp.ru.md)*

MCP (Model Context Protocol) servers expose external tools to the agent. A
plugin can bundle its own servers; they activate with the plugin, and their
tools are namespaced on conflict.

## Configuration

Locations: global `~/.gemini/config/mcp_config.json`, workspace
`<project>/.agents/mcp_config.json`, or per-plugin
`plugins/<name>/mcp_config.json`.

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "my-local-tool": {
      "command": "my-tool",
      "args": ["mcp"],
      "env": { "MY_TOOL_MODE": "readonly" },
      "disabled": true
    },
    "remote-service": {
      "serverUrl": "https://mcp.mycompany.com/sse"
    }
  }
}
```

Two transports:

- **stdio** — `command` (executable), `args`, `env`. The server is spawned
  locally and speaks over stdin/stdout.
- **SSE** — `serverUrl` for remote servers over HTTP Server-Sent Events.

## The `disabled: true` convention

If `command` is anything but a universally available launcher (`node`,
`npx`), a user without that binary gets broken sessions. So:

- ship such entries with `"disabled": true`;
- have the **installer** detect the binary and enable the entry only when
  it's actually present (the reference antigravity-kit does exactly this for
  its optional `headroom` CLI).

This kit's lint fails a payload whose non-builtin command lacks
`disabled: true`. Note: an empty `"mcpServers": {}` is reported by
`agy plugin validate` as `skipped (not found)` — that's fine.

## Non-destructive merge & prune (installer contract)

When your installer merges plugin servers into the user's `mcp_config.json`:

- **never overwrite** an entry the user already has — if the name exists,
  skip it;
- on uninstall, **prune only entries byte-identical** to what you installed;
  anything the user edited stays.

The scaffolded `installer/install.mjs` implements both; the scaffolded tests
assert them (a user-defined server survives install + uninstall).

## Pitfalls

- A required binary shipped enabled → sessions break on machines without it.
- Overwriting the user's tuned server definition on install → rage.
- Secrets in `env` committed to the repo — use placeholders and document.
- Forgetting that plugin servers only run while the plugin is enabled.

## Checklist

- [ ] every non-`node`/`npx` command ships `disabled: true`
- [ ] installer auto-enables only when the binary is detected
- [ ] merge skips existing user entries; prune removes only exact matches
- [ ] no secrets in committed `env`
- [ ] `lint` passes the MCP checks

*See also: [Plugin manifest & layouts](plugin-manifest.md) ·
[Testing](testing.md)*
