// Minimal flat frontmatter parser. Antigravity SKILL.md and workflow files use
// only flat `key: value` pairs, so a full YAML parser would break the
// zero-dependency policy for nothing.
export function parseFrontmatter(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(\n|$)/);
  if (!match) return { data: null, body: normalized };
  const data = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body: normalized.slice(match[0].length) };
}
