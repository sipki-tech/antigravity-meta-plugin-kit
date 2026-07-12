import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJournal, writeFile } from "./fsutil.mjs";

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "plugin",
);

export const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function validatePluginName(name) {
  if (!name) return "plugin name is required";
  if (!NAME_RE.test(name)) {
    return (
      `'${name}' is not a valid plugin name. Use kebab-case: lowercase letters, ` +
      "digits and single dashes, starting with a letter (e.g. 'my-plugin')."
    );
  }
  return null;
}

// A corrupt/partial plugin install would otherwise surface as a raw
// readdirSync stack trace mid-scaffold.
export function requireTemplates(templatesDir = TEMPLATES_DIR) {
  if (!existsSync(templatesDir)) {
    throw new Error(
      `templates are missing (${templatesDir}). The plugin install is ` +
        "incomplete — reinstall via `agy plugin install " +
        "https://github.com/sipki-tech/antigravity-meta-plugin-kit`.",
    );
  }
}

// Templates store dotfiles and nested manifests under safe names
// (`_gitignore`, `_package.json`) so they don't act as real ignore rules or
// stray package manifests while they live inside this plugin's payload; the
// scaffolder renames them to their real names at render time.
const RENAMES = {
  _gitignore: ".gitignore",
  "_package.json": "package.json",
};

export function scaffold({
  name,
  parentDir = process.cwd(),
  dryRun = false,
  withAgents = false,
} = {}) {
  const invalid = validatePluginName(name);
  if (invalid) throw new Error(invalid);
  requireTemplates();
  const targetDir = resolve(parentDir, name);
  if (existsSync(targetDir)) {
    throw new Error(
      `${targetDir} already exists — pick another name or remove it first.`,
    );
  }
  const journal = createJournal(Boolean(dryRun));
  renderTree(journal, TEMPLATES_DIR, targetDir, { name, withAgents });
  return { targetDir, actions: journal.actions };
}

function renderTree(journal, from, to, vars) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const srcPath = join(from, entry.name);
    const destName = (RENAMES[entry.name] ?? entry.name).replaceAll(
      "__name__",
      vars.name,
    );
    const destPath = join(to, destName);
    if (entry.isDirectory()) {
      // agents/*.toml is validator-known but officially undocumented — only
      // scaffold the example subagent on explicit request.
      if (entry.name === "agents" && !vars.withAgents) continue;
      renderTree(journal, srcPath, destPath, vars);
    } else {
      const rendered = readFileSync(srcPath, "utf8").replaceAll(
        "{{name}}",
        vars.name,
      );
      writeFile(journal, destPath, rendered);
    }
  }
}
