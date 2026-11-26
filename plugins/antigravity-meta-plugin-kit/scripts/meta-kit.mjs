#!/usr/bin/env node
// Unified CLI router for antigravity-meta-plugin-kit:
//   meta-kit <create|lint|probe|doctor> [args...]
// Keeps direct scripts/{create,lint,probe,doctor}.mjs 100% compatible.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  create: "create.mjs",
  lint: "lint.mjs",
  probe: "probe.mjs",
  doctor: "doctor.mjs",
};

const HELP = `usage: meta-kit <command> [args...]

  create <name> [flags]      scaffold a native Antigravity plugin repository
  lint <target> [flags]      offline strict linter (plugins & marketplace.json)
  probe [--fast|--live]      check local \`agy\` binary for contract drift
  doctor [--workspace <dir>] read-only diagnostics of installed plugins & rules

Run \`meta-kit <command> --help\` for command-specific options.`;

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
  console.log(HELP);
  process.exit(0);
}

const targetScript = COMMANDS[cmd];
if (!targetScript) {
  console.error(`meta-kit: unknown command "${cmd}"\n`);
  console.error(HELP);
  process.exit(1);
}

const res = spawnSync(process.execPath, [join(SCRIPTS_DIR, targetScript), ...rest], {
  stdio: "inherit",
});

if (res.error) {
  console.error(`meta-kit: ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status ?? 1);
