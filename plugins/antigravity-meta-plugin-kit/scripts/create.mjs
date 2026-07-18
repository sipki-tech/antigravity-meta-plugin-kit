#!/usr/bin/env node
// Scaffolds a new native-only Antigravity plugin repository from the bundled
// templates. Ships inside the plugin so it is available after
// `agy plugin install`; run it from the installed dir or the repo checkout:
//   node ./scripts/create.mjs <plugin-name> [--dir <parent>] [--with-agents] [--dry-run]
import { parseArgs } from "node:util";
import { scaffold } from "./lib/scaffold.mjs";

const HELP = `usage: node ./scripts/create.mjs <plugin-name> [--dir <parent>] [--with-agents] [--dry-run]

  <plugin-name>    kebab-case name; a native-only plugin repo is created in ./<plugin-name>/
  --dir <parent>   parent directory for the scaffold (default: cwd)
  --with-agents    also scaffold an example subagent (agents/*.md)
  --dry-run        print the plan without writing anything`;

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      "with-agents": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const name = positionals[0];
  if (!name) {
    console.log(HELP);
    return 1;
  }
  const dryRun = values["dry-run"];
  const mode = dryRun ? "[dry-run] " : "";
  const { targetDir, actions } = scaffold({
    name,
    parentDir: values.dir ?? process.cwd(),
    dryRun,
    withAgents: values["with-agents"],
  });
  for (const a of actions) console.log(`${mode}${a.type}  ${a.target}`);
  if (actions.length === 0) console.log(`${mode}nothing to do`);
  console.log(
    dryRun ? `[dry-run] would create: ${targetDir}` : `created: ${targetDir}`,
  );
  if (!dryRun) {
    console.log(`Next steps:
  cd ${name} && npm test                          # scaffolded tests pass out of the box
  agy plugin validate plugins/${name}             # official structural validator
  # publish, then install anywhere with:
  #   agy plugin install https://github.com/<owner>/${name}`);
  }
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`create: ${err.message}`);
  process.exit(1);
}
