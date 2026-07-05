// Installs the meta-kit's own plugin payload — the same patterns this kit
// scaffolds for others (journal/dry-run, installed_version.json, mirrors,
// workflow aliases).
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLayout, workflowsDirs, PLUGIN_NAME } from "./paths.mjs";
import {
  copyDir,
  createJournal,
  readJson,
  removeDir,
  writeJson,
} from "../lib/fsutil.mjs";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAYLOAD_DIR = join(PACKAGE_ROOT, "plugins", PLUGIN_NAME);

// The Antigravity plugin manager writes installed_version.json into every
// installed plugin; the loader uses it to recognize the plugin as installed.
// A raw copy without it is silently ignored (observed 2026-07, preview).
export function pluginVersion() {
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
  for (const dir of [
    payloadDir,
    join(payloadDir, "skills"),
    join(payloadDir, "agents"),
    join(payloadDir, "workflows"),
  ]) {
    if (!existsSync(dir)) {
      throw new Error(
        `${PLUGIN_NAME} payload is incomplete (missing ${dir}). The checkout ` +
          "is corrupt — re-run via `npx github:sipki-tech/antigravity-meta-plugin-kit install`.",
      );
    }
  }
}

export function listSkills() {
  return readdirSync(join(PAYLOAD_DIR, "skills"));
}

export function listAgents() {
  return readdirSync(join(PAYLOAD_DIR, "agents"));
}

export function listWorkflows() {
  return readdirSync(join(PAYLOAD_DIR, "workflows"));
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

  if (layout.scope === "workspace") {
    installWorkflowsInto(journal, opts.workspace);
  }

  return { layout, actions: journal.actions };
}

export function uninstall(opts = {}) {
  requirePayload();
  const layout = detectLayout(opts);
  const journal = createJournal(Boolean(opts.dryRun));

  removeDir(journal, layout.pluginDir);
  for (const mirror of layout.mirrorPluginDirs) removeDir(journal, mirror);
  if (layout.scope === "workspace") {
    for (const dir of workflowsDirs(opts.workspace)) {
      for (const wf of listWorkflows()) removeDir(journal, join(dir, wf));
    }
  }

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
  // Integrity: every payload skill/agent must exist in the installed copy.
  const missingSkills = listSkills().filter(
    (s) => !existsSync(join(layout.pluginDir, "skills", s, "SKILL.md")),
  );
  ok("all skills installed", missingSkills.length === 0, missingSkills.join(", "));
  const missingAgents = listAgents().filter(
    (a) => !existsSync(join(layout.pluginDir, "agents", a)),
  );
  ok("all agents installed", missingAgents.length === 0, missingAgents.join(", "));
  if (layout.scope === "workspace") {
    const wfDir = workflowsDirs(opts.workspace)[0];
    const missingWorkflows = listWorkflows().filter(
      (wf) => !existsSync(join(wfDir, wf)),
    );
    ok(
      "workflows installed",
      missingWorkflows.length === 0,
      missingWorkflows.join(", ") || wfDir,
    );
  }
  return { layout, checks, pass: checks.every((c) => c.pass) };
}

function installWorkflowsInto(journal, projectRoot) {
  for (const dir of workflowsDirs(projectRoot)) {
    for (const wf of listWorkflows()) {
      copyDir(journal, join(PAYLOAD_DIR, "workflows", wf), join(dir, wf));
    }
  }
}

// Standalone command: drop the /meta-* workflows into the current project
// without a full workspace install (useful alongside a global install).
export function installWorkflows({ projectRoot = process.cwd(), dryRun = false } = {}) {
  requirePayload();
  const journal = createJournal(Boolean(dryRun));
  installWorkflowsInto(journal, projectRoot);
  return { targets: workflowsDirs(projectRoot), actions: journal.actions };
}
