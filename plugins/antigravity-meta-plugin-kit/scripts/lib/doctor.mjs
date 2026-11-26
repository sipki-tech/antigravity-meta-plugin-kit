// Read-only local Antigravity environment diagnostics (`doctor`).
// Inspects ~/.gemini/config/plugins/, ~/.gemini/config/config.json, standalone
// customizations, and workspace .agents/ (walking up to repo root) for real
// reliability hazards:
//   1. Effective enabled/disabled state & stale config.json entries (symlink-aware)
//   2. Silent plugin / skill / subagent name collisions (workspace > global)
//   3. Runtime traps across all enabled plugins (via lintPlugin + global Stop hook check)
//   4. Hard platform caps: 24,000-byte per-file truncation & 20,000-token defaultRulesBudget
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseFrontmatter } from "./frontmatter.mjs";
import { readJsonc } from "./fsutil.mjs";
import { findManifest, flattenHooks, lintPlugin, MAX_BODY_BYTES } from "./lint.mjs";
import { isDir, isFile, resolveInside } from "./lint/helpers.mjs";

export const DEFAULT_RULES_BUDGET_TOKENS = 20000;
const WARN_RULES_BUDGET_TOKENS = 15000;
const WORKSPACE_AGENT_DIRS = [".agents", ".agent", "_agents", "_agent"];

function readPluginRegistryPaths(pluginDir, filename) {
  const file = join(pluginDir, filename);
  if (!isFile(file)) return [];
  const parsed = readJsonc(file);
  if (!parsed?.ok || !parsed.data || typeof parsed.data !== "object") return [];
  const out = [];
  for (const entry of parsed.data.entries ?? []) {
    if (typeof entry?.path !== "string" || !entry.path.trim()) continue;
    const checked = resolveInside(pluginDir, entry.path);
    if (checked.ok && existsSync(checked.path)) out.push(checked.path);
  }
  return out;
}

function scanSkillsInDir(skillsDir, sourceLabel, standalone) {
  const out = [];
  if (!isDir(skillsDir)) return out;
  // Direct single-skill root (e.g. manifest.skills pointing to a skill dir)
  const directMd = join(skillsDir, "SKILL.md");
  if (isFile(directMd)) {
    const raw = readFileSync(directMd, "utf8");
    const { data, bodyBytes } = parseFrontmatter(raw);
    out.push({
      name: typeof data?.name === "string" ? data.name : basename(skillsDir),
      path: directMd,
      source: sourceLabel,
      standalone,
      bodyBytes,
      slashOnly: data?.["disable-model-invocation"] === true,
    });
    return out;
  }
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    const full = join(skillsDir, entry.name);
    if (!isDir(full)) continue;
    const skillMd = join(full, "SKILL.md");
    if (!isFile(skillMd)) continue;
    const raw = readFileSync(skillMd, "utf8");
    const { data, bodyBytes } = parseFrontmatter(raw);
    out.push({
      name: typeof data?.name === "string" ? data.name : entry.name,
      path: skillMd,
      source: sourceLabel,
      standalone,
      bodyBytes,
      slashOnly: data?.["disable-model-invocation"] === true,
    });
  }
  return out;
}

function scanAgentsInDir(agentsDir, sourceLabel) {
  const out = [];
  if (!isDir(agentsDir)) return out;
  for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
    const full = join(agentsDir, entry.name);
    let mdPath = null;
    let fallbackName = null;
    if (isDir(full)) {
      const nested = join(full, "agent.md");
      if (isFile(nested)) {
        mdPath = nested;
        fallbackName = entry.name;
      }
    } else if (isFile(full) && entry.name.endsWith(".md")) {
      mdPath = full;
      fallbackName = basename(full, ".md");
    }
    if (!mdPath) continue;
    const { data } = parseFrontmatter(readFileSync(mdPath, "utf8"));
    const name =
      typeof data?.name === "string" && data.name.trim()
        ? data.name.trim()
        : fallbackName;
    out.push({ name, path: mdPath, source: sourceLabel });
  }
  return out;
}

