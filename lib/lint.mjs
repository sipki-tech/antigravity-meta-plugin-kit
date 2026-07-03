// Lints an Antigravity plugin payload against the loader traps observed on
// the Antigravity preview (2026-07). Every rule is calibrated against the
// reference payload (antigravity-kit) — the dogfood test keeps it that way.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { readJson } from "./fsutil.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";

export const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
export const MAX_HOOK_TIMEOUT = 30;
// Commands resolvable without a separately installed binary.
const BUILTIN_MCP_COMMANDS = new Set(["node", "npx"]);

// Trigger heuristic: a quoted wake phrase, or an explicit "use when/for/
// always/this" routing clause. Calibrated on the reference skill corpus
// (kit-seq-thinking and kit-token-hygiene have no quotes but say "Use for" /
// "Use always").
export function hasTrigger(description) {
  const d = String(description ?? "");
  return /"[^"]+"/.test(d) || /\buse\s+(when|for|always|this)\b/i.test(d);
}

// Extracts the ${PLUGIN_ROOT}-relative path from a hook command line.
// Returns null when the command doesn't reference the plugin root (nothing
// we can verify then).
export function scriptPathOf(command) {
  const m = /\$\{PLUGIN_ROOT\}\/([^"'\s]+)/.exec(String(command ?? ""));
  return m ? m[1] : null;
}

// Heuristic (documented in README): a hook script counts as fail-open when it
// routes through a runHook-style wrapper or wraps its body in try/catch.
export function isFailOpen(source) {
  return source.includes("runHook(") || /try\s*\{[\s\S]*\}\s*catch/.test(source);
}

// hooks.json mixes two shapes: bare command-hook arrays (PreInvocation, Stop)
// and {matcher, hooks: [...]} groups (PreToolUse, PostToolUse). Flatten both
// into leaves so checks apply uniformly.
export function flattenHooks(hooksDoc, pluginName) {
  const leaves = [];
  const problems = [];
  const ns = hooksDoc?.[pluginName];
  if (!ns || typeof ns !== "object") {
    return { leaves, problems: [`missing '${pluginName}' namespace`] };
  }
  for (const [event, entries] of Object.entries(ns)) {
    if (!Array.isArray(entries)) {
      problems.push(`${event}: expected an array`);
      continue;
    }
    for (const entry of entries) {
      if (Array.isArray(entry?.hooks)) {
        for (const hook of entry.hooks) {
          leaves.push({ event, matcher: entry.matcher ?? null, hook });
        }
      } else {
        leaves.push({ event, matcher: null, hook: entry });
      }
    }
  }
  return { leaves, problems };
}

// Accepts either a payload dir (contains plugin.json) or a scaffolded repo
// root (contains plugins/<name>/plugin.json).
export function resolvePayloadDir(dir) {
  if (existsSync(join(dir, "plugin.json"))) {
    return { payloadDir: dir, repoRoot: null };
  }
  const named = join(dir, "plugins", basename(dir));
  if (existsSync(join(named, "plugin.json"))) {
    return { payloadDir: named, repoRoot: dir };
  }
  const pluginsDir = join(dir, "plugins");
  if (existsSync(pluginsDir)) {
    const candidates = readdirSync(pluginsDir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() && existsSync(join(pluginsDir, e.name, "plugin.json")),
      )
      .map((e) => e.name);
    if (candidates.length === 1) {
      return { payloadDir: join(pluginsDir, candidates[0]), repoRoot: dir };
    }
  }
  throw new Error(
    `no plugin.json found in ${dir} (looked in the directory itself and in ` +
      "plugins/<name>/). Point lint at a plugin payload or a scaffolded repo root.",
  );
}

export function lintTarget(dir) {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) throw new Error(`${resolved} does not exist`);
  const { payloadDir, repoRoot } = resolvePayloadDir(resolved);
  return { payloadDir, repoRoot, ...lintPlugin(payloadDir, { repoRoot }) };
}

export function lintPlugin(pluginDir, { repoRoot = null } = {}) {
  const dir = resolve(pluginDir);
  const checks = [];
  const warnings = [];
  const notes = [];
  const ok = (name, pass, note = "") => checks.push({ name, pass, note });
  const warn = (name, note = "") => warnings.push({ name, note });
  const info = (name, note = "") => notes.push({ name, note });
  const done = () => ({
    checks,
    warnings,
    notes,
    pass: checks.every((c) => c.pass),
  });

  const manifestFile = join(dir, "plugin.json");
  ok("plugin.json exists", existsSync(manifestFile), manifestFile);
  const manifest = readJson(manifestFile);
  ok("plugin.json parses", manifest !== null);
  if (manifest === null) return done();

  ok(
    "name matches directory",
    manifest.name === basename(dir),
    `name=${manifest.name} dir=${basename(dir)}`,
  );
  ok(
    "author is an object",
    typeof manifest.author === "object" &&
      manifest.author !== null &&
      !Array.isArray(manifest.author),
    'a bare string can trip plugin validation — use {"name": "..."}',
  );
  ok("version is semver", SEMVER_RE.test(manifest.version ?? ""), `version=${manifest.version}`);
  ok(
    "interface declared",
    typeof manifest.interface === "object" &&
      Boolean(manifest.interface?.displayName) &&
      Boolean(manifest.interface?.shortDescription),
    "interface{displayName, shortDescription} is what the plugin manager shows",
  );

  const declared = ["skills", "rules", "hooks"]
    .filter((key) => typeof manifest[key] === "string")
    .map((key) => [key, join(dir, manifest[key])]);
  const missingPaths = declared.filter(([, p]) => !existsSync(p));
  ok(
    "declared paths exist",
    missingPaths.length === 0,
    missingPaths.map(([k, p]) => `${k}: ${p}`).join(", ") ||
      declared.map(([k]) => k).join(", "),
  );

  lintSkills(dir, manifest, { ok, warn });
  lintHooks(dir, manifest, { ok, warn });
  lintMcp(dir, { ok });
  lintWorkflows(dir, { ok });

  if (typeof manifest.rules === "string") {
    const rulesDir = join(dir, manifest.rules);
    const mds = existsSync(rulesDir)
      ? readdirSync(rulesDir).filter((f) => f.endsWith(".md"))
      : [];
    ok("rules non-empty", mds.length > 0, `${mds.length} rule files`);
  }

  // The installed_version.json trap: the Antigravity plugin manager writes it
  // on install and the loader silently ignores a plugin dir without it.
  if (existsSync(join(dir, "installed_version.json"))) {
    warn(
      "installed_version.json committed in payload",
      "the installer writes it at install time; remove it from the payload",
    );
  }
  if (repoRoot) {
    if (!installerWritesInstalledVersion(repoRoot)) {
      warn(
        "installer never writes installed_version.json",
        "the loader silently ignores a plugin dir without it (observed 2026-07)",
      );
    }
  } else {
    info(
      "installed_version.json",
      'the loader silently ignores a plugin dir without installed_version.json — an installer must write {"version": ...} into the installed copy (observed 2026-07, preview)',
    );
  }

  return done();
}

function lintSkills(dir, manifest, { ok, warn }) {
  const skillsDir =
    typeof manifest.skills === "string" ? join(dir, manifest.skills) : join(dir, "skills");
  if (!existsSync(skillsDir)) return;
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const loose = entries
    .filter((e) => !e.isDirectory() && e.name !== ".DS_Store")
    .map((e) => e.name);
  if (loose.length > 0) warn("loose files in skills/", loose.join(", "));

  const noSkillMd = skillDirs.filter(
    (s) => !existsSync(join(skillsDir, s, "SKILL.md")),
  );
  ok(
    "every skill has SKILL.md",
    noSkillMd.length === 0,
    noSkillMd.join(", ") || `${skillDirs.length} skills`,
  );

  const badFrontmatter = [];
  const noTrigger = [];
  for (const s of skillDirs) {
    const file = join(skillsDir, s, "SKILL.md");
    if (!existsSync(file)) continue;
    const { data } = parseFrontmatter(readFileSync(file, "utf8"));
    if (!data || !data.name || !data.description) {
      badFrontmatter.push(s);
      continue;
    }
    if (data.name !== s) badFrontmatter.push(`${s} (name=${data.name})`);
    if (!hasTrigger(data.description)) noTrigger.push(s);
  }
  ok(
    "skill frontmatter valid",
    badFrontmatter.length === 0,
    badFrontmatter.join(", ") || "name + description present, name matches dir",
  );
  ok(
    "skill descriptions carry a trigger",
    noTrigger.length === 0,
    noTrigger.join(", ") ||
      'heuristic: a quoted phrase or "use when/for/always/this"',
  );
}

function lintHooks(dir, manifest, { ok, warn }) {
  const hooksFile =
    typeof manifest.hooks === "string"
      ? join(dir, manifest.hooks)
      : join(dir, "hooks", "hooks.json");
  if (!existsSync(hooksFile)) return;
  const hooksDoc = readJson(hooksFile);
  ok("hooks.json parses", hooksDoc !== null, hooksFile);
  if (hooksDoc === null) return;

  ok(
    "hooks.json namespaced by plugin name",
    Boolean(hooksDoc[manifest.name]),
    `top-level key must be "${manifest.name}"`,
  );
  const { leaves, problems } = flattenHooks(hooksDoc, manifest.name);
  ok(
    "hook entries well-formed",
    problems.length === 0 &&
      leaves.length > 0 &&
      leaves.every(
        (l) => l.hook?.type === "command" && typeof l.hook?.command === "string",
      ),
    problems.join("; ") || `${leaves.length} hooks`,
  );

  const badTimeouts = leaves.filter(
    (l) =>
      typeof l.hook?.timeout !== "number" ||
      l.hook.timeout <= 0 ||
      l.hook.timeout > MAX_HOOK_TIMEOUT,
  );
  ok(
    `hook timeouts present and <=${MAX_HOOK_TIMEOUT}s`,
    badTimeouts.length === 0,
    badTimeouts.map((l) => `${l.event}: timeout=${l.hook?.timeout}`).join(", ") ||
      "10-15s is the observed sweet spot",
  );

  const missingScripts = [];
  const notFailOpen = [];
  for (const l of leaves) {
    const rel = scriptPathOf(l.hook?.command);
    if (!l.hook?.statusMessage) {
      warn("hook missing statusMessage", `${l.event}: ${rel ?? l.hook?.command}`);
    }
    if (!rel) continue; // command doesn't reference ${PLUGIN_ROOT}; nothing to verify
    const scriptFile = join(dir, rel);
    if (!existsSync(scriptFile)) {
      missingScripts.push(rel);
      continue;
    }
    if (rel.endsWith(".mjs") && !isFailOpen(readFileSync(scriptFile, "utf8"))) {
      notFailOpen.push(rel);
    }
  }
  ok(
    "hook scripts exist",
    missingScripts.length === 0,
    missingScripts.join(", ") || "all ${PLUGIN_ROOT} script refs resolve",
  );
  ok(
    "hook scripts fail-open",
    notFailOpen.length === 0,
    notFailOpen.join(", ") || "heuristic: runHook() wrapper or try/catch",
  );
}

function lintMcp(dir, { ok }) {
  const mcpFile = join(dir, "mcp_config.json");
  if (!existsSync(mcpFile)) return;
  const mcp = readJson(mcpFile);
  ok("mcp_config.json parses", mcp !== null, mcpFile);
  if (!mcp?.mcpServers) return;
  const risky = Object.entries(mcp.mcpServers)
    .filter(
      ([, def]) =>
        def &&
        typeof def.command === "string" &&
        !BUILTIN_MCP_COMMANDS.has(def.command) &&
        def.disabled !== true,
    )
    .map(([name]) => name);
  ok(
    "mcp: non-builtin commands ship disabled",
    risky.length === 0,
    risky.join(", ") || "a missing binary must not break sessions",
  );
}

function lintWorkflows(dir, { ok }) {
  const workflowsDir = join(dir, "workflows");
  if (!existsSync(workflowsDir)) return;
  const bad = readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => {
      const { data } = parseFrontmatter(readFileSync(join(workflowsDir, f), "utf8"));
      return !data?.description;
    });
  ok(
    "workflows have description frontmatter",
    bad.length === 0,
    bad.join(", ") || "description is what turns a workflow into a /slash-command",
  );
}

function installerWritesInstalledVersion(repoRoot) {
  for (const sub of ["installer", "bin"]) {
    const d = join(repoRoot, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!f.endsWith(".mjs")) continue;
      if (readFileSync(join(d, f), "utf8").includes("installed_version.json")) {
        return true;
      }
    }
  }
  return false;
}
