---
name: meta-test
description: Test Antigravity plugins the zero-dependency way. Use when the user says "meta-test" or writes tests for hooks, installers, or CLIs of an Antigravity plugin.
---

# meta-test — the testing doctrine for plugins

## Goal

Cover a plugin with `node --test` suites (zero dependencies) that prove both
the logic and the wire contract, so a hook or installer regression never
reaches a user's session.

## Instructions

1. Structure for testability: keep logic in exported functions inside `.mjs`
   modules; the executable is a thin wrapper guarded by
   `if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)`.
   Unit tests then import the function directly — no spawning.
2. Hook e2e — test the wire contract, not just the logic:
   ```js
   const res = spawnSync(process.execPath, [script], {
     input: JSON.stringify(input), encoding: "utf8", timeout: 10000,
   });
   assert.equal(res.status, 0);           // ALWAYS, even on junk input
   const out = JSON.parse(res.stdout);
   ```
   Feed it the real event shape, junk (`{"totally": "unexpected"}`), and
   empty stdin; a fail-open hook answers allow/silent to all of them. Assert
   the official response keys (`decision`/`reason`) — and the legacy pair
   (`allow_tool`/`deny_reason`) while the template still ships both.
3. Installer tests run against throwaway roots:
   `mkdtempSync(join(tmpdir(), "x-"))` as `home` or `workspace` — never the
   real `~/.gemini`. Assert the journal contract: with `dryRun: true`,
   `actions.length > 0` AND nothing exists on disk afterwards.
4. Assert the non-destructive MCP merge: pre-seed a user server in
   `mcp_config.json`, install, uninstall — the user's entry must survive
   verbatim.
5. CLI e2e: `spawnSync(process.execPath, [CLI, ...args], {cwd})`; assert exit
   code, stdout patterns, and friendly (stack-trace-free) stderr for user
   errors.
6. Wire it up: `"test": "node --test test/*.test.mjs"` in package.json; CI
   runs it on ubuntu+macos × Node 20/22.

## Definition of Done

- Every hook has a unit test of its logic and an e2e spawn test including a
  junk-input case.
- A dry-run test proves no filesystem writes.
- `npm test` is green locally and in the CI matrix.

## Constraints

- No test frameworks, no assertion libraries — `node:test` and
  `node:assert/strict` only.
- Tests must not depend on a real Antigravity install or network.

## Rationalizations

- "Hooks are too small to test" → an untested hook that exits non-zero takes
  the whole session down; the e2e test is ten lines.
- "Dry-run obviously works, it's the same code path" → that's exactly why it
  breaks silently when someone adds a write outside the journal; keep the
  assertion.
- "I'll test on my machine's real config" → then uninstall bugs eat your own
  `mcp_config.json`; temp dirs are one `mkdtempSync` away.
