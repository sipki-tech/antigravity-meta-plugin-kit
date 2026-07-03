#!/usr/bin/env node
import { parseArgs } from "node:util";
import { scaffold } from "../lib/scaffold.mjs";
import { lintTarget } from "../lib/lint.mjs";

const HELP = `antigravity-meta-plugin-kit — scaffold and lint Antigravity plugins

Usage:
  npx github:sipki-tech/antigravity-meta-plugin-kit create <plugin-name> [--dir <parent>] [--dry-run]
  npx github:sipki-tech/antigravity-meta-plugin-kit lint <plugin-dir>
  (add #main to force the latest commit: npx github:sipki-tech/antigravity-meta-plugin-kit#main <command>)

Commands:
  create <plugin-name>     Scaffold a new Antigravity plugin repository in
                           ./<plugin-name>/ — payload, installer, tests, CI.
  lint <plugin-dir>        Validate a plugin payload (or a scaffolded repo
                           root) against the known loader traps.

Options:
  --dir <parent>           Parent directory for the scaffold (default: cwd).
  --dry-run                Print the plan without writing anything.
  -h, --help               Show this help.
`;

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
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
