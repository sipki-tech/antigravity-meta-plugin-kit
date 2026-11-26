import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ALLOW,
  SILENT,
  STOP_ALLOW,
  askResponse,
  commandLineOf,
  continueStopResponse,
  cwdOf,
  denyResponse,
  editedFileOf,
  errorTerminateResponse,
  forceAskResponse,
  forceContinueResponse,
  hookEventNameOf,
  injectResponse,
  isMainModule,
  isStopContinuation,
  overwriteResponse,
  promptTextOf,
  safeSerialize,
  systemMessageResponse,
  toolCallIdOf,
  transcriptPathOf,
} from "../plugins/antigravity-meta-plugin-kit/scripts/templates/plugin/plugins/__name__/scripts/lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("single canonical io.mjs lives in scaffold template (no duplicate in kit scripts/lib)", () => {
  assert.equal(
    existsSync(join(ROOT, "plugins/antigravity-meta-plugin-kit/scripts/lib/io.mjs")),
    false,
    "unused duplicate scripts/lib/io.mjs should not exist",
  );
  assert.equal(
    existsSync(
      join(
        ROOT,
        "plugins/antigravity-meta-plugin-kit/scripts/templates/plugin/plugins/__name__/scripts/lib/io.mjs",
      ),
    ),
    true,
    "canonical template io.mjs must exist",
  );
});

test("response builders emit clean official agy 1.5.17 contracts (no legacy allow_tool)", () => {
  assert.deepEqual(ALLOW, { decision: "allow" });
  assert.deepEqual(SILENT, {});
  assert.deepEqual(STOP_ALLOW, { decision: "" });
  assert.deepEqual(denyResponse("nope"), { decision: "deny", reason: "nope" });
  assert.deepEqual(askResponse("confirm?", ["command(npm test)"]), {
    decision: "ask",
    reason: "confirm?",
    permissionOverrides: ["command(npm test)"],
  });
  assert.deepEqual(forceAskResponse("always confirm"), {
    decision: "force_ask",
    reason: "always confirm",
  });
  assert.deepEqual(overwriteResponse({ CommandLine: "ls" }), {
    decision: "allow",
    overwrite: { CommandLine: "ls" },
  });
  assert.deepEqual(systemMessageResponse("hi", { userMarkdown: "**hi**" }), {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: "hi",
          metadata: { user_markdown: "**hi**" },
        },
      },
    ],
  });
  assert.deepEqual(injectResponse("hello"), { injectSteps: [{ userMessage: "hello" }] });
  assert.deepEqual(errorTerminateResponse("blocked"), {
    injectSteps: [{ errorMessage: { userMessage: "blocked" } }],
    terminationBehavior: "terminate",
  });
  assert.deepEqual(forceContinueResponse(), {
    injectSteps: [],
    terminationBehavior: "force_continue",
  });
  assert.deepEqual(continueStopResponse("keep going"), {
    decision: "continue",
    reason: "keep going",
  });
});

test("isStopContinuation checks BOTH continuationActive and executionNum > 0", () => {
  assert.equal(isStopContinuation({ continuationActive: false, executionNum: 0 }), false);
  assert.equal(isStopContinuation({ continuationActive: true, executionNum: 0 }), true);
  assert.equal(isStopContinuation({ continuationActive: false, executionNum: 1 }), true);
  assert.equal(isStopContinuation({}), false);
});

test("input adapters prioritize agy 1.5.17 camelCase fields", () => {
  assert.equal(hookEventNameOf({ hookEventName: "PreToolUse" }), "PreToolUse");
  assert.equal(toolCallIdOf({ toolCall: { id: "call_123" } }), "call_123");
  assert.equal(
    commandLineOf({ toolCall: { args: { CommandLine: "npm test" } } }),
    "npm test",
  );
  assert.equal(
    promptTextOf({ lastUserInput: "newest", prompt: "fallback" }),
    "newest",
  );
  assert.equal(
    cwdOf({ cwd: "/agent/cwd", workspacePaths: ["/ws/0"] }),
    "/agent/cwd",
  );
  assert.equal(cwdOf({ workspacePaths: ["/ws/0"] }), "/ws/0");
  assert.equal(
    editedFileOf({ toolCall: { args: { Path: "/a/b.mjs" } } }),
    "/a/b.mjs",
  );
  assert.equal(
    transcriptPathOf({ transcriptPath: "/tmp/t.jsonl" }),
    "/tmp/t.jsonl",
  );
});

test("isMainModule handles direct paths and symlinks; safeSerialize & runHook stay fail-open on circular objects", () => {
  const dir = mkdtempSync(join(tmpdir(), "meta-kit-io-"));
  try {
    const ioPath = join(
      ROOT,
      "plugins/antigravity-meta-plugin-kit/scripts/templates/plugin/plugins/__name__/scripts/lib/io.mjs",
    );
    const script = join(dir, "hook.mjs");
    const link = join(dir, "hook-link.mjs");
    writeFileSync(
      script,
      `import { ALLOW, isMainModule, runHook } from ${JSON.stringify(pathToFileURL(ioPath).href)};
if (isMainModule(import.meta.url)) {
  runHook((input) => {
    if (input?.mode === "circular") {
      const a = {};
      a.self = a;
      return a;
    }
    if (input?.mode === "throw") throw new Error("boom");
    return { decision: "deny", reason: "ok-via-link" };
  }, ALLOW);
}
`,
    );
    symlinkSync(script, link);

    // Circular serialization falls back cleanly
    const circ = {};
    circ.self = circ;
    assert.equal(safeSerialize(circ, ALLOW), JSON.stringify(ALLOW));

    // Invoking through symlink executes the hook (never exits with empty stdout!)
    const viaLink = spawnSync(process.execPath, [link], {
      input: JSON.stringify({ mode: "normal" }),
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(viaLink.status, 0, viaLink.stderr);
    assert.deepEqual(JSON.parse(viaLink.stdout), { decision: "deny", reason: "ok-via-link" });

    // Circular return value stays fail-open with exit 0 + ALLOW
    const viaCircular = spawnSync(process.execPath, [link], {
      input: JSON.stringify({ mode: "circular" }),
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(viaCircular.status, 0, viaCircular.stderr);
    assert.deepEqual(JSON.parse(viaCircular.stdout), ALLOW);

    // Throwing handler stays fail-open with exit 0 + ALLOW
    const viaThrow = spawnSync(process.execPath, [link], {
      input: JSON.stringify({ mode: "throw" }),
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(viaThrow.status, 0, viaThrow.stderr);
    assert.deepEqual(JSON.parse(viaThrow.stdout), ALLOW);

    assert.equal(isMainModule("file:///nope", join(dir, "missing.mjs")), false);
    assert.equal(isMainModule("file:///nope", undefined), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
