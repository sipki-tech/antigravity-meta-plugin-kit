// Subagents validation (`agents/*.md`, `agents/*/agent.md`, `agents.json`).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseFrontmatter } from "../frontmatter.mjs";
import {
  LEGACY_AGENT_TOOL_ALIASES,
  NATIVE_AGENT_TOOLS,
  RESERVED_AGENT_NAMES,
  VALID_EXEC_POLICIES,
  VALID_MODEL_TIERS,
} from "./constants.mjs";
import { isDir, isFile, readRegistryEntries, resolveInside } from "./helpers.mjs";

export function collectAgentFiles(dir, { ok, warn }) {
  const mdFiles = [];
  const tomlFiles = [];
  const jsonFiles = [];

  const scanFolder = (folder) => {
    if (!isDir(folder)) return;
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = join(folder, entry.name);
      if (isDir(full)) {
        const subMd = join(full, "agent.md");
        const subJson = join(full, "agent.json");
        if (isFile(subMd)) {
          const checked = resolveInside(dir, relative(dir, subMd));
          if (!checked.ok) {
            warn("agent path escapes plugin root", `${relative(dir, subMd)} (${checked.reason})`);
          } else {
            mdFiles.push(subMd);
          }
        } else if (isFile(subJson)) {
          jsonFiles.push(subJson);
        }
      } else if (isFile(full) && entry.name.endsWith(".md")) {
        const checked = resolveInside(dir, relative(dir, full));
        if (!checked.ok) {
          warn("agent path escapes plugin root", `${relative(dir, full)} (${checked.reason})`);
        } else {
          mdFiles.push(full);
        }
      } else if (isFile(full) && entry.name.endsWith(".toml")) {
        tomlFiles.push(full);
      }
    }
  };

  scanFolder(join(dir, "agents"));
  for (const p of readRegistryEntries(dir, "agents.json", { ok, warn })) {
    if (isFile(p) && p.endsWith(".md")) mdFiles.push(p);
    else if (isFile(p) && p.endsWith(".toml")) tomlFiles.push(p);
    else if (isDir(p)) scanFolder(p);
  }
  return { mdFiles, tomlFiles, jsonFiles };
}

export function lintAgents(dir, { ok, warn }) {
  const { mdFiles, tomlFiles, jsonFiles } = collectAgentFiles(dir, { ok, warn });
  if (mdFiles.length === 0 && tomlFiles.length === 0 && jsonFiles.length === 0) return;

  for (const jf of jsonFiles) {
    warn(
      "agent.json is internal-only",
      `${relative(dir, jf)}: only internal Google builds read agent.json — write agent.md`,
    );
  }

  const bad = [];
  const badTools = [];
  const seenNames = new Map();

  for (const tf of tomlFiles) {
    bad.push(
      `${relative(dir, tf)}: TOML agents are silently ignored by agy 1.5.17 (0 agents loaded, no warning) — migrate to Markdown (.md)`,
    );
  }

  for (const file of mdFiles) {
    const rel = relative(dir, file);
    const { data, warnings: fmWarnings } = parseFrontmatter(readFileSync(file, "utf8"));
    for (const fw of fmWarnings) warn("agent frontmatter syntax", `${rel}: ${fw}`);
    if (!data) {
      bad.push(`${rel}: missing YAML frontmatter (name + description required)`);
      continue;
    }
    if (!data.name || typeof data.name !== "string") {
      bad.push(`${rel}: missing name`);
    } else {
      if (RESERVED_AGENT_NAMES.has(data.name)) {
        bad.push(`${rel}: name "${data.name}" collides with built-in agent`);
      }
      if (seenNames.has(data.name)) {
        warn("duplicate agent name", `${rel} duplicates "${data.name}" (${seenNames.get(data.name)})`);
      } else {
        seenNames.set(data.name, rel);
      }
    }
    if (!data.description || typeof data.description !== "string") {
      bad.push(`${rel}: missing description`);
    }

    if (data.model !== undefined && data.model !== "") {
      if (typeof data.model !== "string" || !VALID_MODEL_TIERS.has(data.model)) {
        bad.push(
          `${rel}: invalid model tier "${data.model}" — only inherit, flash_lite, flash, pro are accepted (concrete model IDs skip the agent)`,
        );
      }
    }

    if (data.commandExecutionPolicy !== undefined && data.commandExecutionPolicy !== "") {
      if (
        typeof data.commandExecutionPolicy !== "string" ||
        !VALID_EXEC_POLICIES.has(data.commandExecutionPolicy)
      ) {
        bad.push(
          `${rel}: invalid commandExecutionPolicy "${data.commandExecutionPolicy}" — must be off, auto, eager, or sandbox`,
        );
      }
    }

    if (data.inheritCustomizations !== undefined && data.inheritScopes !== undefined) {
      bad.push(`${rel}: inheritCustomizations and inheritScopes cannot both be set`);
    }

    if (data.tools !== undefined) {
      if (!Array.isArray(data.tools)) {
        badTools.push(`${rel}: tools must be a YAML list ([]string), not a string`);
      } else {
        for (const tool of data.tools) {
          if (typeof tool !== "string" || !tool.trim()) {
            badTools.push(`${rel}: empty tool entry in tools[]`);
            continue;
          }
          if (LEGACY_AGENT_TOOL_ALIASES[tool]) {
            warn(`agent uses legacy tool "${tool}"`, `${rel}: ${LEGACY_AGENT_TOOL_ALIASES[tool]}`);
          } else if (!NATIVE_AGENT_TOOLS.has(tool) && !tool.startsWith("mcp_")) {
            badTools.push(
              `${rel}: unknown tool "${tool}" — crashes subagent at spawn ("tool not found in registry")`,
            );
          }
        }
      }
    }

    if (data.mcpServers !== undefined) {
      if (
        !Array.isArray(data.mcpServers) ||
        data.mcpServers.some((m) => !m || typeof m !== "object" || Array.isArray(m))
      ) {
        bad.push(`${rel}: mcpServers must be a YAML list of objects`);
      }
    }

    if (data.nickname_candidates !== undefined) {
      warn(
        "agent uses ignored field nickname_candidates",
        `${rel}: silently ignored in agy 1.5.17 Markdown agents`,
      );
    }
  }

  ok(
    "agents valid (Markdown, tiers, policy)",
    bad.length === 0,
    bad.join("; ") || `${mdFiles.length} agent(s)`,
  );
  ok(
    "agent tools valid",
    badTools.length === 0,
    badTools.join("; ") || "native agy 1.5.17 tool registry",
  );
}
