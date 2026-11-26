import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function headingsOf(md) {
  const out = [];
  let inFence = false;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (/^```/.test(line.trimStart())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+/.exec(line);
    if (m) out.push(m[1].length);
  }
  return out;
}

const STALE_PATTERNS = [
  /SessionStart does not exist/i,
  /npx github:sipki-tech\/antigravity-meta-plugin-kit/,
  /\bmodel:\s*gemini-3\.1-pro\b/,
  /\bmodel:\s*gemini-3\.5-flash\b(?!-lite)/,
  /terminationReason\s*===?\s*["']model_stop["']/,
  /["']?allow_tool["']?\s*:/,
  /\bAgent Plugins 1\.0\.0\b/i,
  /\bgemini-extension\.json\b/,
  /\bwalkthrough-guard\b/,
  /drop in 0\.3\.0/i,
];

test("EN and RU documentation pairs maintain identical heading levels and valid .ru.md cross-links", () => {
  const pairs = [["README.md", "README.ru.md"]];
  const guidesDir = join(ROOT, "docs", "guides");
  for (const f of readdirSync(guidesDir).sort()) {
    if (f.endsWith(".md") && !f.endsWith(".ru.md")) {
      pairs.push([join("docs/guides", f), join("docs/guides", f.replace(/\.md$/, ".ru.md"))]);
    }
  }

  for (const [enRel, ruRel] of pairs) {
    const enPath = join(ROOT, enRel);
    const ruPath = join(ROOT, ruRel);
    assert.ok(existsSync(ruPath), `missing Russian mirror: ${ruRel}`);
    const en = readFileSync(enPath, "utf8");
    const ru = readFileSync(ruPath, "utf8");
    assert.deepEqual(
      headingsOf(ru),
      headingsOf(en),
      `heading structure mismatch between ${enRel} and ${ruRel}`,
    );

    // Russian docs standardize on "субагент" (not "сабагент")
    assert.equal(
      /сабагент/i.test(ru),
      false,
      `${ruRel} uses non-standard spelling "сабагент" — use "субагент"`,
    );

    // Verify every relative file link resolves to an existing file on disk
    for (const [label, mdPath, text] of [
      [enRel, enPath, en],
      [ruRel, ruPath, ru],
    ]) {
      let inFence = false;
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/^```/.test(lines[i].trimStart())) {
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;
        const stripped = lines[i].replace(/`[^`]*`/g, "");
        for (const m of stripped.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
          const target = m[1].trim();
          if (/^(?:https?:\/\/|mailto:|customization:\/\/|#)/i.test(target)) continue;
          const resolved = join(dirname(mdPath), target);
          assert.ok(existsSync(resolved), `${label}:${i + 1} broken relative link: ${target}`);
        }
        for (const m of stripped.matchAll(/\b(?:src|srcset|href)="([^"#]+)(?:#[^"]*)?"/g)) {
          const target = m[1].trim();
          if (/^(?:https?:\/\/|mailto:|customization:\/\/|#)/i.test(target)) continue;
          const resolved = join(dirname(mdPath), target);
          assert.ok(existsSync(resolved), `${label}:${i + 1} broken HTML asset/link: ${target}`);
        }
      }
    }

    // Every internal guide link inside a Russian doc (outside the top EN|RU switcher
    // and outside the Guides index table) must point to .ru.md when a sibling exists.
    if (ruRel !== "README.ru.md") {
      const lines = ru.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i < 5) continue; // language switcher line
        for (const m of lines[i].matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)) {
          const target = m[1];
          if (/^https?:\/\//.test(target) || target.endsWith(".ru.md")) continue;
          const resolved = join(dirname(ruPath), target);
          const ruSibling = resolved.replace(/\.md$/, ".ru.md");
          assert.equal(
            existsSync(ruSibling),
            false,
            `${ruRel}:${i + 1} links to English ${target} while ${target.replace(/\.md$/, ".ru.md")} exists`,
          );
        }
      }
    } else {
      // Check README.ru.md prose links outside the Guides table & switcher
      const lines = ru.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i < 30 || lines[i].startsWith("|")) continue;
        for (const m of lines[i].matchAll(/\]\((docs\/guides\/[^)#]+\.md)\)/g)) {
          const target = m[1];
          assert.ok(
            target.endsWith(".ru.md"),
            `README.ru.md:${i + 1} links to English ${target}`,
          );
        }
      }
    }
  }
});

test("docs, skills, agents, and templates contain no obsolete 1.1.1 / broken patterns", () => {
  const filesToScan = [
    "README.md",
    "README.ru.md",
    "CONTRIBUTING.md",
    "docs/internals.md",
  ];
  const walk = (relDir) => {
    const abs = join(ROOT, relDir);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const child = join(relDir, e.name);
      if (e.isDirectory()) walk(child);
      else if (/\.(md|mjs|json)$/.test(e.name)) filesToScan.push(child);
    }
  };
  walk("docs/guides");
  walk("plugins/antigravity-meta-plugin-kit/skills");
  walk("plugins/antigravity-meta-plugin-kit/agents");
  walk("plugins/antigravity-meta-plugin-kit/rules");
  walk("plugins/antigravity-meta-plugin-kit/scripts/templates");

  const hits = [];
  for (const rel of filesToScan) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    for (const re of STALE_PATTERNS) {
      if (re.test(text)) hits.push(`${rel} matched ${re}`);
    }
  }
  assert.deepEqual(hits, [], `stale patterns found:\n${hits.join("\n")}`);
});
