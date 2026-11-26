#!/usr/bin/env node
// Example fail-open PreToolUse guard: denies obviously destructive shell
// commands. Keep pure logic in an exported function so unit tests can import
// it directly; the guarded wrapper routes stdin/stdout through runHook() so
// any internal error resolves to allow with exit 0.
import {
  ALLOW,
  commandLineOf,
  denyResponse,
  isMainModule,
  runHook,
} from "./lib/io.mjs";

const DESTRUCTIVE = [
  /\brm\s+(?:-(?:[a-z]*[rf][a-z]*|-recursive|-force)\s+)+(?:\/+\*?|~(?:\/+\*?)?|\$HOME(?:\/+\*?)?|\*)(?:\s|$)/i,
  /\bgit\s+push\b[^\n]*\s(?:--force(?!-with-lease)\b|-f\b)/,
];

export function checkCommand(cmd) {
  const line = String(cmd ?? "");
  for (const re of DESTRUCTIVE) {
    if (re.test(line)) {
      return denyResponse(
        `[{{name}} example-guard] blocked a destructive command: ${line}`,
      );
    }
  }
  return ALLOW;
}

if (isMainModule(import.meta.url)) {
  runHook((input) => checkCommand(commandLineOf(input)));
}
