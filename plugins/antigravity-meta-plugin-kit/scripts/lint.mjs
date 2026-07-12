#!/usr/bin/env node
// Trap-aware linter for Antigravity plugin payloads. Ships inside the plugin so
// it is available after `agy plugin install`; run it from the installed dir or
// the repo checkout:
//   node ./scripts/lint.mjs <plugin-dir | repo-root>
// Complements `agy plugin validate` — see docs/internals.md for the split.
import { lintTarget } from "./lib/lint.mjs";

function main() {
  const dir = process.argv[2];
  if (!dir || dir === "-h" || dir === "--help") {
    console.log("usage: node ./scripts/lint.mjs <plugin-dir>");
    return dir ? 0 : 1;
  }
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

try {
  process.exit(main());
} catch (err) {
  console.error(`lint: ${err.message}`);
  process.exit(1);
}