function scanRuleFile(fullPath, sourceLabel, standalone) {
  const fileName = basename(fullPath);
  const raw = readFileSync(fullPath, "utf8");
  const { data, bodyBytes } = parseFrontmatter(raw);
  const isPlainAlwaysOn = fileName === "AGENTS.md" || fileName === "GEMINI.md";
  if (fileName === "README.md" && data === null) return null;
  const trigger = isPlainAlwaysOn ? "always_on" : data?.trigger ?? "invalid";
  return {
    path: fullPath,
    source: sourceLabel,
    standalone,
    trigger,
    bodyBytes,
    totalBytes: Buffer.byteLength(raw, "utf8"),
  };
}

function scanRulesInDir(rulesDir, sourceLabel, standalone) {
  const out = [];
  if (!isDir(rulesDir)) return out;
  for (const entry of readdirSync(rulesDir, { withFileTypes: true })) {
    const full = join(rulesDir, entry.name);
    if (!isFile(full) || !entry.name.endsWith(".md")) continue;
    const item = scanRuleFile(full, sourceLabel, standalone);
    if (item) out.push(item);
  }
  return out;
}

function hasEnabledStopHook(pluginDir) {
  const hooksFile = join(pluginDir, "hooks.json");
  if (!isFile(hooksFile)) return false;
  const parsed = readJsonc(hooksFile);
  if (!parsed?.strictOk) return false;
  const { leaves } = flattenHooks(parsed.data);
  return leaves.some((l) => l.event === "Stop" && l.enabled);
}

function discoverPluginsInRoot(pluginsRoot, scope, configPlugins) {
  const list = [];
  if (!isDir(pluginsRoot)) return list;
  for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const dir = join(pluginsRoot, entry.name);
    if (!isDir(dir)) continue;
    const found = findManifest(dir);
    if (!found) {
      list.push({
        scope,
        dirName: entry.name,
        dir,
        name: null,
        version: null,
        enabled: false,
        enabledSource: "missing-manifest",
        manifestFound: false,
        manifest: null,
        hasObsoleteVersionFile: isFile(join(dir, "installed_version.json")),
      });
      continue;
    }
    const parsed = readJsonc(found.manifestFile);
    const manifest =
      parsed?.ok && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
        ? parsed.data
        : null;
    const cfgEntry = scope === "global" ? configPlugins?.[entry.name] : undefined;
    let enabled = true;
    let enabledSource = "default";
    if (typeof cfgEntry?.enabled === "boolean") {
      enabled = cfgEntry.enabled;
      enabledSource = "config.json";
    } else if (manifest?.disabled === true) {
      enabled = false;
      enabledSource = "manifest.disabled";
    }
    list.push({
      scope,
      dirName: entry.name,
      dir,
      name: typeof manifest?.name === "string" ? manifest.name : null,
      version: typeof manifest?.version === "string" ? manifest.version : null,
      enabled,
      enabledSource,
      manifestFound: true,
      manifestValid: Boolean(manifest),
      manifest,
      hasObsoleteVersionFile: isFile(join(dir, "installed_version.json")),
    });
  }
  return list.sort((a, b) => a.dirName.localeCompare(b.dirName));
}

