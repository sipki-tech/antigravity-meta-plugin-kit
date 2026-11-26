#!/usr/bin/env node
// Read-only diagnostics for a local Google Antigravity environment:
// scans ~/.gemini/config/plugins/, config.json, and workspace .agents/ for
// name collisions, disabled mismatches, runtime traps, and hard truncation caps.
//
// Usage:
//   node ./scripts/doctor.mjs [--workspace <dir>] [--home <dir>] [--strict] [--json]
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import { runDoctor } from "./lib/doctor.mjs";

const HELP = `usage: node ./scripts/doctor.mjs [--workspace <dir>] [--home <dir>] [--strict] [--json]

  --workspace <dir>  workspace directory to inspect for .agents/ (default: cwd)
  --home <dir>       override home directory for ~/.gemini/config/ (default: os.homedir())
  --strict           exit 1 on warnings as well as errors
  --json             emit machine-readable JSON report`;

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: "string" },
      home: { type: "string" },
      strict: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const report = runDoctor({
    homeDir: values.home ?? homedir(),
    workspaceDir: values.workspace ?? process.cwd(),
  });

  const ok = values.strict ? report.strictPass : report.pass;
  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
    return ok ? 0 : 1;
  }

  console.log(`doctor: workspace=${report.workspaceDir}`);
  console.log(`        home=${report.homeDir}`);
  console.log(
    `plugins: ${report.counts.pluginsEnabled}/${report.counts.pluginsTotal} enabled  |  ` +
      `skills=${report.counts.skills}  agents=${report.counts.agents}  rules=${report.counts.rules}`,
  );
  console.log(
    `always_on rules budget: ~${report.alwaysOnRules.estimatedTokens}/${report.alwaysOnRules.budgetTokens} tokens ` +
      `(${report.alwaysOnRules.totalBytes} B across ${report.alwaysOnRules.count} file(s))`,
  );

  for (const p of report.plugins) {
    const state = p.enabled ? "enabled " : `disabled (${p.enabledSource})`;
    const lintSummary = p.lint
      ? p.lint.strictPass
        ? "lint OK"
        : `${p.lint.failedChecks} FAIL, ${p.lint.warnings} warn`
      : "skipped";
    console.log(`  [${p.scope}] ${(p.name ?? p.dirName).padEnd(28)} ${state.padEnd(28)} ${lintSummary}`);
  }

  if (report.findings.length > 0) {
    console.log("");
    for (const f of report.findings) {
      const tag = f.severity === "error" ? "ERR " : f.severity === "warn" ? "WARN" : "INFO";
      console.log(`${tag}  [${f.category}] ${f.subject}: ${f.message}`);
    }
  }

  console.log(
    ok
      ? `doctor: healthy (${report.errors} error(s), ${report.warnings} warning(s))`
      : `doctor: issues detected (${report.errors} error(s), ${report.warnings} warning(s)${values.strict ? ", --strict" : ""})`,
  );
  return ok ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`doctor: ${err.message}`);
  process.exit(1);
}
