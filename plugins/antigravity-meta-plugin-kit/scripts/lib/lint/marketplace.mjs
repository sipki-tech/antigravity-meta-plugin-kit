// Offline validation for `marketplace.json` catalogs (agy 1.5.17+ contract).
// Verified against `agy plugin validate --strict --json`:
//   - `plugins[i].source` must be an object with `type: "archive"`, `https://` `url`,
//     and 64-hex `sha256` (string sources, "git", and "github" are rejected).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readJsonc } from "../fsutil.mjs";
import { KEBAB_RE, SEMVER_RE, SHA256_RE } from "./constants.mjs";
import { isValidHttpsUrl } from "./helpers.mjs";

export function lintMarketplace(filePath) {
  const file = resolve(filePath);
  const checks = [];
  const warnings = [];
  const notes = [];
  const ok = (name, pass, note = "") => checks.push({ name, pass, note });
  const warn = (name, note = "") => warnings.push({ name, note });
  const done = () => {
    const pass = checks.every((c) => c.pass);
    return {
      payloadDir: file,
      kind: "marketplace",
      checks,
      warnings,
      notes,
      pass,
      strictPass: pass && warnings.length === 0,
    };
  };

  ok("marketplace.json exists", existsSync(file), file);
  if (!existsSync(file)) return done();

  const parsed = readJsonc(file);
  ok(
    "marketplace.json parses (strict JSON)",
    Boolean(parsed?.strictOk),
    parsed?.strictOk
      ? file
      : parsed?.hasJsoncSyntax
        ? "marketplace.json must be strict JSON (no comments or trailing commas)"
        : parsed?.error ?? file,
  );
  if (!parsed?.strictOk) return done();

  const doc = parsed.data;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    ok("marketplace root valid", false, "expected a JSON object");
    return done();
  }

  ok(
    "marketplace name valid",
    typeof doc.name === "string" && doc.name.trim().length > 0,
    String(doc.name ?? ""),
  );
  if (typeof doc.name === "string" && !KEBAB_RE.test(doc.name)) {
    warn("marketplace name style", `"${doc.name}" is not lowercase kebab-case`);
  }

  if (!Array.isArray(doc.plugins) || doc.plugins.length === 0) {
    ok("marketplace plugins array valid", false, '"plugins" must be a non-empty array');
    return done();
  }

  const badEntries = [];
  const badSources = [];
  const seen = new Set();

  doc.plugins.forEach((p, idx) => {
    const label = typeof p?.name === "string" && p.name ? p.name : `plugins[${idx}]`;
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      badEntries.push(`${label}: must be an object`);
      return;
    }

    if (typeof p.name !== "string" || !p.name.trim()) {
      badEntries.push(`plugins[${idx}]: missing name`);
    } else {
      if (!KEBAB_RE.test(p.name)) {
        warn("marketplace plugin name style", `"${p.name}" is not strict kebab-case`);
      }
      if (seen.has(p.name)) {
        badEntries.push(`duplicate plugin name "${p.name}"`);
      } else {
        seen.add(p.name);
      }
    }

    if (typeof p.version !== "string" || !SEMVER_RE.test(p.version)) {
      badEntries.push(`${label}: version must be valid SemVer (got "${p.version ?? ""}")`);
    }
    if (typeof p.description !== "string" || !p.description.trim()) {
      warn("marketplace plugin missing description", `${label}: add a concise description`);
    }

    const src = p.source;
    if (!src || typeof src !== "object" || Array.isArray(src)) {
      badSources.push(
        `${label}: source must be an object {"type":"archive","url":"https://...","sha256":"..."} (string sources fail agy validate)`,
      );
      return;
    }
    if (src.type !== "archive") {
      badSources.push(
        `${label}: unsupported source.type "${src.type ?? ""}" — agy 1.5.17 only supports "archive"`,
      );
    }
    if (!isValidHttpsUrl(src.url)) {
      badSources.push(`${label}: source.url must be a valid https:// URL`);
    }
    if (typeof src.sha256 !== "string" || !SHA256_RE.test(src.sha256)) {
      badSources.push(
        `${label}: source.sha256 must be a 64-character hex digest (agy skips entries without sha256)`,
      );
    }
  });

  ok(
    "marketplace plugins well-formed",
    badEntries.length === 0,
    badEntries.join("; ") || `${doc.plugins.length} plugin(s)`,
  );
  ok(
    "marketplace archive sources valid (url + sha256)",
    badSources.length === 0,
    badSources.join("; ") || "all sources use archive + https url + 64-hex sha256",
  );

  return done();
}
