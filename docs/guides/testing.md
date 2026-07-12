# Testing: the zero-dependency node --test doctrine

*English | [Русский](testing.ru.md)*

Plugins run inside other people's sessions — an untested hook that exits
non-zero takes a session down. The doctrine: **logic importable, wrappers
thin, wire contracts spawned**, zero test frameworks (`node:test` +
`node:assert/strict` only).

## Structure for testability

Keep behavior in exported functions; the executable entry is a guarded
one-liner:

```js
export function checkCommand(cmd) { /* pure logic */ }

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  runHook((input) => checkCommand(commandLineOf(input)));
```

Unit tests then import `checkCommand` directly — no process spawning, sub-ms
tests.

## Hook e2e — test the wire, not just the logic

```js
const res = spawnSync(process.execPath, [script], {
  input: JSON.stringify(input),
  encoding: "utf8",
  timeout: 10000,
});
assert.equal(res.status, 0);          // ALWAYS — even on junk input
const out = JSON.parse(res.stdout);
assert.equal(out.decision, "allow");  // official key
assert.equal(out.allow_tool, true);   // legacy key, while the template ships both
```

Feed three inputs at minimum: the real event shape, junk
(`{"totally": "unexpected"}`), and empty stdin. A fail-open hook answers
allow/silent with exit 0 to all of them.

## Script/tool tests — temp roots, never your real home

A native-only payload has no installer to test; the install itself is the
Antigravity CLI's job (`agy plugin install`). What you *do* test is any
bundled `scripts/` tool, always against a throwaway root:

```js
const home = mkdtempSync(join(tmpdir(), "my-plugin-test-"));
runTool({ home });                    // or { workspace: dir }
```

For any tool that supports `--dry-run` (e.g. a scaffolder), assert the
journal contract explicitly:

```js
const { actions } = runTool({ home, dryRun: true });
assert.ok(actions.length > 0);                      // the plan exists
assert.equal(existsSync(join(home, ".gemini")), false);  // nothing written
```

If your tool merges MCP config, assert the contract: pre-seed a user server,
run merge then prune, and confirm the user's entry survived byte-identical.

## Tool e2e

`spawnSync(process.execPath, [tool, ...args], { cwd })`; assert exit code,
stdout patterns, and that user errors print a friendly message without a
stack trace.

## Traps we hit so you don't

- **`node --test <dir>` breaks on Node 22** (Node 20 scans the directory;
  22 rejects it). Use a glob in package.json:
  `"test": "node --test test/*.test.mjs"`.
- **A spawned `node --test` inherits `NODE_TEST_CONTEXT`** when the parent
  is itself a test — the child reports success without running anything.
  When your test spawns another test runner, clean the env and assert
  `# pass [1-9]` in the output.
- With `pipefail` in CI, `cmd | grep -q x` can mask or surface pipe errors —
  prefer asserting in the test suite over shell pipelines.

## Integration with the official validator

Gate on `agy plugin validate` where the CLI exists, skip elsewhere:

```js
const AGY = spawnSync("which", ["agy"], { encoding: "utf8" });
test("agy validate", (t) => {
  if (AGY.status !== 0) return t.skip("agy not on PATH");
  // spawn agy plugin validate, strip ANSI, assert "hooks : N processed"
});
```

## Checklist

- [ ] every hook: unit test of logic + e2e with real/junk/empty stdin
- [ ] dry-run test proves zero filesystem writes
- [ ] MCP merge/prune covered with a pre-seeded user server
- [ ] `"test": "node --test test/*.test.mjs"` (glob, not directory)
- [ ] CI matrix runs it on ubuntu+macos × Node 20/22

*See also: [Hooks](hooks.md) · [Shipping](shipping.md)*
