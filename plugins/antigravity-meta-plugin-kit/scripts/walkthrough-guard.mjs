#!/usr/bin/env node
// Stop: if this session produced an implementation plan but no walkthrough,
// nudge to write walkthrough.md before stopping (the artifact discipline
// from rules/artifacts.md). Silent in every ambiguous case, and the nudge
// clears itself as soon as walkthrough.md exists — no continue-loops.

import { existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runHook } from "./lib/io.mjs";

const STOP_SILENT = { decision: "" };
const PLAN_RE = /^implementation[_-]?plan.*\.md$/i;
const WALKTHROUGH_RE = /^walkthrough.*\.md$/i;

export function checkWalkthrough(input) {
  // Only gate the model's own idle stop — never user-initiated ones.
  if (input?.terminationReason !== "model_stop") return STOP_SILENT;
  if (input?.fullyIdle === false) return STOP_SILENT;
  const dir =
    typeof input?.artifactDirectoryPath === "string"
      ? input.artifactDirectoryPath
      : "";
  if (!dir || !existsSync(dir)) return STOP_SILENT;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return STOP_SILENT;
  }
  const hasPlan = entries.some((f) => PLAN_RE.test(f));
  const hasWalkthrough = entries.some((f) => WALKTHROUGH_RE.test(f));
  if (!hasPlan || hasWalkthrough) return STOP_SILENT;
  return {
    decision: "continue",
    reason:
      "[antigravity-meta-plugin-kit] An implementation plan exists in the artifact " +
      "directory but no walkthrough.md. Create or update walkthrough.md (changes " +
      "made, what was tested, validation results) before stopping.",
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  runHook((input) => checkWalkthrough(input), STOP_SILENT);
