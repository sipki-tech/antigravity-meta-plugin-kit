import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const PLUGIN_NAME = "{{name}}";

// Preview builds disagree on where plugins live:
//   ~/.gemini/config/plugins/          — shared across IDE/CLI surfaces (primary)
//   ~/.gemini/antigravity-cli/plugins/ — what `agy plugin install` writes (mirror)
// Install to the primary and mirror into the CLI path when it exists.
export function detectLayout({ home = homedir(), workspace = null } = {}) {
  if (workspace) {
    const agents = join(workspace, ".agents");
    return {
      scope: "workspace",
      pluginDir: join(agents, "plugins", PLUGIN_NAME),
      mirrorPluginDirs: [],
      mcpConfigFile: join(agents, "mcp_config.json"),
    };
  }
  const gemini = join(home, ".gemini");
  const mirrors = [];
  if (existsSync(join(gemini, "antigravity-cli", "plugins"))) {
    mirrors.push(join(gemini, "antigravity-cli", "plugins", PLUGIN_NAME));
  }
  return {
    scope: "global",
    pluginDir: join(gemini, "config", "plugins", PLUGIN_NAME),
    mirrorPluginDirs: mirrors,
    mcpConfigFile: join(gemini, "config", "mcp_config.json"),
  };
}