// Walks from workspaceDir up to repo root (.git) collecting ancestor dirs
// (nearest first), never climbing into or past homeDir so ~/.agents is never
// double-counted as both workspace and global when a project has no .git yet.
function ancestorWorkspaceDirs(workspaceDir, homeDir) {
  const start = resolve(workspaceDir);
  const home = resolve(homeDir);
  if (start === home) return [start];
  const dirs = [];
  let cur = start;
  let foundGit = false;
  while (true) {
    if (cur === home) break;
    dirs.push(cur);
    if (existsSync(join(cur, ".git"))) {
      foundGit = true;
      break;
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return foundGit ? dirs : [start];
}

export function runDoctor({ homeDir = homedir(), workspaceDir = process.cwd() } = {}) {
  const home = resolve(homeDir);
  const workspace = resolve(workspaceDir);
  const findings = [];
  const add = (severity, category, subject, message) =>
    findings.push({ severity, category, subject, message });

  const configPath = join(home, ".gemini", "config", "config.json");
  let configPlugins = {};
  if (isFile(configPath)) {
    const parsed = readJsonc(configPath);
    if (!parsed?.ok) {
      add("error", "config", configPath, `config.json failed to parse: ${parsed?.error ?? "invalid JSON"}`);
    } else if (parsed.data?.plugins && typeof parsed.data.plugins === "object") {
      configPlugins = parsed.data.plugins;
    }
  }

  // 1. Discover workspace (walking up to repo root, stopping before homeDir) + global plugins
  const wsAncestors = ancestorWorkspaceDirs(workspace, home);
  const globalAgentsDir = join(home, ".agents");
  const workspacePlugins = [];
  const workspaceRoots = [];
  for (const dir of wsAncestors) {
    for (const rel of WORKSPACE_AGENT_DIRS) {
      const candidate = join(dir, rel);
      if (candidate === globalAgentsDir) continue;
      if (isDir(candidate)) {
        workspaceRoots.push(candidate);
        workspacePlugins.push(...discoverPluginsInRoot(join(candidate, "plugins"), "workspace", {}));
      }
    }
  }
  const globalPluginsDir = join(home, ".gemini", "config", "plugins");
  const globalPlugins = discoverPluginsInRoot(globalPluginsDir, "global", configPlugins);
  const plugins = [...workspacePlugins, ...globalPlugins];

  // Stale config.json entries pointing to deleted plugin directories.
  const globalDirSet = new Set(globalPlugins.map((p) => p.dirName));
  for (const cfgKey of Object.keys(configPlugins)) {
    if (!globalDirSet.has(cfgKey)) {
      add(
        "info",
        "config",
        `config.json:plugins.${cfgKey}`,
        `stale config.json entry — directory ${join(globalPluginsDir, cfgKey)} does not exist`,
      );
    }
  }

  // 2. Track collisions across active components (priority order: workspace -> global).
  const seenPluginNames = new Map();
  const skills = [];
  const agents = [];
  const rules = [];

  // Standalone workspace rules / skills / agents first (highest priority).
  for (const dir of wsAncestors) {
    for (const rootFile of ["AGENTS.md", "GEMINI.md"]) {
      const p = join(dir, rootFile);
      if (isFile(p)) {
        const raw = readFileSync(p, "utf8");
        const bytes = Buffer.byteLength(raw, "utf8");
        rules.push({
          path: p,
          source: "workspace-root",
          standalone: true,
          trigger: "always_on",
          bodyBytes: bytes,
          totalBytes: bytes,
        });
      }
    }
  }
  for (const wsAgentDir of workspaceRoots) {
    const label = `workspace:${basename(wsAgentDir)}`;
    skills.push(...scanSkillsInDir(join(wsAgentDir, "skills"), label, true));
    agents.push(...scanAgentsInDir(join(wsAgentDir, "agents"), label));
    rules.push(...scanRulesInDir(join(wsAgentDir, "rules"), label, true));
  }

  // Evaluate each plugin
  const pluginSummaries = [];
  for (const p of plugins) {
    const { manifest, ...publicMeta } = p;
    const label = `${p.scope}:${p.name ?? p.dirName}`;
    if (!p.manifestFound) {
      add("warn", "manifest", p.dir, "installed plugin directory is missing plugin.json");
      pluginSummaries.push({ ...publicMeta, lint: null });
      continue;
    }
    if (p.hasObsoleteVersionFile) {
      add(
        "info",
        "legacy",
        join(p.dir, "installed_version.json"),
        "obsolete installed_version.json artifact (enablement lives in config.json)",
      );
    }
    if (!p.enabled) {
      pluginSummaries.push({ ...publicMeta, lint: null });
      continue;
    }

    if (p.name) {
      if (seenPluginNames.has(p.name)) {
        add(
          "error",
          "collision",
          p.name,
          `duplicate plugin name "${p.name}": ${seenPluginNames.get(p.name)} shadows ${p.dir} (Antigravity silently drops collisions)`,
        );
      } else {
        seenPluginNames.set(p.name, p.dir);
      }
    }

    const lint = lintPlugin(p.dir);
    const failedChecks = lint.checks.filter((c) => !c.pass);
    for (const fc of failedChecks) {
      add("error", "lint", label, `${fc.name}${fc.note ? ` (${fc.note})` : ""}`);
    }
    for (const w of lint.warnings) {
      add("warn", "lint", label, `${w.name}${w.note ? ` (${w.note})` : ""}`);
    }

    if (p.scope === "global" && hasEnabledStopHook(p.dir)) {
      add(
        "warn",
        "global-hook",
        label,
        "globally installed plugin registers an active Stop hook — fires on every turn in every unrelated workspace",
      );
    }

    // Collect skills (default skills/, manifest.skills, skills.json)
    const pluginSkillRoots = new Set();
    if (isDir(join(p.dir, "skills"))) pluginSkillRoots.add(join(p.dir, "skills"));
    if (manifest?.skills !== undefined) {
      const list = Array.isArray(manifest.skills) ? manifest.skills : [manifest.skills];
      for (const sp of list) {
        if (typeof sp !== "string" || !sp.trim()) continue;
        const checked = resolveInside(p.dir, sp);
        if (checked.ok && isDir(checked.path)) pluginSkillRoots.add(checked.path);
      }
    }
    for (const rp of readPluginRegistryPaths(p.dir, "skills.json")) {
      if (isDir(rp)) pluginSkillRoots.add(rp);
    }
    for (const sr of pluginSkillRoots) {
      skills.push(...scanSkillsInDir(sr, label, false));
    }

    // Collect agents (default agents/ + agents.json)
    agents.push(...scanAgentsInDir(join(p.dir, "agents"), label));
    for (const ap of readPluginRegistryPaths(p.dir, "agents.json")) {
      if (isFile(ap) && ap.endsWith(".md")) {
        const { data } = parseFrontmatter(readFileSync(ap, "utf8"));
        const name = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : basename(ap, ".md");
        agents.push({ name, path: ap, source: label });
      } else if (isDir(ap)) {
        agents.push(...scanAgentsInDir(ap, label));
      }
    }

    // Collect rules (default rules/ + rules.json)
    rules.push(...scanRulesInDir(join(p.dir, "rules"), label, false));
    for (const rp of readPluginRegistryPaths(p.dir, "rules.json")) {
      if (isFile(rp) && rp.endsWith(".md")) {
        const item = scanRuleFile(rp, label, false);
        if (item) rules.push(item);
      } else if (isDir(rp)) {
        rules.push(...scanRulesInDir(rp, label, false));
      }
    }

    pluginSummaries.push({
      ...publicMeta,
      lint: {
        pass: lint.pass,
        strictPass: lint.strictPass,
        failedChecks: failedChecks.length,
        warnings: lint.warnings.length,
      },
    });
  }

  // Standalone global customizations (lower priority than plugins)
  const globalCfg = join(home, ".gemini", "config");
  skills.push(...scanSkillsInDir(join(globalCfg, "skills"), "global:~/.gemini/config", true));
  skills.push(...scanSkillsInDir(join(home, ".agents", "skills"), "global:~/.agents/skills", true));
  agents.push(...scanAgentsInDir(join(globalCfg, "agents"), "global:~/.gemini/config"));
  rules.push(...scanRulesInDir(join(globalCfg, "rules"), "global:~/.gemini/config", true));
  rules.push(...scanRulesInDir(join(home, ".agents", "rules"), "global:~/.agents/rules", true));
  const globalGeminiMd = join(home, ".gemini", "GEMINI.md");
  if (isFile(globalGeminiMd)) {
    const raw = readFileSync(globalGeminiMd, "utf8");
    const bytes = Buffer.byteLength(raw, "utf8");
    rules.push({
      path: globalGeminiMd,
      source: "global:~/.gemini",
      standalone: true,
      trigger: "always_on",
      bodyBytes: bytes,
      totalBytes: bytes,
    });
  }

  // 3. Detect skill & agent collisions and standalone 24KB hard truncation caps
  const seenSkills = new Map();
  for (const s of skills) {
    if (seenSkills.has(s.name)) {
      const winner = seenSkills.get(s.name);
      add(
        "warn",
        "collision",
        `skill:${s.name}`,
        `duplicate skill "${s.name}" — ${winner.source} (${winner.path}) shadows ${s.source} (${s.path})`,
      );
    } else {
      seenSkills.set(s.name, s);
    }
    if (s.bodyBytes > MAX_BODY_BYTES && s.standalone) {
      add(
        "error",
        "truncation",
        s.path,
        `skill "${s.name}" body is ${s.bodyBytes} B (exceeds hard ${MAX_BODY_BYTES} B truncation cap)`,
      );
    }
  }

  const seenAgents = new Map();
  for (const a of agents) {
    if (seenAgents.has(a.name)) {
      const winner = seenAgents.get(a.name);
      add(
        "warn",
        "collision",
        `agent:${a.name}`,
        `duplicate subagent "${a.name}" — ${winner.source} (${winner.path}) shadows ${a.source} (${a.path})`,
      );
    } else {
      seenAgents.set(a.name, a);
    }
  }

  // 4. Hard platform limits for rules: 24KB per file + 20,000-token defaultRulesBudget
  const alwaysOnFiles = [];
  let alwaysOnBytes = 0;
  for (const r of rules) {
    if (r.bodyBytes > MAX_BODY_BYTES && r.standalone) {
      add(
        "error",
        "truncation",
        r.path,
        `rule is ${r.bodyBytes} B (exceeds hard ${MAX_BODY_BYTES} B truncation cap)`,
      );
    }
    if (r.trigger === "always_on") {
      alwaysOnBytes += r.bodyBytes;
      alwaysOnFiles.push({ path: r.path, source: r.source, bytes: r.bodyBytes });
    }
  }
  const estimatedTokens = Math.ceil(alwaysOnBytes / 4);
  if (estimatedTokens > DEFAULT_RULES_BUDGET_TOKENS) {
    add(
      "error",
      "rules-budget",
      "defaultRulesBudget",
      `active always_on rules total ~${estimatedTokens} tokens (${alwaysOnBytes} B across ${alwaysOnFiles.length} file(s)), exceeding Antigravity's hard ${DEFAULT_RULES_BUDGET_TOKENS}-token budget (rules demote to path pointers)`,
    );
  } else if (estimatedTokens > WARN_RULES_BUDGET_TOKENS) {
    add(
      "warn",
      "rules-budget",
      "defaultRulesBudget",
      `active always_on rules total ~${estimatedTokens} tokens (${alwaysOnBytes} B) — approaching Antigravity's ${DEFAULT_RULES_BUDGET_TOKENS}-token demotion cap`,
    );
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;

  return {
    homeDir: home,
    workspaceDir: workspace,
    plugins: pluginSummaries,
    alwaysOnRules: {
      count: alwaysOnFiles.length,
      totalBytes: alwaysOnBytes,
      estimatedTokens,
      budgetTokens: DEFAULT_RULES_BUDGET_TOKENS,
      files: alwaysOnFiles,
    },
    counts: {
      pluginsTotal: pluginSummaries.length,
      pluginsEnabled: pluginSummaries.filter((p) => p.enabled).length,
      skills: skills.length,
      agents: agents.length,
      rules: rules.length,
    },
    findings,
    errors,
    warnings,
    pass: errors === 0,
    strictPass: errors === 0 && warnings === 0,
  };
}
