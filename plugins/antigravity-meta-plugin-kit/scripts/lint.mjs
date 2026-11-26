#!/usr/bin/env node
// Trap-aware linter for Google Antigravity plugin payloads (agy 1.5.17+).
// Ships inside the plugin so it works after `agy plugin install` and in any
// offline CI environment without `agy` installed:
//   node ./scripts/lint.mjs <plugin-dir | repo-root> [--strict] [--json] [--all]
import { parseArgs } from "node:util";
import { lintPlugin, lintTarget, resolveAllPayloads } from "./lib/lint.mjs";

const HELP = `usage: node ./scripts/lint.mjs <plugin-dir | repo-root | marketplace.json> [--strict] [--json] [--all]

  <target>    plugin payload directory, plugin.json, marketplace.json, or repo root with plugins/<name>/
  --strict    exit 1 on warnings as well as FAIL checks (matches \`agy plugin validate --strict\`)
  --json      emit machine-readable JSON output
  --all       lint every plugin found under <target>/plugins/*`;

function printReport(report) {
  console.log(`linting ${report.payloadDir}`);
  for (const c of report.checks) {
    console.log(`${c.pass ? "ok " : "FAIL"}  ${c.name}${c.note ? `  (${c.note})` : ""}`);
  }
  for (const w of report.warnings) {
    console.log(`warn  ${w.name}${w.note ? `  (${w.note})` : ""}`);
  }
  for (const n of report.notes) {
    console.log(`note  ${n.name}${n.note ? `  (${n.note})` : ""}`);
  }
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      strict: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const target = positionals[0];
  if (!target) {
    console.log(HELP);
    return 1;
  }

  const reports = values.all
    ? resolveAllPayloads(target).map((payloadDir) => ({ payloadDir, ...lintPlugin(payloadDir) }))
    : [lintTarget(target)];

  const allPass = reports.every((r) => (values.strict ? r.strictPass : r.pass));

  if (values.json) {
    const payload = reports.length === 1 && !values.all ? reports[0] : { pass: allPass, reports };
    console.log(JSON.stringify(payload, null, 2));
    return allPass ? 0 : 1;
  }

  for (const r of reports) printReport(r);
  if (allPass) {
    console.log(
      values.strict
        ? "lint: all checks passed (strict: 0 warnings)"
        : "lint: all checks passed",
    );
  } else {
    const failedChecks = reports.reduce(
      (sum, r) => sum + r.checks.filter((c) => !c.pass).length,
      0,
    );
    const totalWarnings = reports.reduce((sum, r) => sum + r.warnings.length, 0);
    console.log(
      `lint: failed (${failedChecks} failed check(s), ${totalWarnings} warning(s)${values.strict ? ", --strict" : ""})`,
    );
  }
  return allPass ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`lint: ${err.message}`);
  process.exit(1);
}
