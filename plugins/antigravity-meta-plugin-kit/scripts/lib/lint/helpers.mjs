// Shared helper heuristics, symlink-safe stat wrappers, and containment checks.
import { existsSync, realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { readJsonc } from "../fsutil.mjs";
import { GOOGLE_LOGO_DOMAINS } from "./constants.mjs";

export function isDir(p) {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p) {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

// Resolves `relPath` against `rootDir` and verifies containment both lexically
// and after resolving symlinks (matching agy 1.5.6+ install restrictions).
export function resolveInside(rootDir, relPath) {
  const root = resolve(rootDir);
  const candidate = resolve(root, String(relPath ?? ""));
  const lexInside = candidate === root || candidate.startsWith(root + sep);
  if (!lexInside) return { ok: false, path: candidate, reason: "escapes plugin root" };
  if (existsSync(candidate)) {
    try {
      const realRoot = realpathSync(root);
      const realCand = realpathSync(candidate);
      const realInside = realCand === realRoot || realCand.startsWith(realRoot + sep);
      if (!realInside) {
        return { ok: false, path: candidate, reason: "symlink escapes plugin root" };
      }
    } catch {
      return { ok: false, path: candidate, reason: "broken symlink" };
    }
  }
  return { ok: true, path: candidate, reason: null };
}

// Trigger heuristic for model-invocable skills: quoted wake phrase or explicit
// routing clause. Slash-only skills (`disable-model-invocation: true`) bypass
// this check.
export function hasTrigger(description) {
  const d = String(description ?? "");
  return (
    /"[^"]{2,}"/.test(d) ||
    /\b(?:use|invoke|run|trigger|activate)\s+(?:this\s+skill\s+)?(?:when|for|always|this|if|to)\b/i.test(
      d,
    ) ||
    /\bdon't\s+use\s+for\b/i.test(d)
  );
}

// Extracts the plugin-relative script path from a hook command line.
export function scriptPathOf(command) {
  const s = String(command ?? "");
  const clean = (p) => p.replace(/[;|&)]+$/, "");
  const pluginRootQuoted = /"\$\{?PLUGIN_ROOT\}?\/([^"]+)"/.exec(s);
  if (pluginRootQuoted) return pluginRootQuoted[1];
  const pluginRootPlain = /\$\{?PLUGIN_ROOT\}?\/([^\s"']+)/.exec(s);
  if (pluginRootPlain) return clean(pluginRootPlain[1]);

  const relQuoted = /(?:^|\s)"\.\/([^"]+)"/.exec(s);
  if (relQuoted) return relQuoted[1];
  const relSingle = /(?:^|\s)'\.\/([^']+)'/.exec(s);
  if (relSingle) return relSingle[1];
  const relPlain = /(?:^|\s)\.\/([^\s"']+)/.exec(s);
  if (relPlain) return clean(relPlain[1]);

  const bareNode = /\b(?:node|bash|sh|python3?)\s+(?:"(scripts\/[^"]+)"|'(scripts\/[^']+)'|(scripts\/[^\s"']+))/.exec(
    s,
  );
  if (bareNode) return clean(bareNode[1] ?? bareNode[2] ?? bareNode[3]);
  return null;
}

// Detects ${PLUGIN_ROOT}, $PLUGIN_ROOT, or ${CLAUDE_PLUGIN_ROOT} in hook
// commands (warned by `agy plugin validate --strict` since v1.5.6).
export function usesPluginRoot(command) {
  return /\$\{?(?:PLUGIN_ROOT|CLAUDE_PLUGIN_ROOT)\}?/.test(String(command ?? ""));
}

export function stripJsComments(source) {
  let out = "";
  let quote = null;
  let prevNonSpace = "";
  const REGEX_PRE = new Set([
    "",
    "(",
    "[",
    "{",
    ",",
    "=",
    ":",
    ";",
    "!",
    "?",
    "&",
    "|",
    "+",
    "-",
    "~",
    "^",
    "%",
    "\n",
  ]);

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += source[++i];
      } else if (ch === quote) {
        quote = null;
        prevNonSpace = ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      if (i < source.length) {
        out += "\n";
        prevNonSpace = "\n";
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      const closeIdx = source.indexOf("*/", i + 2);
      if (closeIdx !== -1) {
        i = closeIdx + 1;
        continue;
      }
    }
    // Skip regex literals so `/*` or `//` inside `/.../` isn't misread as a comment
    if (ch === "/" && REGEX_PRE.has(prevNonSpace)) {
      out += ch;
      let inClass = false;
      i += 1;
      while (i < source.length) {
        const rc = source[i];
        out += rc;
        if (rc === "\\" && i + 1 < source.length) {
          out += source[++i];
        } else if (rc === "[") {
          inClass = true;
        } else if (rc === "]") {
          inClass = false;
        } else if (rc === "/" && !inClass) {
          break;
        } else if (rc === "\n") {
          break;
        }
        i += 1;
      }
      prevNonSpace = "/";
      continue;
    }
    out += ch;
    if (ch === "\n") prevNonSpace = "\n";
    else if (!/\s/.test(ch)) prevNonSpace = ch;
  }
  return out;
}

// Heuristic: a hook script counts as fail-open when its executable code (not
// comments) routes through runHook(...) or wraps execution in try/catch.
export function isFailOpen(source, ext = ".mjs") {
  const src = String(source ?? "");
  if (ext === ".sh" || ext === ".bash") {
    return /\|\|\s*(?:echo|printf)\b/.test(src) || /\btrap\b/.test(src);
  }
  if (ext === ".py") {
    return /\btry\s*:[\s\S]*\bexcept\b/.test(src);
  }
  const code = stripJsComments(src);
  return (
    /\brunHook\s*\(/.test(code) ||
    /\btry\s*\{[\s\S]*\}\s*catch\b/.test(code) ||
    /\.catch\s*\(/.test(code)
  );
}

export function isValidHttpsUrl(raw) {
  if (typeof raw !== "string" || !raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && Boolean(u.hostname);
  } catch {
    return false;
  }
}

export function isGoogleHttpsLogo(raw) {
  if (!isValidHttpsUrl(raw)) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return GOOGLE_LOGO_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function readRegistryEntries(dir, filename, { ok, warn }) {
  const file = join(dir, filename);
  if (!isFile(file)) return [];
  const parsed = readJsonc(file);
  if (!parsed?.ok || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    ok(`${filename} parses`, false, parsed?.error ?? "invalid JSON object");
    return [];
  }
  const paths = [];
  for (const entry of parsed.data.entries ?? []) {
    if (typeof entry?.path !== "string" || !entry.path.trim()) {
      warn(`${filename} entry invalid`, "entry missing non-empty path");
      continue;
    }
    const checked = resolveInside(dir, entry.path);
    if (!checked.ok) {
      warn(`${filename} path escapes plugin root`, `${entry.path} (${checked.reason})`);
      continue;
    }
    if (!existsSync(checked.path)) {
      warn(`${filename} path missing`, entry.path);
      continue;
    }
    paths.push(checked.path);
  }
  return paths;
}
