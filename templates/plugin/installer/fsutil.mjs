import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

// Every mutation goes through the journal so --dry-run can print the exact
// plan without touching the filesystem.
export function createJournal(dryRun) {
  const actions = [];
  return {
    actions,
    dryRun,
    record(type, target, apply) {
      actions.push({ type, target });
      if (!dryRun) apply();
    },
  };
}

export function copyDir(journal, from, to) {
  journal.record("copy", `${from} -> ${to}`, () => {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  });
}

export function removeDir(journal, target) {
  if (!existsSync(target)) return;
  journal.record("remove", target, () => {
    rmSync(target, { recursive: true, force: true });
  });
}

export function readJson(file, fallback = null) {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(journal, file, data) {
  journal.record("write", file, () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  });
}
