import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, createJournal, writeFile } from "./fsutil.mjs";

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "plugin",
);

export const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const MANIFEST_LAYOUTS = new Set(["root", "dot-antigravity"]);

const TEXT_EXTS = new Set([
  ".md",
  ".json",
  ".mjs",
  ".js",
  ".cjs",
  ".yml",
  ".yaml",
  ".svg",
  ".txt",
  ".sh",
]);
const TEXT_NAMES = new Set(["_gitignore", "_package.json"]);

export function validatePluginName(name) {
  if (!name) return "plugin name is required";
  if (!NAME_RE.test(name)) {
    return (
      `'${name}' is not a valid plugin name. Use strict kebab-case: lowercase ` +
      "letters, digits and single dashes, starting with a letter (e.g. 'my-plugin')."
    );
  }
  return null;
}

export function toDisplayName(kebab) {
  return String(kebab ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function toEnvPrefix(kebab) {
  return String(kebab ?? "")
    .replaceAll("-", "_")
    .toUpperCase();
}

export function requireTemplates(templatesDir = TEMPLATES_DIR) {
  if (!existsSync(templatesDir)) {
    throw new Error(
      `templates are missing (${templatesDir}). The plugin install is ` +
        "incomplete — reinstall via `agy plugin install " +
        "https://github.com/sipki-tech/antigravity-meta-plugin-kit`.",
    );
  }
}

const RENAMES = {
  _gitignore: ".gitignore",
  "_package.json": "package.json",
};

function isTextTemplate(filename) {
  return TEXT_NAMES.has(filename) || TEXT_EXTS.has(extname(filename).toLowerCase());
}

export function scaffold({
  name,
  parentDir = process.cwd(),
  dryRun = false,
  minimal = false,
  withAgents = false,
  withSidecar = false,
  withCli = false,
  manifestLayout = "root",
} = {}) {
  const invalid = validatePluginName(name);
  if (invalid) throw new Error(invalid);
  if (!MANIFEST_LAYOUTS.has(manifestLayout)) {
    throw new Error(
      `invalid --manifest-layout '${manifestLayout}' — expected 'root' or 'dot-antigravity'.`,
    );
  }
  requireTemplates();
  const targetDir = resolve(parentDir, name);
  if (existsSync(targetDir)) {
    throw new Error(
      `${targetDir} already exists — pick another name or remove it first.`,
    );
  }
  const journal = createJournal(Boolean(dryRun));
  const vars = {
    name,
    displayName: toDisplayName(name),
    envPrefix: toEnvPrefix(name),
    minimal: Boolean(minimal),
    withAgents: Boolean(withAgents),
    withSidecar: Boolean(withSidecar),
    withCli: Boolean(withCli),
    manifestLayout,
  };
  renderTree(journal, TEMPLATES_DIR, targetDir, vars, "");
  return { targetDir, actions: journal.actions };
}

function shouldSkip(relPath, vars) {
  // Opt-in subagent + /<name>-help wrapper
  if (!vars.withAgents) {
    if (relPath === "plugins/__name__/agents") return true;
    if (relPath === "plugins/__name__/skills/__name__-help") return true;
  }
  // Opt-in background sidecar
  if (!vars.withSidecar && relPath === "plugins/__name__/sidecars") {
    return true;
  }
  // Opt-in bundled CLI + auth.json + skill (Google Workspace pattern)
  if (!vars.withCli) {
    if (
      relPath === "plugins/__name__/auth.json" ||
      relPath === "plugins/__name__/scripts/cli.mjs" ||
      relPath === "plugins/__name__/skills/__name__-cli" ||
      relPath === "test/cli.test.mjs"
    ) {
      return true;
    }
  }
  // --minimal skips hooks, hook scripts/io.mjs, MCP stub, and hook e2e test
  // (while still allowing --minimal --with-cli to keep scripts/cli.mjs!).
  if (vars.minimal) {
    if (
      relPath === "plugins/__name__/hooks.json" ||
      relPath === "plugins/__name__/scripts/example-guard.mjs" ||
      relPath === "plugins/__name__/scripts/lib" ||
      relPath === "plugins/__name__/mcp_config.json" ||
      relPath === "test/hook.test.mjs"
    ) {
      return true;
    }
    if (!vars.withCli && relPath === "plugins/__name__/scripts") {
      return true;
    }
  }
  return false;
}

function renderTree(journal, from, to, vars, relPrefix) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (shouldSkip(relPath, vars)) continue;

    const srcPath = join(from, entry.name);
    const destName = (RENAMES[entry.name] ?? entry.name).replaceAll(
      "__name__",
      vars.name,
    );
    let destPath = join(to, destName);

    // Optional `.antigravity-plugin/plugin.json` manifest layout (components
    // remain at the plugin root!).
    if (
      !entry.isDirectory() &&
      relPath === "plugins/__name__/plugin.json" &&
      vars.manifestLayout === "dot-antigravity"
    ) {
      destPath = join(to, ".antigravity-plugin", "plugin.json");
    }

    if (entry.isDirectory()) {
      renderTree(journal, srcPath, destPath, vars, relPath);
    } else if (isTextTemplate(entry.name)) {
      const rendered = readFileSync(srcPath, "utf8")
        .replaceAll("{{name}}", vars.name)
        .replaceAll("{{displayName}}", vars.displayName)
        .replaceAll("{{ENV_PREFIX}}", vars.envPrefix);
      const srcMode = statSync(srcPath).mode & 0o777;
      const isExec = (srcMode & 0o111) !== 0;
      writeFile(journal, destPath, rendered, isExec ? { mode: 0o755 } : {});
    } else {
      copyFile(journal, srcPath, destPath);
    }
  }
}
