import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkWalkthrough } from "../plugins/antigravity-meta-plugin-kit/scripts/walkthrough-guard.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins",
  "antigravity-meta-plugin-kit",
  "scripts",
  "walkthrough-guard.mjs",
);

function artifactDir({ plan = false, walkthrough = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "meta-kit-guard-"));
  if (plan) writeFileSync(join(dir, "implementation_plan.md"), "# plan\n");
  if (walkthrough) writeFileSync(join(dir, "walkthrough.md"), "# done\n");
  return dir;
}

const stopInput = (dir, extra = {}) => ({
  terminationReason: "model_stop",
  fullyIdle: true,
  artifactDirectoryPath: dir,
  ...extra,
});

test("nudges when a plan exists without a walkthrough", () => {
  const res = checkWalkthrough(stopInput(artifactDir({ plan: true })));
  assert.equal(res.decision, "continue");
  assert.match(res.reason, /walkthrough\.md/);
});

test("silent when the walkthrough exists", () => {
  const res = checkWalkthrough(
    stopInput(artifactDir({ plan: true, walkthrough: true })),
  );
  assert.equal(res.decision, "");
});

test("silent without a plan, on user stops, and while work is running", () => {
  assert.equal(checkWalkthrough(stopInput(artifactDir())).decision, "");
  assert.equal(
    checkWalkthrough(
      stopInput(artifactDir({ plan: true }), { terminationReason: "error" }),
    ).decision,
    "",
  );
  assert.equal(
    checkWalkthrough(
      stopInput(artifactDir({ plan: true }), { fullyIdle: false }),
    ).decision,
    "",
  );
  assert.equal(
    checkWalkthrough({ terminationReason: "model_stop" }).decision,
    "",
  );
});

test("e2e: fail-open — junk input allows the stop, plan case continues", () => {
  const run = (input) => {
    const res = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify(input),
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(res.status, 0, `must exit 0; stderr: ${res.stderr}`);
    return JSON.parse(res.stdout);
  };
  assert.equal(run({ totally: "unexpected" }).decision, "");
  const nudged = run(stopInput(artifactDir({ plan: true })));
  assert.equal(nudged.decision, "continue");
});
