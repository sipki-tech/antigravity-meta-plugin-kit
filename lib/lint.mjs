// Lints an Antigravity plugin payload against docs/internals.md — official
// contracts from the in-CLI docs (2026-07, CLI 1.0.16) plus the traps observed
// on the preview. Every rule is calibrated against the reference payload
// (antigravity-kit) — the dogfood test keeps it that way.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { readJson } from "./fsutil.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";

export const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
// Official default is 30s of synchronous blocking; anything above is a smell.
export const MAX_HOOK_TIMEOUT = 30;
// Commands resolvable without a separately installed binary.
const BUILTIN_MCP_COMMANDS = new Set(["node", "npx"]);

// The five events that exist (SessionStart is a refuted rumor — see
// docs/internals.md).
export const KNOWN_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PreInvocation",
  "PostInvocation",
  "Stop",
];
const GROUPED_EVENTS = new Set(["PreToolUse", "PostToolUse"]);
const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Trigger heuristic: a quoted wake phrase, or an explicit "use when/for/
// always/this" routing clause. Calibrated on the reference skill corpus.
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

// hooks.json: top-level keys are hook NAMES (any string; plugin-name is just
// this kit's convention). Each named hook maps events to either matcher
// groups (PreToolUse/PostToolUse) or flat handler lists (the rest), plus an
// optional `enabled` flag. Flatten every handler into leaves so checks apply
// uniformly; collect structural problems and shape warnings on the way.
export function flattenHooks(hooksDoc) {
  const leaves = [];
  const problems = [];
  const shapeWarnings = [];
  const unknownEvents = [];
  let namedHooks = 0;
  if (!hooksDoc || typeof hooksDoc !== "object" || Array.isArray(hooksDoc)) {
    return {
      leaves,
      problems: ["hooks.json must be an object of named hooks"],
      shapeWarnings,
      unknownEvents,
      namedHooks,
    };
  }
  for (const [hookName, spec] of Object.entries(hooksDoc)) {
    if (KNOWN_EVENTS.includes(hookName)) {
      problems.push(
        `top-level key '${hookName}' is an event name — top-level keys must be ` +
          "hook names (Claude Code-style settings.json ported verbatim?)",
      );
      continue;
    }
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      problems.push(`hook '${hookName}': expected an object of events`);
      continue;
    }
    namedHooks += 1;
    for (const [event, entries] of Object.entries(spec)) {
      if (event === "enabled") continue;
      if (!KNOWN_EVENTS.includes(event)) {
        unknownEvents.push(`${hookName}.${event}`);
        continue;
      }
      if (!Array.isArray(entries)) {
        problems.push(`${hookName}.${event}: expected an array`);
        continue;
      }
      for (const entry of entries) {
        if (Array.isArray(entry?.hooks)) {
          if (!GROUPED_EVENTS.has(event)) {
            shapeWarnings.push(
              `${hookName}.${event}: matcher group on a flat event (matcher is ignored)`,
            );
          }
          for (const hook of entry.hooks) {
            leaves.push({ hookName, event, matcher: entry.matcher ?? null, hook });
          }
        } else {
          if (GROUPED_EVENTS.has(event)) {
            shapeWarnings.push(
              `${hookName}.${event}: flat handler on a grouped event — official ` +
                "docs require {matcher, hooks: [...]}",
            );
          }
          leaves.push({ hookName, event, matcher: null, hook: entry });
        }
      }
    }
  }
  return { leaves, problems, shapeWarnings, unknownEvents, namedHooks };
}

