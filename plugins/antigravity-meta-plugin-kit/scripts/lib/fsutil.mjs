// Zero-dependency filesystem helpers and journaled mutations for --dry-run.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

// Every mutation goes through the journal so --dry-run prints the exact plan
// without touching the filesystem.
export function createJournal(dryRun) {
  const actions = [];
  return {
    actions,
    dryRun,
    record(type, target, apply) {
      actions.push({ type, target });
      if (!dryRun) apply();
    },
  };
}

export function stripBom(text) {
  const s = String(text ?? "");
  return s.startsWith("\uFEFF") ? { text: s.slice(1), hasBom: true } : { text: s, hasBom: false };
}

// Parses JSON and JSONC (single-line //, block /* */, and trailing commas).
// Reports both strict JSON validity (required by `agy plugin install` and
// `hooks.json`) and JSONC validity (accepted by `mcp_config.json` and runtime
// `plugin.json`).
export function parseJsonc(raw) {
  const { text, hasBom } = stripBom(raw);
  try {
    return {
      ok: true,
      strictOk: true,
      hasJsoncSyntax: false,
      hasBom,
      data: JSON.parse(text),
      error: null,
    };
  } catch (strictErr) {
    // Strip comments outside string literals
    let out = "";
    let inString = false;
    let escaped = false;
    let sawComment = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inString) {
        out += ch;
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        out += ch;
      } else if (ch === "/" && next === "/") {
        sawComment = true;
        i += 2;
        while (i < text.length && text[i] !== "\n") i += 1;
        if (i < text.length) out += "\n";
      } else if (ch === "/" && next === "*") {
        sawComment = true;
        i += 2;
        while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
          if (text[i] === "\n") out += "\n";
          i += 1;
        }
        i += 1;
      } else {
        out += ch;
      }
    }

    // Strip trailing commas before } or ] outside string literals
    let cleaned = "";
    inString = false;
    escaped = false;
    let sawTrailingComma = false;
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      if (inString) {
        cleaned += ch;
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        cleaned += ch;
        continue;
      }
      if (ch === ",") {
        let j = i + 1;
        while (j < out.length && /\s/.test(out[j])) j += 1;
        if (out[j] === "}" || out[j] === "]") {
          sawTrailingComma = true;
          continue;
        }
      }
      cleaned += ch;
    }

    try {
      return {
        ok: true,
        strictOk: false,
        hasJsoncSyntax: sawComment || sawTrailingComma,
        hasBom,
        data: JSON.parse(cleaned),
        error: null,
      };
    } catch (jsoncErr) {
      return {
        ok: false,
        strictOk: false,
        hasJsoncSyntax: sawComment || sawTrailingComma,
        hasBom,
        data: null,
        error: strictErr.message || jsoncErr.message,
      };
    }
  }
}

export function readJsonc(file) {
  if (!existsSync(file)) return null;
  return parseJsonc(readFileSync(file, "utf8"));
}

export function readJson(file, fallback = null) {
  try {
    if (!existsSync(file)) return fallback;
    const { text } = stripBom(readFileSync(file, "utf8"));
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function writeFile(journal, file, text, opts = {}) {
  journal.record("write", file, () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    if (typeof opts.mode === "number") {
      try {
        chmodSync(file, opts.mode);
      } catch {}
    }
  });
}

export function copyFile(journal, from, to) {
  journal.record("copy", `${from} -> ${to}`, () => {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  });
}
