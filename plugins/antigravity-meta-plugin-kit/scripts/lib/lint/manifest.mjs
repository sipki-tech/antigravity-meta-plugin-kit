// Manifest discovery and validation (`plugin.json`, `.antigravity-plugin/`, `.gemini-plugin/`).
import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import {
  ALLOWED_LOGO_EXTS,
  ALLOWED_MANIFEST_KEYS,
  KEBAB_RE,
  MANIFEST_LOCATIONS,
  SEMVER_RE,
} from "./constants.mjs";
import { isDir, isFile, isGoogleHttpsLogo, isValidHttpsUrl, resolveInside } from "./helpers.mjs";

// Finds the active native manifest in a plugin directory following agy 1.5.17
// precedence: .antigravity-plugin/plugin.json > .gemini-plugin/plugin.json > plugin.json.
export function findManifest(dir) {
  const found = [];
  for (const parts of MANIFEST_LOCATIONS) {
    const folder = join(dir, ...parts);
    if (!isDir(folder)) continue;
    const match = readdirSync(folder).find(
      (f) => f.toLowerCase() === "plugin.json" && isFile(join(folder, f)),
    );
    if (match) {
      found.push({
        manifestFile: join(folder, match),
        manifestDir: folder,
        relManifest: relative(dir, join(folder, match)),
      });
    }
  }
  if (found.length === 0) return null;
  return { ...found[0], shadowed: found.slice(1) };
}

