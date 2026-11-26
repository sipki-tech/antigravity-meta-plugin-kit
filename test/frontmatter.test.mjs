import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../plugins/antigravity-meta-plugin-kit/scripts/lib/frontmatter.mjs";

test("parses flat frontmatter, returns body and bodyBytes", () => {
  const { data, body, bodyBytes, warnings } = parseFrontmatter(
    '---\nname: my-skill\ndescription: Use when the user says "go".\n---\n\n# Body\n',
  );
  assert.equal(data.name, "my-skill");
  assert.equal(data.description, 'Use when the user says "go".');
  assert.match(body, /^# Body/m);
  assert.equal(bodyBytes, Buffer.byteLength(body, "utf8"));
  assert.deepEqual(warnings, []);
});

test("returns data:null when frontmatter is absent or unterminated", () => {
  assert.equal(parseFrontmatter("# Just markdown\n").data, null);
  assert.equal(parseFrontmatter("---\nname: x\nno closing fence\n").data, null);
});

test("handles empty frontmatter, UTF-8 BOM, CRLF, and trailing spaces on fences", () => {
  const empty = parseFrontmatter("\uFEFF---  \r\n---  \r\n# Hello\r\n");
  assert.deepEqual(empty.data, {});
  assert.equal(empty.body, "# Hello\n");

  const crlf = parseFrontmatter("\uFEFF---\r\nname: x\r\ndescription: y\r\n---\r\nbody");
  assert.equal(crlf.data.name, "x");
  assert.equal(crlf.data.description, "y");
  assert.equal(crlf.body, "body");
});

test("parses multiline folded (>- / >) and literal (|- / |) block scalars", () => {
  const folded = parseFrontmatter(
    "---\nname: s1\ndescription: >-\n  Line one\n  line two.\n\n  Paragraph two.\n---\nBody\n",
  );
  assert.equal(folded.data.description, "Line one line two.\nParagraph two.");

  const literal = parseFrontmatter(
    "---\nname: s2\ndescription: |-\n  Line A\n  Line B\n---\nBody\n",
  );
  assert.equal(literal.data.description, "Line A\nLine B");

  const clip = parseFrontmatter("---\nname: s3\ndescription: >\n  Hello\n  world\n---\n");
  assert.equal(clip.data.description, "Hello world\n");
});

test("parses flow arrays, block arrays, object arrays, and 1-level nested maps", () => {
  const doc = `---
name: auditor
subagent: true
mainAgent: false
timeout: 15
tools:
  - read_file
  - run_command
tags: [one, "two, three", 'four']
metadata:
  icon: assets/icon.svg
  version: 2
mcpServers:
  - name: local
    command: node
---
Body
`;
  const { data } = parseFrontmatter(doc);
  assert.equal(data.subagent, true);
  assert.equal(data.mainAgent, false);
  assert.equal(data.timeout, 15);
  assert.deepEqual(data.tools, ["read_file", "run_command"]);
  assert.deepEqual(data.tags, ["one", "two, three", "four"]);
  assert.deepEqual(data.metadata, { icon: "assets/icon.svg", version: 2 });
  assert.deepEqual(data.mcpServers, [{ name: "local", command: "node" }]);
});

test("keeps colons inside URLs/quoted strings, strips inline comments, warns on unquoted ': '", () => {
  const { data, warnings } = parseFrontmatter(
    '---\nurl: https://example.com/a:b # comment\nquoted: "hello: world" # trailing\nunquoted: Role: auditor\n---\n',
  );
  assert.equal(data.url, "https://example.com/a:b");
  assert.equal(data.quoted, "hello: world");
  assert.equal(data.unquoted, "Role: auditor");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unquoted ": "/);
});

test("supports 0-indent YAML sequences, mid-word apostrophes, and flags malformed quotes", () => {
  const zeroIndent = parseFrontmatter(
    "---\nname: a1\ndescription: Don't use for backend # inline note\ntools:\n- read_file\n- edit_file\ntags: [don't, ok]\nmodel: inherit\n---\nBody\n",
  );
  assert.deepEqual(zeroIndent.warnings, []);
  assert.equal(zeroIndent.data.description, "Don't use for backend");
  assert.deepEqual(zeroIndent.data.tools, ["read_file", "edit_file"]);
  assert.deepEqual(zeroIndent.data.tags, ["don't", "ok"]);
  assert.equal(zeroIndent.data.model, "inherit");

  const badQuotes = parseFrontmatter('---\nname: x\ndescription: "a" b "c": d\n---\n');
  assert.ok(
    badQuotes.warnings.some((w) => /malformed quotes/.test(w)),
    JSON.stringify(badQuotes.warnings),
  );
  assert.equal(badQuotes.data.description, '"a" b "c": d');
});
