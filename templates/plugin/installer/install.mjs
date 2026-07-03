import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLayout, PLUGIN_NAME } from "./paths.mjs";
import {
  copyDir,
  createJournal,
  readJson,
  removeDir,
  writeJson,
} from "./fsutil.mjs";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAYLOAD_DIR = join(PACKAGE_ROOT, "plugins", PLUGIN_NAME);

// The Antigravity plugin manager writes installed_version.json into every
// installed plugin; the loader uses it to recognize the plugin as installed.
// A raw copy without it is silently ignored (observed 2026-07, preview).
function pluginVersion() {
  return readJson(join(PAYLOAD_DIR, "plugin.json"), { version: "0.0.0" }).version;
}

function writeInstalledVersion(journal, pluginDir) {
  writeJson(journal, join(pluginDir, "installed_version.json"), {
    version: pluginVersion(),
  });
}

// A corrupt checkout (interrupted npx download, stripped payload) would
// otherwise surface as a raw stack trace mid-install.
export function requirePayload(payloadDir = PAYLOAD_DIR) {
  for (const dir of [payloadDir, join(payloadDir, "skills")]) {
    if (!existsSync(dir)) {
      throw new Error(
        `{{name}} payload is incomplete (missing ${dir}). ` +
          "The checkout is corrupt — re-run the install command.",
      );
    }
  }
}

export function install(opts = {}) {
  requirePayload();
  const layout = detectLayout(opts);
  const journal = createJournal(Boolean(opts.dryRun));

  copyDir(journal, PAYLOAD_DIR, layout.pluginDir);
  writeInstalledVersion(journal, layout.pluginDir);
  for (const mirror of layout.mirrorPluginDirs) {
    copyDir(journal, PAYLOAD_DIR, mirror);
    writeInstalledVersion(journal, mirror);
  }

  mergeMcpConfig(journal, layout.mcpConfigFile);

  return { layout, actions: journal.actions };
}

export function uninstall(opts = {}) {
  requirePayload();
  const layout = detectLayout(opts);
  const journal = createJournal(Boolean(opts.dryRun));

  removeDir(journal, layout.pluginDir);
  for (const mirror of layout.mirrorPluginDirs) removeDir(journal, mirror);
  pruneMcpConfig(journal, layout.mcpConfigFile);

  return { layout, actions: journal.actions };
}

export function verify(opts = {}) {
  const layout = detectLayout(opts);
  const checks = [];
  const ok = (name, pass, note = "") => checks.push({ name, pass, note });

  ok("plugin dir", existsSync(layout.pluginDir), layout.pluginDir);
  const manifest = readJson(join(layout.pluginDir, "plugin.json"));
  ok("plugin.json parses", manifest?.name === PLUGIN_NAME);
  ok("plugin.json author is an object", typeof manifest?.author === "object");
  // The single thing every working plugin has and a raw copy lacks — the
  // loader uses it to recognize the plugin as installed.
  ok(
    "installed_version.json present",
    existsSync(join(layout.pluginDir, "installed_version.json")),
  );
  const installedVersion = readJson(
    join(layout.pluginDir, "installed_version.json"),
  )?.version;
  ok(
    "installed_version matches plugin.json",
    Boolean(installedVersion) && installedVersion === manifest?.version,
    `installed_version=${installedVersion} plugin.json=${manifest?.version}`,
  );
  const hooks = readJson(join(layout.pluginDir, "hooks", "hooks.json"));
  ok("hooks.json namespaced", Boolean(hooks?.[PLUGIN_NAME]));
  ok(
    "hook script example-guard.mjs",
    existsSync(join(layout.pluginDir, "scripts", "example-guard.mjs")),
  );
  return { layout, checks, pass: checks.every((c) => c.pass) };
}

function mergeMcpConfig(journal, mcpConfigFile) {
  const ours = readJson(join(PAYLOAD_DIR, "mcp_config.json"), { mcpServers: {} });
  const existing = readJson(mcpConfigFile, { mcpServers: {} });
  const merged = { ...existing, mcpServers: { ...(existing.mcpServers ?? {}) } };
  let changed = false;
  for (const [name, def] of Object.entries(ours.mcpServers ?? {})) {
    // Non-destructive: never touch a server the user already configured.
    if (merged.mcpServers[name]) continue;
    merged.mcpServers[name] = def;
    changed = true;
  }
  if (changed) writeJson(journal, mcpConfigFile, merged);
}

function pruneMcpConfig(journal, mcpConfigFile) {
  const ours = readJson(join(PAYLOAD_DIR, "mcp_config.json"), { mcpServers: {} });
  const existing = readJson(mcpConfigFile);
  if (!existing?.mcpServers) return;
  let changed = false;
  for (const [name, def] of Object.entries(ours.mcpServers ?? {})) {
    const current = existing.mcpServers[name];
    if (!current) continue;
    // Only remove entries identical to what we installed; user edits stay.
    if (JSON.stringify(current) === JSON.stringify(def)) {
      delete existing.mcpServers[name];
      changed = true;
    }
  }
  if (changed) writeJson(journal, mcpConfigFile, existing);
}
