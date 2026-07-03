import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../lib/frontmatter.mjs";

test("parses flat frontmatter and returns the body", () => {
  const { data, body } = parseFrontmatter(
    "---\nname: my-skill\ndescription: Use when the user says \"go\".\n---\n\n# Body\n",
  );
  assert.equal(data.name, "my-skill");
  assert.equal(data.description, 'Use when the user says "go".');
  assert.match(body, /^# Body/m);
});

test("returns data:null when frontmatter is absent", () => {
  assert.equal(parseFrontmatter("# Just markdown\n").data, null);
});

test("returns data:null when frontmatter is unterminated", () => {
  assert.equal(parseFrontmatter("---\nname: x\nno closing fence\n").data, null);
});

test("tolerates CRLF line endings", () => {
  const { data } = parseFrontmatter("---\r\nname: x\r\ndescription: y\r\n---\r\nbody");
  assert.equal(data.name, "x");
  assert.equal(data.description, "y");
});

test("keeps colons inside values and strips surrounding quotes", () => {
  const { data } = parseFrontmatter(
    '---\nurl: https://example.com/a:b\nquoted: "hello: world"\n---\n',
  );
  assert.equal(data.url, "https://example.com/a:b");
  assert.equal(data.quoted, "hello: world");
});

test("skips comments and blank lines inside the block", () => {
  const { data } = parseFrontmatter("---\n# comment\n\nname: x\n---\n");
  assert.deepEqual(data, { name: "x" });
});
