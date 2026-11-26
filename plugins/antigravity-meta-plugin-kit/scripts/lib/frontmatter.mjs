// Zero-dependency YAML subset parser for Antigravity Markdown frontmatter
// (SKILL.md, agents/*.md, rules/*.md). Supports multiline block scalars
// (> / >- / >+ / | / |- / |+), flow arrays ([a, b]), block arrays (both
// indented and 0-indent `- item` and `- key: val` objects), 1-level nested
// maps, booleans, numbers, quotes, inline comments, UTF-8 BOM, and CRLF.

function isProperlyQuoted(s) {
  if (typeof s !== "string" || s.length < 2) return false;
  const q = s[0];
  if (q !== '"' && q !== "'") return false;
  for (let i = 1; i < s.length; i++) {
    const ch = s[i];
    if (q === '"' && ch === "\\") {
      i += 1;
      continue;
    }
    if (q === "'" && ch === "'" && s[i + 1] === "'") {
      i += 1;
      continue;
    }
    if (ch === q) {
      return i === s.length - 1;
    }
  }
  return false;
}

function stripInlineComment(raw) {
  let quote = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (quote === '"' && ch === "\\") {
        i += 1;
        continue;
      }
      if (quote === "'" && ch === "'" && raw[i + 1] === "'") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    // Only open quote mode at token start so mid-word apostrophes ("Don't") stay plain text
    if ((ch === '"' || ch === "'") && (i === 0 || /[\s,\[{]/.test(raw[i - 1]))) {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/.test(raw[i - 1]))) {
      return raw.slice(0, i).trimEnd();
    }
  }
  return raw.trimEnd();
}

function parseScalar(raw) {
  const s = stripInlineComment(raw).trim();
  if (s === "" || s === "null" || s === "~") return s === "" ? "" : null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith('"') && isProperlyQuoted(s)) {
    return s
      .slice(1, -1)
      .replace(/\\(["\\ntr])/g, (_, c) =>
        c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c,
      );
  }
  if (s.startsWith("'") && isProperlyQuoted(s)) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    return parseFlowArray(s.slice(1, -1));
  }
  return s;
}

