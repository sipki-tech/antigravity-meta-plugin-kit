// Skills validation (`skills/<name>/SKILL.md`, manifest.skills, `skills.json`).
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parseFrontmatter } from "../frontmatter.mjs";
import { KEBAB_RE, MAX_BODY_BYTES, WARN_BODY_BYTES } from "./constants.mjs";
import { hasTrigger, isDir, isFile, readRegistryEntries, resolveInside } from "./helpers.mjs";

export function lintSkills(dir, manifest, { ok, warn }) {
  const skillRoots = new Set();
  const defaultSkills = join(dir, "skills");
  if (isDir(defaultSkills)) {
    skillRoots.add(defaultSkills);
  }
  if (manifest.skills !== undefined) {
    const list = Array.isArray(manifest.skills) ? manifest.skills : [manifest.skills];
    for (const p of list) {
      if (typeof p !== "string" || !p.trim()) continue;
      const checked = resolveInside(dir, p);
      if (checked.ok && isDir(checked.path)) {
        skillRoots.add(checked.path);
      }
    }
  }
  for (const p of readRegistryEntries(dir, "skills.json", { ok, warn })) {
    if (isDir(p)) skillRoots.add(p);
  }
  if (skillRoots.size === 0) return;

  const skillItems = [];
  for (const root of skillRoots) {
    if (isFile(join(root, "SKILL.md"))) {
      skillItems.push({
        dirName: basename(root),
        skillFile: join(root, "SKILL.md"),
        rel: relative(dir, root),
      });
      continue;
    }
    if (!isDir(root)) continue;
    const entries = readdirSync(root, { withFileTypes: true });
    const loose = [];
    for (const e of entries) {
      const full = join(root, e.name);
      if (isDir(full)) {
        const checked = resolveInside(dir, relative(dir, full));
        if (!checked.ok) {
          warn("skill path escapes plugin root", `${relative(dir, full)} (${checked.reason})`);
          continue;
        }
        skillItems.push({
          dirName: e.name,
          skillFile: join(full, "SKILL.md"),
          rel: relative(dir, full),
        });
      } else if (e.name !== ".DS_Store") {
        loose.push(e.name);
      }
    }
    if (loose.length > 0) warn("loose files in skills/", loose.join(", "));
  }

  const noSkillMd = skillItems.filter((s) => !isFile(s.skillFile)).map((s) => s.rel);
  ok(
    "every skill has SKILL.md",
    noSkillMd.length === 0,
    noSkillMd.join(", ") || `${skillItems.length} skills`,
  );

  const badFrontmatter = [];
  const noTrigger = [];
  const oversized = [];
  const seenNames = new Map();

  for (const s of skillItems) {
    if (!KEBAB_RE.test(s.dirName)) {
      warn("skill name style", `${s.dirName}: official style is lowercase-hyphenated`);
    }
    if (!isFile(s.skillFile)) continue;
    const { data, bodyBytes, warnings: fmWarnings } = parseFrontmatter(
      readFileSync(s.skillFile, "utf8"),
    );
    for (const fw of fmWarnings) warn("skill frontmatter syntax", `${s.rel}: ${fw}`);
    if (!data || !data.name || !data.description) {
      badFrontmatter.push(s.rel);
      continue;
    }
    if (String(data.name) !== s.dirName) {
      badFrontmatter.push(`${s.rel} (name=${data.name})`);
    }
    if (seenNames.has(data.name)) {
      warn(
        "duplicate skill name",
        `${s.rel} duplicates skill "${data.name}" (${seenNames.get(data.name)})`,
      );
    } else {
      seenNames.set(data.name, s.rel);
    }

    const slashOnly = data["disable-model-invocation"] === true;
    if (!slashOnly && !hasTrigger(data.description)) {
      noTrigger.push(s.dirName);
    }
    if (bodyBytes > MAX_BODY_BYTES) {
      oversized.push(`${s.dirName} (${bodyBytes} B > ${MAX_BODY_BYTES} B)`);
    } else if (bodyBytes > WARN_BODY_BYTES) {
      warn(
        "skill body approaching 24KB cap",
        `${s.dirName} is ${bodyBytes} B (Antigravity truncates above ${MAX_BODY_BYTES} B)`,
      );
    }
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
      'quoted wake phrase, "use when/for/...", or disable-model-invocation: true',
  );
  ok(
    "skill bodies within 24KB cap",
    oversized.length === 0,
    oversized.join(", ") || `all skills <= ${MAX_BODY_BYTES} bytes`,
  );
}
