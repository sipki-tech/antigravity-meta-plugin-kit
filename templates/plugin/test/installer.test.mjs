import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install, uninstall, verify } from "../installer/install.mjs";
import { detectLayout, PLUGIN_NAME } from "../installer/paths.mjs";

const freshDir = () => mkdtempSync(join(tmpdir(), "{{name}}-test-"));

test("detectLayout: global vs workspace", () => {
  const g = detectLayout({ home: freshDir() });
  assert.equal(g.scope, "global");
  assert.ok(g.pluginDir.endsWith(join(".gemini", "config", "plugins", PLUGIN_NAME)));

  const w = detectLayout({ workspace: freshDir() });
  assert.equal(w.scope, "workspace");
  assert.ok(w.pluginDir.endsWith(join(".agents", "plugins", PLUGIN_NAME)));
});

test("detectLayout: mirrors into antigravity-cli/plugins when it exists", () => {
  const home = freshDir();
  mkdirSync(join(home, ".gemini", "antigravity-cli", "plugins"), { recursive: true });
  const layout = detectLayout({ home });
  assert.equal(layout.mirrorPluginDirs.length, 1);
});

test("dry-run plans actions without writing", () => {
  const home = freshDir();
  const { actions } = install({ home, dryRun: true });
  assert.ok(actions.length > 0);
  assert.equal(existsSync(join(home, ".gemini")), false);
});

test("install writes installed_version.json and verify passes", () => {
  const home = freshDir();
  install({ home });
  const layout = detectLayout({ home });
  const installed = JSON.parse(
    readFileSync(join(layout.pluginDir, "installed_version.json"), "utf8"),
  );
  assert.ok(installed.version);
  const { pass, checks } = verify({ home });
  assert.ok(pass, JSON.stringify(checks.filter((c) => !c.pass)));
});

test("uninstall keeps user-configured MCP servers", () => {
  const home = freshDir();
  mkdirSync(join(home, ".gemini", "config"), { recursive: true });
  const mcpFile = join(home, ".gemini", "config", "mcp_config.json");
  writeFileSync(
    mcpFile,
    JSON.stringify({ mcpServers: { mine: { command: "my-server" } } }),
  );
  install({ home });
  uninstall({ home });
  assert.equal(existsSync(detectLayout({ home }).pluginDir), false);
  const mcp = JSON.parse(readFileSync(mcpFile, "utf8"));
  assert.ok(mcp.mcpServers.mine, "user MCP server must survive uninstall");
});