export function lintManifest(dir, manifest, { ok, warn, info }) {
  const dirName = basename(dir);
  const name = manifest.name;
  ok(
    "name matches directory",
    typeof name === "string" && name === dirName,
    `name=${name} dir=${dirName}`,
  );
  if (typeof name === "string" && !KEBAB_RE.test(name)) {
    warn("plugin name style", `'${name}' is not strict kebab-case (required for Marketplace)`);
  }

  if (manifest.version === undefined) {
    warn("version missing", 'add a semver "version" (required for Marketplace)');
  } else {
    ok(
      "version is semver",
      typeof manifest.version === "string" && SEMVER_RE.test(manifest.version),
      `version=${manifest.version}`,
    );
  }

  for (const key of Object.keys(manifest)) {
    if (!ALLOWED_MANIFEST_KEYS.has(key)) {
      warn(
        `unknown manifest field "${key}"`,
        `ignored by agy 1.5.17 loader (fails \`agy plugin validate --strict\`)`,
      );
    }
  }

  if (manifest.author !== undefined) {
    const a = manifest.author;
    const validString = typeof a === "string" && a.trim().length > 0;
    const validObj =
      typeof a === "object" &&
      a !== null &&
      !Array.isArray(a) &&
      typeof a.name === "string" &&
      a.name.trim().length > 0;
    ok(
      "author valid",
      validString || validObj,
      'must be a non-empty string or {"name": "...", "url"?: "https://...", "email"?: "..."}',
    );
    if (validObj && a.url !== undefined && !isValidHttpsUrl(a.url)) {
      warn("author.url invalid", `"${a.url}" is ignored — use a valid https:// URL`);
    }
  }

  if (manifest.homepage !== undefined && !isValidHttpsUrl(manifest.homepage)) {
    warn("homepage invalid", `"${manifest.homepage}" is ignored — use a valid https:// URL`);
  }

  if (manifest.repository !== undefined) {
    const r = manifest.repository;
    const repoUrl = typeof r === "string" ? r : r && typeof r === "object" ? r.url : null;
    if (!isValidHttpsUrl(repoUrl)) {
      warn(
        "repository invalid",
        `must be a valid https:// URL string (or {"type": "git", "url": "https://..."})`,
      );
    }
  }

  const displayName = manifest.displayName ?? manifest.display_name;
  if (typeof displayName === "string" && /^antigravity\b/i.test(displayName.trim())) {
    warn(
      "displayName starts with brand prefix",
      `Marketplace guidelines discourage leading "Antigravity" in displayName ("${displayName}")`,
    );
  }

  if (manifest.category !== undefined) {
    if (typeof manifest.category !== "string" || !manifest.category.trim()) {
      warn("category invalid", "must be a non-empty string");
    }
  }

  if (manifest.disabled !== undefined && typeof manifest.disabled !== "boolean") {
    ok("disabled is boolean", false, `got ${typeof manifest.disabled}`);
  }

  const prompts = manifest.suggestedPrompts ?? manifest.suggested_prompts;
  if (prompts !== undefined) {
    if (!Array.isArray(prompts)) {
      ok("suggestedPrompts valid", false, "must be an array of strings");
    } else {
      if (prompts.length > 3) {
        warn(
          "suggestedPrompts exceeds 3",
          `has ${prompts.length} prompts; Antigravity only shows the first 3`,
        );
      }
      prompts.forEach((p, idx) => {
        if (typeof p !== "string" || !p.trim()) {
          warn("suggestedPrompts entry empty", `suggestedPrompts[${idx}] is empty and ignored`);
        }
      });
    }
  }

  if (manifest.logo === undefined) {
    info("no logo", 'add "logo": "assets/logo.svg" (.png/.svg/.jpg/.jpeg/.webp, 1:1 square)');
  } else if (typeof manifest.logo !== "string" || !manifest.logo.trim()) {
    warn("logo invalid", "must be a relative image path inside the plugin");
  } else {
    const logo = manifest.logo.trim();
    if (/^https?:\/\//i.test(logo)) {
      if (!isGoogleHttpsLogo(logo)) {
        warn(
          "logo URL not on Google domain",
          `client ignores non-Google URLs ("${logo}") — bundle a local asset like "assets/logo.svg"`,
        );
      }
    } else {
      const ext = extname(logo).toLowerCase();
      const checked = resolveInside(dir, logo);
      const hasDotDir = logo.split(/[\\/]/).some((seg) => seg.startsWith(".") && seg !== ".");
      if (logo.includes("\\") || !checked.ok) {
        warn("logo path invalid", `"${logo}" escapes plugin root or uses backslashes`);
      } else if (hasDotDir) {
        warn("logo inside dot-prefixed dir", `"${logo}" is excluded from Marketplace bundles`);
      } else if (!ALLOWED_LOGO_EXTS.has(ext)) {
        warn(
          "logo extension unsupported",
          `"${logo}" — use .png, .svg, .jpg, .jpeg, or .webp`,
        );
      } else if (!isFile(checked.path)) {
        warn("logo file missing", `"${logo}" does not exist inside plugin`);
      }
    }
  }

  if (manifest.skills !== undefined) {
    const list = Array.isArray(manifest.skills)
      ? manifest.skills
      : typeof manifest.skills === "string"
        ? [manifest.skills]
        : null;
    if (!list) {
      ok("manifest skills valid", false, "skills must be a string or string[]");
    } else {
      const missing = [];
      for (const p of list) {
        if (typeof p !== "string" || !p.trim()) {
          missing.push(String(p));
          continue;
        }
        const checked = resolveInside(dir, p);
        if (!checked.ok) {
          warn("manifest.skills path escapes plugin root", `${p} (${checked.reason})`);
        } else if (!existsSync(checked.path)) {
          missing.push(p);
        }
      }
      ok(
        "declared skills paths exist",
        missing.length === 0,
        missing.join(", ") || list.join(", "),
      );
    }
  }

  const agyExt = manifest.extensions?.["com.google.antigravity"];
  if (agyExt && typeof agyExt === "object" && !Array.isArray(agyExt)) {
    for (const k of Object.keys(agyExt)) {
      if (k !== "contextProviders") {
        warn(`unknown extension key "${k}"`, 'under extensions["com.google.antigravity"]');
      }
    }
  }
}
