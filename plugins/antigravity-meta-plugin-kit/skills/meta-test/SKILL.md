---
name: meta-test
description: >-
  Test Google Antigravity plugins with zero dependencies (node:test), hook e2e
  wire tests, agy plugin validate --strict --json, and live agy -p smoke tests.
  Use when the user says "meta-test" or writes tests for a plugin's hooks,
  scripts, or payload. Don't use for shipping or publishing releases.
---

# meta-test — zero-dependency testing doctrine for Antigravity plugins

## Goal

Cover a plugin with fast `node --test` suites (zero external dependencies) that
prove pure logic, stdin/stdout wire contracts, structural compliance with
`agy plugin validate --strict --json`, and fail-open behavior on bad input.

## Instructions

1. **Keep logic importable:** export pure decision functions from `.mjs` files
   and guard executable entrypoints with `isMainModule(import.meta.url)` from
   `./lib/io.mjs` (or `import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href`)
   so scripts work reliably via symlinks and macOS `/tmp` -> `/private/tmp`.
2. **Hook e2e wire tests:** spawn the real script with `spawnSync`:
   ```js
   const res = spawnSync(process.execPath, [script], {
     input: rawStdin,
     encoding: "utf8",
     timeout: 10000,
   });
   assert.equal(res.status, 0); // ALWAYS — even on junk/invalid/empty stdin
   const out = JSON.parse(res.stdout);
   ```
   Test at minimum:
   - real `agy 1.5.17` payload (camelCase `toolCall`, `lastUserInput`, `cwd`,
     or for `Stop`: `terminationReason: "NO_TOOL_CALL"`, `fullyIdle: true`,
     AND `executionNum: 1` / `continuationActive: true` loop-stop case);
   - unexpected JSON (`{"totally": "unexpected"}`);
   - malformed non-JSON (`"not json"`);
   - empty stdin (`""`).
3. **Temp roots for tools:** test any `scripts/` CLI against
   `mkdtempSync(join(tmpdir(), "x-"))` (clean up in `finally`/`after()`);
   assert `--dry-run` plans actions and writes zero files. When spawning a
   nested `node --test`, delete `NODE_TEST_CONTEXT` and `NODE_OPTIONS` from
   child `env` and assert `# pass [1-9]` in stdout.
4. **Structural validation gate:** integrate `agy plugin validate --strict
   --json <payload>` (skipping cleanly when `agy --version` is unavailable in
   CI) and assert `status === 0`, `findings.length === 0`, and exact
   `components.{skills,agents,rules,hooks,mcpServers,sidecars}` counts.
5. **Run all local verification gates:**
   ```bash
   npm test
   node "$KIT/scripts/meta-kit.mjs" lint --strict .
   node "$KIT/scripts/meta-kit.mjs" doctor --workspace .
   agy plugin validate --strict --json plugins/<name>
   ```

## Definition of Done

- Every hook has unit tests + e2e spawn tests covering real, junk, malformed,
  and empty stdin.
- `agy plugin validate --strict --json` integration test asserts `findings: []`
  and exact component counts when `agy` is on PATH.
- `npm test` uses a glob (`"node --test test/*.test.mjs"`, not a directory arg)
  and is green on Node 20/22.

## Constraints

- `node:test` and `node:assert/strict` only — zero test dependencies.
- Never write to real `~/.gemini/` from automated tests.

## Rationalizations

- "I unit-tested the helper, e2e spawn is redundant" -> unit tests miss
  stdout pollution, broken imports, and stdin handling; the e2e test is 10 lines.
- "`agy plugin validate` passes without `--strict`, good enough" -> warnings
  indicate silently ignored fields or Marketplace rejections; always gate on
  `--strict --json`.
