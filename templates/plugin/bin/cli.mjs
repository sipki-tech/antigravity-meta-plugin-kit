#!/usr/bin/env node
import { parseArgs } from "node:util";
import { install, uninstall, verify } from "../installer/install.mjs";

const HELP = `{{name}} — Antigravity plugin installer

Usage:
  node bin/cli.mjs install [options]
  node bin/cli.mjs verify [options]
  node bin/cli.mjs uninstall [options]
  (once pushed to GitHub: npx github:TODO-owner/{{name}} <command>)

Options:
  --workspace   Install into ./.agents/ of the current project
                instead of ~/.gemini (global).
  --dry-run     Print the plan without changing anything.
  -h, --help    Show this help.
`;

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      workspace: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0] ?? "install";
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const opts = {
    workspace: values.workspace ? process.cwd() : null,
    dryRun: values["dry-run"],
  };
  const mode = opts.dryRun ? "[dry-run] " : "";

  switch (command) {
    case "install": {
      const { layout, actions } = install(opts);
      printActions(mode, actions);
      console.log(
        opts.dryRun
          ? `[dry-run] would install (${layout.scope}): ${layout.pluginDir}`
          : `installed (${layout.scope}): ${layout.pluginDir}`,
      );
      if (!opts.dryRun) {
        console.log("Restart Antigravity to pick up the plugin.");
      }
      return 0;
    }
    case "uninstall": {
      const { layout, actions } = uninstall(opts);
      printActions(mode, actions);
      console.log(
        opts.dryRun
          ? `[dry-run] would uninstall (${layout.scope})`
          : `uninstalled (${layout.scope})`,
      );
      console.log(
        "Note: MCP servers you edited after install were left in place.",
      );
      return 0;
    }
    case "verify": {
      const { checks, pass } = verify(opts);
      for (const c of checks) {
        console.log(`${c.pass ? "ok " : "FAIL"}  ${c.name}${c.note ? `  (${c.note})` : ""}`);
      }
      console.log(pass ? "verify: all checks passed" : "verify: some checks failed");
      return pass ? 0 : 1;
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
  console.error(`{{name}}: ${err.message}`);
  process.exit(1);
}
