// Sidecars and never-loaded legacy directory checks (`sidecars/`, `workflows/`, `commands/`).
import { readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { readJsonc } from "../fsutil.mjs";
import { ALLOWED_SIDECAR_KEYS, VALID_RESTART_POLICIES } from "./constants.mjs";
import { isDir, isFile, readRegistryEntries, resolveInside } from "./helpers.mjs";

export function lintSidecars(dir, { ok, warn }) {
  const sidecarFiles = [];
  const scanSidecarsDir = (base) => {
    if (!isDir(base)) return;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const sub = join(base, entry.name);
      if (!isDir(sub)) continue;
      const cfg = join(sub, "sidecar.json");
      if (isFile(cfg)) {
        const checked = resolveInside(dir, relative(dir, cfg));
        if (!checked.ok) {
          warn("sidecar path escapes plugin root", `${relative(dir, cfg)} (${checked.reason})`);
        } else {
          sidecarFiles.push(cfg);
        }
      }
    }
  };
  scanSidecarsDir(join(dir, "sidecars"));
  for (const p of readRegistryEntries(dir, "sidecars.json", { ok, warn })) {
    if (isFile(p) && basename(p) === "sidecar.json") sidecarFiles.push(p);
    else if (isDir(p)) {
      const direct = join(p, "sidecar.json");
      if (isFile(direct)) sidecarFiles.push(direct);
      else scanSidecarsDir(p);
    }
  }
  if (sidecarFiles.length === 0) return;

  const bad = [];
  for (const file of sidecarFiles) {
    const rel = relative(dir, file);
    const parsed = readJsonc(file);
    if (!parsed?.ok || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
      bad.push(`${rel}: ${parsed?.error ?? "invalid JSON"}`);
      continue;
    }
    const sc = parsed.data;
    const hasCmd = typeof sc.command === "string" && sc.command.trim().length > 0;
    const hasBuiltin = typeof sc.builtin === "string" && sc.builtin.trim().length > 0;
    if (hasCmd && hasBuiltin) {
      bad.push(`${rel}: command and builtin are mutually exclusive`);
    } else if (!hasCmd && !hasBuiltin) {
      bad.push(`${rel}: must declare either command or builtin`);
    }
    const rp = sc.restart_policy ?? sc.restartPolicy;
    if (rp !== undefined && !VALID_RESTART_POLICIES.has(rp)) {
      warn(
        "sidecar invalid restart_policy",
        `${rel}: "${rp}" is not always | on-failure | never (falls back to always)`,
      );
    }
    for (const k of Object.keys(sc)) {
      if (!ALLOWED_SIDECAR_KEYS.has(k)) {
        warn(`sidecar unknown field "${k}"`, `${rel}: ignored by Antigravity`);
      }
    }
  }
  ok("sidecars valid", bad.length === 0, bad.join("; ") || `${sidecarFiles.length} sidecar(s)`);
}

export function lintLegacyDirs(dir, { warn }) {
  const wfDir = join(dir, "workflows");
  if (isDir(wfDir)) {
    const mdWorkflows = readdirSync(wfDir).filter((f) => f.endsWith(".md"));
    if (mdWorkflows.length > 0) {
      warn(
        "workflows/*.md never loaded in plugins",
        `plugins don't load Markdown workflows (${mdWorkflows.join(", ")}) — convert each to skills/<name>/SKILL.md`,
      );
    }
  }
  const cmdDir = join(dir, "commands");
  if (isDir(cmdDir)) {
    const files = readdirSync(cmdDir).filter((f) => f !== ".DS_Store");
    if (files.length > 0) {
      warn(
        "commands/ never loaded in plugins",
        "native plugins have no commands/ — move each to skills/<name>/SKILL.md",
      );
    }
  }
}
