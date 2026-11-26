// Facade for Google Antigravity plugin & marketplace linting (agy 1.5.17+).
// Composes focused component modules under ./lint/ while keeping 100% of
// public exports backward-compatible.
import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { readJsonc } from "./fsutil.mjs";
import { COMPONENT_NAMES } from "./lint/constants.mjs";
import { isDir, isFile } from "./lint/helpers.mjs";
import { findManifest, lintManifest } from "./lint/manifest.mjs";
import { lintSkills } from "./lint/skills.mjs";
import { lintRules } from "./lint/rules.mjs";
import { lintAgents } from "./lint/agents.mjs";
import { lintHooks } from "./lint/hooks.mjs";
import { lintMcp } from "./lint/mcp.mjs";
import { lintLegacyDirs, lintSidecars } from "./lint/sidecars.mjs";
import { lintAuth } from "./lint/auth.mjs";
import { lintMarketplace } from "./lint/marketplace.mjs";

export {
  ALLOWED_LOGO_EXTS,
  ALLOWED_MANIFEST_KEYS,
  ALLOWED_SIDECAR_KEYS,
  KEBAB_RE,
  KNOWN_EVENTS,
  LEGACY_AGENT_TOOL_ALIASES,
  MAX_BODY_BYTES,
  MAX_HOOK_TIMEOUT,
  NATIVE_AGENT_TOOLS,
  RESERVED_AGENT_NAMES,
  SEMVER_RE,
  SHA256_RE,
  VALID_AUTH_DELIVERIES,
  VALID_AUTH_TYPES,
  VALID_EXEC_POLICIES,
  VALID_MODEL_TIERS,
  VALID_RESTART_POLICIES,
  VALID_RULE_TRIGGERS,
  WARN_ALWAYS_ON_LINES,
  WARN_BODY_BYTES,
} from "./lint/constants.mjs";

export {
  hasTrigger,
  isFailOpen,
  scriptPathOf,
  usesPluginRoot,
} from "./lint/helpers.mjs";

export { findManifest } from "./lint/manifest.mjs";
export { flattenHooks } from "./lint/hooks.mjs";
export { lintAuth } from "./lint/auth.mjs";
export { lintMarketplace } from "./lint/marketplace.mjs";

// Accepts a payload dir, a direct plugin.json path, or a repo root containing
// plugins/<name>/.
export function resolvePayloadDir(dir) {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) throw new Error(`${resolved} does not exist`);

  if (isFile(resolved) && basename(resolved).toLowerCase() === "plugin.json") {
    const parent = resolve(resolved, "..");
    const parentName = basename(parent);
    if (parentName === ".antigravity-plugin" || parentName === ".gemini-plugin") {
      return { payloadDir: resolve(parent, ".."), repoRoot: null };
    }
    return { payloadDir: parent, repoRoot: null };
  }

  if (findManifest(resolved)) {
    return { payloadDir: resolved, repoRoot: null };
  }

  const named = join(resolved, "plugins", basename(resolved));
  if (isDir(named) && findManifest(named)) {
    return { payloadDir: named, repoRoot: resolved };
  }

  const pluginsDir = join(resolved, "plugins");
  if (isDir(pluginsDir)) {
    const candidates = readdirSync(pluginsDir, { withFileTypes: true })
      .filter((e) => isDir(join(pluginsDir, e.name)) && Boolean(findManifest(join(pluginsDir, e.name))))
      .map((e) => e.name);
    if (candidates.length === 1) {
      return { payloadDir: join(pluginsDir, candidates[0]), repoRoot: resolved };
    }
    if (candidates.length > 1) {
      throw new Error(
        `multiple plugins found under ${pluginsDir} (${candidates.join(", ")}) — pass --all or point at a specific plugin directory.`,
      );
    }
  }

  throw new Error(
    `no plugin.json found in ${resolved} (checked plugin root, .antigravity-plugin/, .gemini-plugin/, and plugins/<name>/).`,
  );
}

export function resolveAllPayloads(dir) {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) throw new Error(`${resolved} does not exist`);
  const pluginsDir = join(resolved, "plugins");
  if (isDir(pluginsDir)) {
    const candidates = readdirSync(pluginsDir, { withFileTypes: true })
      .filter((e) => isDir(join(pluginsDir, e.name)) && Boolean(findManifest(join(pluginsDir, e.name))))
      .map((e) => join(pluginsDir, e.name))
      .sort();
    if (candidates.length > 0) return candidates;
  }
  return [resolvePayloadDir(resolved).payloadDir];
}

export function lintTarget(targetPath) {
  const resolved = resolve(targetPath);
  if (isFile(resolved) && basename(resolved).toLowerCase() === "marketplace.json") {
    return lintMarketplace(resolved);
  }
  const { payloadDir } = resolvePayloadDir(targetPath);
  return { payloadDir, kind: "plugin", ...lintPlugin(payloadDir) };
}

export function lintPlugin(pluginDir) {
  const dir = resolve(pluginDir);
  const checks = [];
  const warnings = [];
  const notes = [];
  const ok = (name, pass, note = "") => checks.push({ name, pass, note });
  const warn = (name, note = "") => warnings.push({ name, note });
  const info = (name, note = "") => notes.push({ name, note });
  const done = () => {
    const pass = checks.every((c) => c.pass);
    return {
      checks,
      warnings,
      notes,
      pass,
      strictPass: pass && warnings.length === 0,
    };
  };

  const found = findManifest(dir);
  ok("plugin.json exists", Boolean(found), found ? found.manifestFile : join(dir, "plugin.json"));
  if (!found) return done();

  for (const s of found.shadowed) {
    warn(
      "shadowed plugin.json",
      `${s.relManifest} is ignored because ${found.relManifest} takes precedence`,
    );
  }
  if (found.manifestDir !== dir) {
    for (const comp of COMPONENT_NAMES) {
      if (existsSync(join(found.manifestDir, comp))) {
        warn(
          "component inside manifest subfolder",
          `${relative(dir, join(found.manifestDir, comp))} is never loaded — move ${comp} to the plugin root`,
        );
      }
    }
  }

  const parsed = readJsonc(found.manifestFile);
  const validManifestObj =
    Boolean(parsed?.ok) && Boolean(parsed.data) && typeof parsed.data === "object" && !Array.isArray(parsed.data);
  ok(
    "plugin.json parses",
    validManifestObj,
    validManifestObj ? "" : parsed?.error ?? "manifest must be a JSON object",
  );
  if (!validManifestObj) return done();
  if (!parsed.strictOk && parsed.hasJsoncSyntax) {
    warn(
      "plugin.json uses JSONC syntax",
      "`agy plugin install` requires strict JSON (no comments or trailing commas)",
    );
  }

  const manifest = parsed.data;
  lintManifest(dir, manifest, { ok, warn, info });
  lintSkills(dir, manifest, { ok, warn });
  lintRules(dir, { ok, warn });
  lintAgents(dir, { ok, warn });
  lintHooks(dir, { ok, warn, info });
  lintMcp(dir, { ok, warn });
  lintAuth(dir, { ok, warn });
  lintSidecars(dir, { ok, warn });
  lintLegacyDirs(dir, { warn });

  if (existsSync(join(dir, "installed_version.json"))) {
    warn(
      "installed_version.json committed in payload",
      "legacy install-time artifact — remove it from the payload",
    );
  }

  return done();
}
