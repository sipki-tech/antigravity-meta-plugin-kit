#!/usr/bin/env node
import { parseArgs } from "node:util";
import { join } from "node:path";
import { scaffold } from "../lib/scaffold.mjs";
import { lintTarget } from "../lib/lint.mjs";
import {
  install,
  uninstall,
  verify,
  installWorkflows,
  pluginVersion,
} from "../installer/install.mjs";
import { detectLayout } from "../installer/paths.mjs";
import { readJson } from "../lib/fsutil.mjs";

const HELP = `antigravity-meta-plugin-kit — scaffold, lint, and ship Antigravity plugins

Usage:
  npx github:sipki-tech/antigravity-meta-plugin-kit create <plugin-name> [--dir <parent>] [--with-agents] [--dry-run]
  npx github:sipki-tech/antigravity-meta-plugin-kit lint <plugin-dir>
  npx github:sipki-tech/antigravity-meta-plugin-kit install [--workspace] [--dry-run]
  npx github:sipki-tech/antigravity-meta-plugin-kit#main update [--workspace]
  npx github:sipki-tech/antigravity-meta-plugin-kit verify [--workspace]
  npx github:sipki-tech/antigravity-meta-plugin-kit uninstall [--workspace]
  npx github:sipki-tech/antigravity-meta-plugin-kit workflows [--dry-run]
  (add #main to force the latest commit)

Commands:
  create <plugin-name>     Scaffold a new Antigravity plugin repository in
                           ./<plugin-name>/ — payload, installer, tests, CI.
  lint <plugin-dir>        Validate a plugin payload (or a scaffolded repo
                           root) against the known loader traps.
  install                  Install the meta-kit plugin itself: 6 meta skills,
                           4 authoring subagents, /meta-* workflows.
  update                   Refresh an existing install, show old -> new version.
  verify                   Health-check an install (named checks, exit 1 on fail).
  uninstall                Remove the plugin (and its workflow aliases).
  workflows                Add the /meta-* slash commands to the current project.

Options:
  --dir <parent>           Parent directory for the scaffold (default: cwd).
  --with-agents            Also scaffold an example subagent (agents/*.toml —
                           validator-known, officially undocumented format).
  --workspace              Install into ./.agents/ of the current project
                           instead of ~/.gemini (global).
  --dry-run                Print the plan without writing anything.
  -h, --help               Show this help.
`;

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      "with-agents": { type: "boolean", default: false },
      workspace: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const command = positionals[0];
  if (!command) {
    console.log(HELP);
    return 1;
  }
  const installOpts = {
    workspace: values.workspace ? process.cwd() : null,
    dryRun: values["dry-run"],
  };
  const mode = installOpts.dryRun ? "[dry-run] " : "";

  switch (command) {
    case "create": {
      const name = positionals[1];
      if (!name) throw new Error("usage: create <plugin-name>");
      const dryRun = values["dry-run"];
      const mode = dryRun ? "[dry-run] " : "";
      const { targetDir, actions } = scaffold({
        name,
        parentDir: values.dir ?? process.cwd(),
        dryRun,
        withAgents: values["with-agents"],
      });
      printActions(mode, actions);
      console.log(
        dryRun ? `[dry-run] would create: ${targetDir}` : `created: ${targetDir}`,
      );
      if (!dryRun) {
        console.log(`Next steps:
  cd ${name} && npm test                             # scaffolded tests pass out of the box
  node bin/cli.mjs install --workspace --dry-run     # preview an install
  npx github:sipki-tech/antigravity-meta-plugin-kit lint .   # re-lint after edits`);
      }
      return 0;
    }
    case "lint": {
      const dir = positionals[1];
      if (!dir) throw new Error("usage: lint <plugin-dir>");
      const { payloadDir, checks, warnings, notes, pass } = lintTarget(dir);
      console.log(`linting ${payloadDir}`);
      for (const c of checks) {
        console.log(`${c.pass ? "ok " : "FAIL"}  ${c.name}${c.note ? `  (${c.note})` : ""}`);
      }
      for (const w of warnings) {
        console.log(`warn  ${w.name}${w.note ? `  (${w.note})` : ""}`);
      }
      for (const n of notes) {
        console.log(`note  ${n.name}${n.note ? `  (${n.note})` : ""}`);
      }
      console.log(pass ? "lint: all checks passed" : "lint: some checks failed");
      return pass ? 0 : 1;
    }
    case "install": {
      const { layout, actions } = install(installOpts);
      printActions(mode, actions);
      console.log(
        installOpts.dryRun
          ? `[dry-run] would install (${layout.scope}): ${layout.pluginDir}`
          : `installed (${layout.scope}): ${layout.pluginDir}`,
      );
      if (!installOpts.dryRun) {
        console.log("Restart Antigravity to pick up the plugin.");
        if (layout.scope === "global") {
          console.log(
            "Tip: run `npx github:sipki-tech/antigravity-meta-plugin-kit workflows` inside a project to add the /meta-* slash commands there.",
          );
        }
      }
      return 0;
    }
    case "update": {
      const layout = detectLayout(installOpts);
      const before = readJson(
        join(layout.pluginDir, "installed_version.json"),
      )?.version;
      const target = pluginVersion();
      const { actions } = install(installOpts);
      printActions(mode, actions);
      if (!before) {
        console.log(`${mode}not installed before — performed a fresh install (${target})`);
      } else if (before === target) {
        console.log(`${mode}already up to date (${target}) — payload re-synced`);
      } else {
        console.log(`${mode}updated: ${before} -> ${target}`);
      }
      console.log(
        "What changed: https://github.com/sipki-tech/antigravity-meta-plugin-kit/blob/main/CHANGELOG.md",
      );
      if (!installOpts.dryRun) console.log("Restart Antigravity to pick up the update.");
      return 0;
    }
    case "uninstall": {
      const { layout, actions } = uninstall(installOpts);
      printActions(mode, actions);
      console.log(
        installOpts.dryRun
          ? `[dry-run] would uninstall (${layout.scope})`
          : `uninstalled (${layout.scope})`,
      );
      return 0;
    }
    case "verify": {
      const { checks, pass } = verify(installOpts);
      for (const c of checks) {
        console.log(`${c.pass ? "ok " : "FAIL"}  ${c.name}${c.note ? `  (${c.note})` : ""}`);
      }
      console.log(pass ? "verify: all checks passed" : "verify: some checks failed");
      return pass ? 0 : 1;
    }
    case "workflows": {
      const { targets, actions } = installWorkflows({ dryRun: installOpts.dryRun });
      printActions(mode, actions);
      console.log(
        installOpts.dryRun
          ? `[dry-run] would install workflows: ${targets.join(", ")}`
          : `workflows installed: ${targets.join(", ")}`,
      );
      console.log("Invoke them as /meta-audit, /meta-hook, /meta-scout, /meta-mirror.");
      return 0;
    }
    default:
      console.error(`Unknown command '${command}'.\n`);
      console.log(HELP);
      return 1;
  }
}

function printActions(mode, actions) {
  for (const a of actions) console.log(`${mode}${a.type}  ${a.target}`);
  if (actions.length === 0) console.log(`${mode}nothing to do`);
}

try {
  process.exit(main());
} catch (err) {
  console.error(`antigravity-meta-plugin-kit: ${err.message}`);
  process.exit(1);
}
