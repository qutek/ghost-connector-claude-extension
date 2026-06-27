"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml, textToLexical, htmlToLexical, buildContentFields, summarize, MAX_ITEMS } = require("../src/lexical.ts");

test("escapeHtml escapes &, <, >", () => {
  assert.equal(escapeHtml("a & <b> c"), "a &amp; &lt;b&gt; c");
  assert.equal(escapeHtml(42), "42");
});

test("textToLexical: single paragraph", () => {
  const out = textToLexical("hello");
  assert.equal(out.root.type, "root");
  assert.equal(out.root.children.length, 1);
  const p = out.root.children[0];
  assert.equal(p.type, "paragraph");
  assert.equal(p.children[0].text, "hello");
});

test("textToLexical: double newline splits paragraphs", () => {
  const out = textToLexical("para one\n\npara two");
  assert.equal(out.root.children.length, 2);
  assert.equal(out.root.children[0].children[0].text, "para one");
  assert.equal(out.root.children[1].children[0].text, "para two");
});

test("textToLexical: single newline becomes linebreak node", () => {
  const out = textToLexical("line1\nline2");
  const kids = out.root.children[0].children;
  assert.equal(kids.length, 3);
  assert.equal(kids[0].text, "line1");
  assert.equal(kids[1].type, "linebreak");
  assert.equal(kids[2].text, "line2");
});

test("textToLexical: empty input yields single empty paragraph", () => {
  const out = textToLexical("");
  assert.equal(out.root.children.length, 1);
  assert.equal(out.root.children[0].children.length, 0);
});

test("textToLexical: blank lines collapsed, empty paras dropped", () => {
  const out = textToLexical("a\n\n\n\nb");
  assert.equal(out.root.children.length, 2);
});

test("textToLexical: crlf normalized", () => {
  const out = textToLexical("a\r\n\r\nb");
  assert.equal(out.root.children.length, 2);
});

test("htmlToLexical: block tags split paragraphs", () => {
  const out = htmlToLexical("<p>one</p><p>two</p>");
  assert.equal(out.root.children.length, 2);
  assert.equal(out.root.children[0].children[0].text, "one");
  assert.equal(out.root.children[1].children[0].text, "two");
});

test("htmlToLexical: empty input yields empty paragraph", () => {
  const out = htmlToLexical("");
  assert.equal(out.root.children.length, 1);
  assert.equal(out.root.children[0].children.length, 0);
});

test("buildContentFields: priority lexical > mobiledoc > html > content", () => {
  assert.deepEqual(buildContentFields({ lexical: "X" }), { lexical: "X" });
  assert.deepEqual(buildContentFields({ mobiledoc: "M" }), { mobiledoc: "M" });
  assert.deepEqual(buildContentFields({ html: "<p>h</p>" }), { lexical: JSON.stringify(htmlToLexical("<p>h</p>")) });
  assert.deepEqual(buildContentFields({ content: "c" }), { lexical: JSON.stringify(textToLexical("c")) });
  assert.deepEqual(buildContentFields({}), {});
});

test("buildContentFields: lexical wins over mobiledoc", () => {
  assert.deepEqual(buildContentFields({ lexical: "X", mobiledoc: "M", html: "<p>h</p>" }), { lexical: "X" });
});

test("summarize: truncates to MAX_ITEMS and reports count/truncated", () => {
  const items = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ id: String(i), title: `t${i}` }));
  const out = summarize("posts", items);
  assert.equal(out.count, MAX_ITEMS + 5);
  assert.equal(out.truncated, true);
  assert.equal(out.posts.length, MAX_ITEMS);
  assert.equal(out.posts[0].id, "0");
});

test("summarize: picks known fields, ignores unknown", () => {
  const out = summarize("tags", [{ id: "1", name: "n", slug: "s", title: "t", extra: "x" }]);
  assert.deepEqual(out.tags[0], { id: "1", name: "n", slug: "s", title: "t" });
});

test("summarize: empty list safe", () => {
  const out = summarize("tags", []);
  assert.equal(out.count, 0);
  assert.equal(out.truncated, false);
  assert.deepEqual(out.tags, []);
});

test("summarize: null/undefined list safe", () => {
  const out = summarize("tags", null);
  assert.equal(out.count, 0);
  assert.deepEqual(out.tags, []);
});

test("htmlToLexical: preserves inline tags (strong, em, a, code)", () => {
  const out = htmlToLexical("<p>hello <strong>world</strong></p>");
  const text = out.root.children[0].children[0].text;
  assert.equal(text, "hello <strong>world</strong>");
});

test("htmlToLexical: preserves anchor tags with href", () => {
  const out = htmlToLexical('<p><a href="https://x.com">link</a> text</p>');
  const text = out.root.children[0].children[0].text;
  assert.equal(text, '<a href="https://x.com">link</a> text');
});

test("htmlToLexical: strips block-level wrappers but keeps content", () => {
  const out = htmlToLexical("<div><h1>Title</h1><p>Body</p></div>");
  // h1 and p close tags split paragraphs; div wrapper tags removed
  assert.ok(out.root.children.length >= 1);
  const joined = out.root.children.map((p) => p.children.map((c) => c.text || "").join("")).join("|");
  assert.ok(joined.includes("Title"));
  assert.ok(joined.includes("Body"));
  assert.ok(!joined.includes("<div"), "div wrapper stripped");
  assert.ok(!joined.includes("<h1>"), "h1 wrapper stripped");
});