function parseFlowArray(inner) {
  const trimmed = inner.trim();
  if (!trimmed) return [];
  const items = [];
  let cur = "";
  let quote = null;
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      cur += ch;
      if (quote === '"' && ch === "\\" && i + 1 < inner.length) {
        cur += inner[++i];
      } else if (quote === "'" && ch === "'" && inner[i + 1] === "'") {
        cur += inner[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    // Only enter quoted item mode when quote opens the element (not mid-word apostrophes)
    if ((ch === '"' || ch === "'") && cur.trim() === "") {
      quote = ch;
      cur += ch;
    } else if (ch === "[" || ch === "{") {
      depth += 1;
      cur += ch;
    } else if (ch === "]" || ch === "}") {
      depth -= 1;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      if (cur.trim()) items.push(parseScalar(cur));
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) items.push(parseScalar(cur));
  return items;
}

function foldBlockLines(lines, style, chomp) {
  let baseIndent = Infinity;
  for (const l of lines) {
    if (l.trim().length > 0) {
      const m = /^([ \t]*)/.exec(l);
      baseIndent = Math.min(baseIndent, m[1].length);
    }
  }
  if (!Number.isFinite(baseIndent)) return "";
  const stripped = lines.map((l) =>
    l.trim().length === 0 ? "" : l.slice(baseIndent),
  );

  let end = stripped.length;
  while (end > 0 && stripped[end - 1] === "") end -= 1;
  const content = stripped.slice(0, end);
  const trailingBlanks = stripped.length - end;

  let text;
  if (style === "|") {
    text = content.join("\n");
  } else {
    const out = [];
    let i = 0;
    while (i < content.length) {
      const line = content[i];
      if (line === "") {
        let blanks = 0;
        while (i < content.length && content[i] === "") {
          blanks += 1;
          i += 1;
        }
        out.push("\n".repeat(blanks));
        continue;
      }
      const isMoreIndented = /^[ \t]/.test(line);
      if (out.length > 0) {
        const prev = out[out.length - 1];
        const prevWasNewlines = /^\n+$/.test(prev);
        const prevWasMoreIndented = !prevWasNewlines && /^[ \t]/.test(prev);
        if (!prevWasNewlines) {
          out.push(isMoreIndented || prevWasMoreIndented ? "\n" : " ");
        }
      }
      out.push(line);
      i += 1;
    }
    text = out.join("");
  }

  if (chomp === "-") return text;
  if (chomp === "+") return text + "\n" + "\n".repeat(trailingBlanks);
  return text ? text + "\n" : "";
}

function indentOf(line) {
  let n = 0;
  while (n < line.length && line[n] === " ") n += 1;
  return n;
}

function splitKeyValue(line) {
  const m = /^([A-Za-z0-9_.-]+)[ \t]*:(?:[ \t]+(.*)|[ \t]*)$/.exec(line);
  if (!m) return null;
  return { key: m[1], rest: m[2] ?? "" };
}

export function parseFrontmatter(text) {
  let normalized = String(text ?? "");
  if (normalized.startsWith("\uFEFF")) normalized = normalized.slice(1);
  normalized = normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const openMatch = /^---[ \t]*\n/.exec(normalized);
  if (!openMatch) {
    return {
      data: null,
      body: normalized,
      rawFrontmatter: null,
      bodyBytes: Buffer.byteLength(normalized, "utf8"),
      warnings: [],
    };
  }

  const afterOpen = normalized.slice(openMatch[0].length);
  const emptyClose = /^---[ \t]*(?:\n|$)/.exec(afterOpen);
  if (emptyClose) {
    const body = afterOpen.slice(emptyClose[0].length);
    return {
      data: {},
      body,
      rawFrontmatter: "",
      bodyBytes: Buffer.byteLength(body, "utf8"),
      warnings: [],
    };
  }

  const closeMatch = /\n---[ \t]*(?:\n|$)/.exec(afterOpen);
  if (!closeMatch) {
    return {
      data: null,
      body: normalized,
      rawFrontmatter: null,
      bodyBytes: Buffer.byteLength(normalized, "utf8"),
      warnings: [],
    };
  }

  const rawFrontmatter = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length);
  const lines = rawFrontmatter.split("\n");
  const data = {};
  const warnings = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i += 1;
      continue;
    }
    if (indentOf(line) > 0) {
      warnings.push(`unexpected indentation on frontmatter line ${i + 1}`);
      i += 1;
      continue;
    }
    const kv = splitKeyValue(line);
    if (!kv) {
      warnings.push(`unrecognized frontmatter line ${i + 1}: ${line.trim()}`);
      i += 1;
      continue;
    }
    const { key } = kv;
    const rawRest = stripInlineComment(kv.rest).trim();

    // Multiline block scalar (> / >- / >+ / | / |- / |+)
    const blockMatch = /^([>|])([-+]?)$/.exec(rawRest);
    if (blockMatch) {
      const [, style, chomp] = blockMatch;
      const blockLines = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (next.trim() === "" || indentOf(next) > 0) {
          blockLines.push(next);
          i += 1;
        } else {
          break;
        }
      }
      data[key] = foldBlockLines(blockLines, style, chomp);
      continue;
    }

    // Empty value -> check for block sequence (0-indent OR indented) or indented 1-level map
    if (rawRest === "") {
      let j = i + 1;
      while (j < lines.length && (!lines[j].trim() || lines[j].trimStart().startsWith("#"))) {
        j += 1;
      }
      if (j < lines.length) {
        const childIndent = indentOf(lines[j]);
        const firstTrimmed = lines[j].trimStart();
        const isSeqStart = firstTrimmed.startsWith("- ") || firstTrimmed === "-";
        if (isSeqStart) {
          const seq = [];
          i = j;
          while (i < lines.length) {
            const cur = lines[i];
            if (!cur.trim() || cur.trimStart().startsWith("#")) {
              i += 1;
              continue;
            }
            const ind = indentOf(cur);
            if (ind < childIndent) break;
            const trimmed = cur.trimStart();
            if (ind === childIndent && (trimmed.startsWith("- ") || trimmed === "-")) {
              const afterDash = trimmed.slice(1).trim();
              const objKv = afterDash ? splitKeyValue(afterDash) : null;
              if (objKv) {
                const obj = { [objKv.key]: parseScalar(objKv.rest) };
                i += 1;
                while (i < lines.length) {
                  const sub = lines[i];
                  if (!sub.trim() || sub.trimStart().startsWith("#")) {
                    i += 1;
                    continue;
                  }
                  const subInd = indentOf(sub);
                  if (subInd <= childIndent) break;
                  const subKv = splitKeyValue(sub.trimStart());
                  if (subKv) obj[subKv.key] = parseScalar(subKv.rest);
                  i += 1;
                }
                seq.push(obj);
              } else {
                seq.push(parseScalar(afterDash));
                i += 1;
              }
            } else {
              break;
            }
          }
          data[key] = seq;
          continue;
        }

        if (childIndent > 0) {
          const map = {};
          i = j;
          while (i < lines.length) {
            const cur = lines[i];
            if (!cur.trim() || cur.trimStart().startsWith("#")) {
              i += 1;
              continue;
            }
            if (indentOf(cur) < childIndent) break;
            const subKv = splitKeyValue(cur.trimStart());
            if (subKv) map[subKv.key] = parseScalar(subKv.rest);
            i += 1;
          }
          data[key] = map;
          continue;
        }
      }
      data[key] = "";
      i += 1;
      continue;
    }

    const startsQuote = rawRest.startsWith('"') || rawRest.startsWith("'");
    const properlyQuoted = isProperlyQuoted(rawRest);
    if (startsQuote && !properlyQuoted) {
      warnings.push(`malformed quotes in "${key}" value — wrap the entire value in matching quotes`);
    } else if (!properlyQuoted && !rawRest.startsWith("[") && /:\s/.test(rawRest)) {
      warnings.push(
        `unquoted ": " inside "${key}" value — wrap in quotes or use a >- block scalar`,
      );
    }
    data[key] = parseScalar(kv.rest);
    i += 1;
  }

  return {
    data,
    body,
    rawFrontmatter,
    bodyBytes: Buffer.byteLength(body, "utf8"),
    warnings,
  };
}