// Official location is the plugin root; the manifest `hooks` path (IDE world)
// and the legacy hooks/hooks.json are honored for resolution but flagged.
function resolveHooksFile(dir, manifest) {
  const candidates = [];
  if (typeof manifest.hooks === "string") candidates.push(join(dir, manifest.hooks));
  candidates.push(join(dir, "hooks.json"), join(dir, "hooks", "hooks.json"));
  for (const file of candidates) {
    if (existsSync(file)) {
      return { file, isRoot: file === join(dir, "hooks.json") };
    }
  }
  return null;
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
  lintAgents(dir, { ok });
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
    if (!SKILL_NAME_RE.test(s)) {
      warn("skill name style", `${s}: official style is lowercase-hyphenated`);
    }
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
  const resolved = resolveHooksFile(dir, manifest);
  if (!resolved) return;
  const { file: hooksFile, isRoot } = resolved;

  const hooksDoc = readJson(hooksFile);
  ok("hooks.json parses", hooksDoc !== null, hooksFile);
  if (hooksDoc === null) return;

  const { leaves, problems, shapeWarnings, unknownEvents, namedHooks } =
    flattenHooks(hooksDoc);
  ok(
    "hooks.json declares named hooks",
    problems.length === 0 && namedHooks > 0,
    problems.join("; ") ||
      `${namedHooks} named hook(s) — any name works; the plugin name is this kit's convention`,
  );

  const badHandlers = leaves.filter(
    (l) =>
      typeof l.hook?.command !== "string" ||
      (l.hook.type !== undefined && l.hook.type !== "command"),
  );
  ok(
    "hook entries well-formed",
    leaves.length > 0 && badHandlers.length === 0,
    leaves.length === 0
      ? "no handlers found"
      : badHandlers.map((l) => `${l.hookName}.${l.event}`).join(", ") ||
          `${leaves.length} handlers (type defaults to "command")`,
  );

  const malformedTimeouts = leaves.filter(
    (l) =>
      l.hook?.timeout !== undefined &&
      (typeof l.hook.timeout !== "number" || l.hook.timeout <= 0),
  );
  ok(
    "hook timeouts sane",
    malformedTimeouts.length === 0,
    malformedTimeouts
      .map((l) => `${l.hookName}.${l.event}: timeout=${l.hook?.timeout}`)
      .join(", ") || "explicit 10-15s recommended",
  );
  for (const l of leaves) {
    if (l.hook?.timeout === undefined) {
      warn(
        "hook timeout missing",
        `${l.hookName}.${l.event}: official default is 30s of synchronous blocking — set 10-15s explicitly`,
      );
    } else if (l.hook.timeout > MAX_HOOK_TIMEOUT) {
      warn(
        "hook timeout above 30s",
        `${l.hookName}.${l.event}: timeout=${l.hook.timeout} blocks the agent loop`,
      );
    }
  }

  for (const ue of unknownEvents) {
    warn(
      "unknown hook event",
      ue.endsWith(".SessionStart")
        ? `${ue} — SessionStart does not exist (refuted 2026-07)`
        : `${ue} — known events: ${KNOWN_EVENTS.join(", ")}`,
    );
  }
  for (const sw of shapeWarnings) warn("hook entry shape", sw);

  const missingScripts = [];
  const notFailOpen = [];
  for (const l of leaves) {
    const rel = scriptPathOf(l.hook?.command);
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

  if (!isRoot) {
    warn(
      "hooks.json not at plugin root",
      `official location is <plugin>/hooks.json; 'agy plugin validate' will not see ${relative(dir, hooksFile)}`,
    );
  }
  const rootFile = join(dir, "hooks.json");
  const legacyFile = join(dir, "hooks", "hooks.json");
  if (
    existsSync(rootFile) &&
    existsSync(legacyFile) &&
    readFileSync(rootFile, "utf8") !== readFileSync(legacyFile, "utf8")
  ) {
    warn(
      "hooks.json duplicated with drift",
      "root hooks.json and hooks/hooks.json differ — keep a single location",
    );
  }
}

// Subagents are validator-known but officially undocumented. Two formats
// count as of CLI 1.0.16: TOML (observed convention) and markdown with
// frontmatter (confirmed by probe, 2026-07-05). Check the observed
// invariants with line heuristics (a spec-compliant TOML parser is not
// worth the zero-dep budget for 5 flat fields).
function lintAgents(dir, { ok }) {
  const agentsDir = join(dir, "agents");
  if (!existsSync(agentsDir)) return;
  const bad = [];
  let count = 0;
  for (const f of readdirSync(agentsDir)) {
    if (f.endsWith(".toml")) {
      count += 1;
      const src = readFileSync(join(agentsDir, f), "utf8");
      const base = f.replace(/\.toml$/, "");
      const name = /^name\s*=\s*"([^"]+)"/m.exec(src)?.[1];
      if (!name) bad.push(`${f}: missing name`);
      else if (name !== base) bad.push(`${f}: name="${name}" != filename`);
      if (!/^description\s*=\s*"/m.test(src)) bad.push(`${f}: missing description`);
      if (((src.match(/"""/g) ?? []).length) % 2 !== 0) {
        bad.push(`${f}: unbalanced """`);
      }
    } else if (f.endsWith(".md")) {
      count += 1;
      const base = f.replace(/\.md$/, "");
      const { data } = parseFrontmatter(readFileSync(join(agentsDir, f), "utf8"));
      if (!data?.name || !data?.description) {
        bad.push(`${f}: frontmatter needs name + description`);
      } else if (data.name !== base) {
        bad.push(`${f}: name=${data.name} != filename`);
      }
    }
  }
  ok(
    "agents/* minimally valid",
    bad.length === 0,
    bad.join("; ") ||
      `${count} agents (toml/md, line heuristics — format is undocumented)`,
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
