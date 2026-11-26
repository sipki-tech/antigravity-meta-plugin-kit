#!/usr/bin/env node
// Scaffolds a new native Google Antigravity plugin repository (agy 1.5.17+).
// Ships inside the plugin so it is available after `agy plugin install`:
//   node ./scripts/create.mjs <plugin-name> [--dir <parent>] [--minimal]
//     [--with-agents] [--with-sidecar] [--with-cli]
//     [--manifest-layout root|dot-antigravity] [--dry-run]
import { relative } from "node:path";
import { parseArgs } from "node:util";
import { scaffold } from "./lib/scaffold.mjs";

const HELP = `usage: node ./scripts/create.mjs <plugin-name> [options]

  <plugin-name>                 strict kebab-case name (creates ./<plugin-name>/)
  --dir <parent>                parent directory for the scaffold (default: cwd)
  --minimal                     omit hooks, hook scripts, and MCP stub (manifest, logo, rule, skill, tests, CI)
  --with-agents                 scaffold a canonical Markdown subagent (agents/*.md) + /<name>-help skill wrapper
  --with-sidecar                scaffold a minimal sidecar (sidecars/<name>-worker/sidecar.json)
  --with-cli                    scaffold bundled CLI + auth.json + CLI skill (Google Workspace pattern)
  --manifest-layout <layout>    root (default) or dot-antigravity (.antigravity-plugin/plugin.json)
  --dry-run                     print the plan without writing anything`;

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      minimal: { type: "boolean", default: false },
      "with-agents": { type: "boolean", default: false },
      "with-sidecar": { type: "boolean", default: false },
      "with-cli": { type: "boolean", default: false },
      "manifest-layout": { type: "string", default: "root" },
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
    minimal: values.minimal,
    withAgents: values["with-agents"],
    withSidecar: values["with-sidecar"],
    withCli: values["with-cli"],
    manifestLayout: values["manifest-layout"],
  });
  for (const a of actions) console.log(`${mode}${a.type}  ${a.target}`);
  if (actions.length === 0) console.log(`${mode}nothing to do`);
  console.log(
    dryRun ? `[dry-run] would create: ${targetDir}` : `created: ${targetDir}`,
  );
  if (!dryRun) {
    const cdTarget = relative(process.cwd(), targetDir) || ".";
    console.log(`Next steps:
  cd ${cdTarget} && npm test                                # scaffolded tests pass out of the box
  agy plugin validate --strict plugins/${name}          # official Antigravity validator
  # install locally or publish to GitHub:
  #   agy plugin install plugins/${name}
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
