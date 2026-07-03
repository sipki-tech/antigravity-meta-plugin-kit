// Example fail-open PreToolUse guard: denies obviously destructive commands.
// Keep the logic in an exported function so tests can import it directly; the
// executable wrapper at the bottom routes it through runHook (fail-open: any
// internal error resolves to allow, exit 0 — a hook must never break the
// host session).
import { pathToFileURL } from "node:url";
import { runHook, commandLineOf, ALLOW } from "./lib/io.mjs";

const DESTRUCTIVE = [
  /\brm\s+(-[a-z]*[rf][a-z]*\s+)+(\/|~)(\s|$)/i,
  /\bgit\s+push\s+\S*\s*--force\b/,
];

export function checkCommand(cmd) {
  const line = String(cmd ?? "");
  for (const re of DESTRUCTIVE) {
    if (re.test(line)) {
      return {
        allow_tool: false,
        deny_reason: `[{{name}} example-guard] blocked a destructive command: ${line}`,
      };
    }
  }
  return ALLOW;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  runHook((input) => checkCommand(commandLineOf(input)));
