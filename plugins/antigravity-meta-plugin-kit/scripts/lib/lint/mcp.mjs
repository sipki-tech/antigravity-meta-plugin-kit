// MCP server configuration validation (`mcp_config.json`).
import { join } from "node:path";
import { readJsonc } from "../fsutil.mjs";
import { BUILTIN_MCP_COMMANDS, SECRET_KEY_RE } from "./constants.mjs";
import { isFile } from "./helpers.mjs";

const LITERAL_SECRET_VALUE_RE =
  /(?:^|[\s=:])(?:ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|Bearer\s+(?!\$\{)[A-Za-z0-9._~+/=-]{16,})/;

const VALID_BACKGROUND_MODES = new Set(["off", "always"]);

function looksLikeLiteralSecret(key, value) {
  if (typeof value !== "string") return false;
  if (/\$\{[^}]+\}/.test(value)) return false;
  if (/^(?:TODO|YOUR_|REPLACE_|<)/i.test(value)) return false;
  if (LITERAL_SECRET_VALUE_RE.test(value)) return true;
  return SECRET_KEY_RE.test(key) && value.length >= 16;
}

export function lintMcp(dir, { ok, warn }) {
  const mcpFile = join(dir, "mcp_config.json");
  if (!isFile(mcpFile)) return;
  const parsed = readJsonc(mcpFile);
  const validObj =
    Boolean(parsed?.ok) && Boolean(parsed.data) && typeof parsed.data === "object" && !Array.isArray(parsed.data);
  ok(
    "mcp_config.json parses",
    validObj,
    validObj ? mcpFile : parsed?.error ?? "mcp_config.json must be a JSON object",
  );
  if (!validObj) return;

  const mcp = parsed.data;
  if (mcp.variables !== undefined) {
    warn(
      "mcp_config.json top-level variables",
      "variables must be declared inside each server entry (mcpServers.<name>.variables), not at root",
    );
  }
  for (const k of Object.keys(mcp)) {
    if (k !== "mcpServers" && k !== "variables" && k !== "$schema") {
      warn(
        `mcp_config.json unknown top-level key "${k}"`,
        'loader reads servers only from "mcpServers"',
      );
    }
  }

  if (mcp.mcpServers === undefined) return;
  if (!mcp.mcpServers || typeof mcp.mcpServers !== "object" || Array.isArray(mcp.mcpServers)) {
    ok("mcp servers well-formed", false, '"mcpServers" must be a JSON object');
    return;
  }

  const badServers = [];
  const riskyCommands = [];

  for (const [srvName, def] of Object.entries(mcp.mcpServers)) {
    if (!def || typeof def !== "object" || Array.isArray(def)) {
      badServers.push(`${srvName}: expected server object`);
      continue;
    }

    const hasCmd = typeof def.command === "string" && def.command.trim().length > 0;
    const url = def.url ?? def.serverUrl;
    const hasUrl = typeof url === "string" && url.trim().length > 0;

    if (hasCmd && hasUrl) {
      badServers.push(`${srvName}: cannot specify both command and url/serverUrl`);
    } else if (!hasCmd && !hasUrl) {
      badServers.push(`${srvName}: must specify command (stdio) or url (Streamable HTTP)`);
    }

    if (def.httpUrl !== undefined) {
      warn(`mcp server "${srvName}" uses httpUrl`, 'use "url" instead of "httpUrl"');
    }
    if (def.type !== undefined) {
      warn(
        `mcp server "${srvName}" has unknown field "type"`,
        'native mcp_config.json infers transport from command vs url (drop "type")',
      );
    }
    if (hasUrl && /\/sse(?:[/?#]|$)/i.test(url)) {
      warn(
        `mcp server "${srvName}" uses /sse endpoint`,
        `legacy HTTP+SSE is unsupported in agy 1.5.17 — use Streamable HTTP (/mcp) or npx -y mcp-remote`,
      );
    }

    if (hasCmd && !BUILTIN_MCP_COMMANDS.has(def.command) && def.disabled !== true) {
      riskyCommands.push(srvName);
    }

    // tools.<tool>.background MUST be a string ("off" | "always") — boolean skips the server in agy 1.5.18
    if (def.tools && typeof def.tools === "object" && !Array.isArray(def.tools)) {
      for (const [toolName, toolCfg] of Object.entries(def.tools)) {
        if (!toolCfg || typeof toolCfg !== "object" || Array.isArray(toolCfg)) continue;
        if (toolCfg.background !== undefined) {
          if (typeof toolCfg.background !== "string") {
            badServers.push(
              `${srvName}.tools.${toolName}.background must be a string ("off" | "always"), not ${typeof toolCfg.background} (agy skips server on boolean)`,
            );
          } else if (!VALID_BACKGROUND_MODES.has(toolCfg.background)) {
            warn(
              `mcp server "${srvName}" unknown background mode "${toolCfg.background}"`,
              `tools.${toolName}.background expected "off" or "always"`,
            );
          }
        }
      }
    }

    const declaredVars = new Set();
    if (Array.isArray(def.variables)) {
      for (const v of def.variables) {
        if (typeof v?.name === "string" && v.name) declaredVars.add(v.name);
      }
    }

    const checkText = (field, value) => {
      if (typeof value !== "string") return;
      if (/\$\{env:[^}]+\}/.test(value)) {
        warn(
          `mcp server "${srvName}" uses \${env:...} in ${field}`,
          "Antigravity does not expand OS ${env:...} placeholders — declare in variables[]",
        );
      }
      for (const m of value.matchAll(/\$\{([A-Za-z0-9_]+)\}/g)) {
        const vname = m[1];
        if (vname === "PLUGIN_ROOT" || vname === "PLUGIN_DATA") {
          if (!["args", "env", "cwd"].includes(field)) {
            warn(
              `mcp server "${srvName}" uses \${${vname}} in ${field}`,
              'PLUGIN_ROOT/PLUGIN_DATA expand only in "args", "env", and "cwd"',
            );
          }
        } else if (declaredVars.has(vname)) {
          if (field === "cwd") {
            warn(
              `mcp server "${srvName}" uses variable \${${vname}} in cwd`,
              "user variables do not expand in cwd",
            );
          }
        } else {
          warn(
            `mcp server "${srvName}" uses undeclared \${${vname}} in ${field}`,
            `declare "${vname}" in mcpServers.${srvName}.variables[]`,
          );
        }
      }
    };

    if (hasCmd) checkText("command", def.command);
    if (hasUrl) checkText("url", url);
    if (typeof def.cwd === "string") checkText("cwd", def.cwd);
    if (Array.isArray(def.args)) def.args.forEach((a) => checkText("args", a));
    if (def.headers && typeof def.headers === "object" && !Array.isArray(def.headers)) {
      for (const [hk, hv] of Object.entries(def.headers)) {
        checkText("headers", hv);
        if (looksLikeLiteralSecret(hk, hv)) {
          warn(
            `mcp server "${srvName}" possible hardcoded secret in headers.${hk}`,
            `use "\${TOKEN}" + variables[] instead of committing literal secrets`,
          );
        }
      }
    }
    if (def.env && typeof def.env === "object" && !Array.isArray(def.env)) {
      for (const [ek, ev] of Object.entries(def.env)) {
        if (ek === "PLUGIN_ROOT" || ek === "PLUGIN_DATA") {
          warn(
            `mcp server "${srvName}" sets ${ek} in env`,
            `${ek} is injected automatically for plugin MCP servers and ignored in env`,
          );
        }
        checkText("env", ev);
        if (looksLikeLiteralSecret(ek, ev)) {
          warn(
            `mcp server "${srvName}" possible hardcoded secret in env.${ek}`,
            `use "\${${ek}}" + variables[] instead of committing literal secrets`,
          );
        }
      }
    }
  }

  ok("mcp servers well-formed", badServers.length === 0, badServers.join("; ") || "ok");
  ok(
    "mcp: non-builtin commands ship disabled",
    riskyCommands.length === 0,
    riskyCommands.join(", ") || "missing external binaries must not break sessions",
  );
}
