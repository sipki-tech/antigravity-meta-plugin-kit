// Rules validation (`rules/AGENTS.md`, `rules/*.md`, `rules.json`).
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parseFrontmatter } from "../frontmatter.mjs";
import { MAX_BODY_BYTES, VALID_RULE_TRIGGERS, WARN_ALWAYS_ON_LINES } from "./constants.mjs";
import { isDir, isFile, readRegistryEntries, resolveInside } from "./helpers.mjs";

export function lintRules(dir, { ok, warn }) {
  for (const rootRule of ["AGENTS.md", "GEMINI.md"]) {
    if (isFile(join(dir, rootRule))) {
      warn(
        `root ${rootRule} in plugin`,
        `plugins only load rules from rules/ — move ${rootRule} to rules/${rootRule}`,
      );
    }
  }

  const ruleFiles = [];
  const rulesDir = join(dir, "rules");
  if (isDir(rulesDir)) {
    for (const entry of readdirSync(rulesDir, { withFileTypes: true })) {
      const full = join(rulesDir, entry.name);
      if (isDir(full)) {
        warn(
          "nested folder in rules/",
          `rules/${entry.name}/ is ignored by flat 1-level scan — move files to rules/ or declare rules.json`,
        );
        continue;
      }
      if (isFile(full) && entry.name.endsWith(".md")) {
        const checked = resolveInside(dir, relative(dir, full));
        if (!checked.ok) {
          warn("rule path escapes plugin root", `${relative(dir, full)} (${checked.reason})`);
          continue;
        }
        ruleFiles.push(full);
      }
    }
  }

  for (const p of readRegistryEntries(dir, "rules.json", { ok, warn })) {
    if (isFile(p) && p.endsWith(".md")) {
      ruleFiles.push(p);
    } else if (isDir(p)) {
      for (const f of readdirSync(p)) {
        const full = join(p, f);
        if (isFile(full) && f.endsWith(".md")) ruleFiles.push(full);
      }
    }
  }

  if (ruleFiles.length === 0) return;

  const badTriggers = [];
  const badGlobs = [];
  const oversized = [];

  for (const file of ruleFiles) {
    const name = basename(file);
    const rel = relative(dir, file);
    const raw = readFileSync(file, "utf8");
    const { data, body, bodyBytes, warnings: fmWarnings } = parseFrontmatter(raw);
    for (const fw of fmWarnings) warn("rule frontmatter syntax", `${rel}: ${fw}`);

    if (name === "AGENTS.md" || name === "GEMINI.md") {
      if (bodyBytes > MAX_BODY_BYTES) {
        oversized.push(`${rel} (${bodyBytes} B > ${MAX_BODY_BYTES} B)`);
      }
      const lineCount = body.trim() ? body.trim().split("\n").length : 0;
      if (lineCount > WARN_ALWAYS_ON_LINES) {
        warn(
          "always-on rule verbose",
          `${rel} has ${lineCount} lines — keep always-on rules lean (<= ${WARN_ALWAYS_ON_LINES} lines) to avoid defaultRulesBudget demotion`,
        );
      }
      continue;
    }

    if (name === "README.md" && data === null) continue;

    if (name.toLowerCase() === "agents.md" || name.toLowerCase() === "gemini.md") {
      badTriggers.push(
        `${rel}: filename must be exact uppercase ${name.toUpperCase()} or declare trigger frontmatter`,
      );
      continue;
    }

    const trigger = data?.trigger;
    if (typeof trigger !== "string" || !VALID_RULE_TRIGGERS.has(trigger)) {
      badTriggers.push(
        `${rel}: missing/invalid trigger (must be always_on, model_decision, glob, or manual)`,
      );
      continue;
    }

    if (trigger === "model_decision" && !data.description) {
      warn(
        "model_decision rule missing description",
        `${rel}: add description so the model knows when to apply this rule`,
      );
    }

    if (trigger === "glob") {
      const globVal = data.globs !== undefined ? data.globs : data.glob;
      if (Array.isArray(globVal)) {
        badGlobs.push(`${rel}: globs must be a comma-separated string, NOT a YAML array`);
      } else if (typeof globVal !== "string" || !globVal.trim()) {
        warn("glob rule missing globs", `${rel}: set globs: "**/*.ext" or the rule never applies`);
      } else if (/\{[^}]*,[^}]*\}/.test(globVal)) {
        warn(
          "glob rule uses brace expansion",
          `${rel}: globs="${globVal}" — Antigravity splits globs on commas first, breaking {a,b}; expand to "**/*.a, **/*.b"`,
        );
      }
    }

    if (bodyBytes > MAX_BODY_BYTES) {
      oversized.push(`${rel} (${bodyBytes} B > ${MAX_BODY_BYTES} B)`);
    }
    if (trigger === "always_on") {
      const lineCount = body.trim() ? body.trim().split("\n").length : 0;
      if (lineCount > WARN_ALWAYS_ON_LINES) {
        warn(
          "always-on rule verbose",
          `${rel} has ${lineCount} lines — keep always-on rules lean (<= ${WARN_ALWAYS_ON_LINES} lines)`,
        );
      }
    }
  }

  ok(
    "rules triggers valid",
    badTriggers.length === 0,
    badTriggers.join("; ") || `${ruleFiles.length} rules`,
  );
  ok("rules globs valid", badGlobs.length === 0, badGlobs.join("; ") || "globs are strings");
  ok(
    "rules within 24KB cap",
    oversized.length === 0,
    oversized.join(", ") || `all rules <= ${MAX_BODY_BYTES} bytes`,
  );
}
