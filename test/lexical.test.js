"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml, buildContentFields, summarize, MAX_ITEMS } = require("../src/lexical.ts");

test("escapeHtml escapes &, <, >", () => {
  assert.equal(escapeHtml("a & <b> c"), "a &amp; &lt;b&gt; c");
  assert.equal(escapeHtml(42), "42");
});

test("buildContentFields: lexical passes through unchanged, no source", () => {
  assert.deepEqual(buildContentFields({ lexical: "X" }), { body: { lexical: "X" } });
});

test("buildContentFields: mobiledoc passes through unchanged, no source", () => {
  assert.deepEqual(buildContentFields({ mobiledoc: "M" }), { body: { mobiledoc: "M" } });
});

test("buildContentFields: html sets body.html + source=html", () => {
  assert.deepEqual(buildContentFields({ html: "<p>h</p>" }), { body: { html: "<p>h</p>" }, source: "html" });
});

test("buildContentFields: plain content wrapped as HTML paragraphs with source=html", () => {
  const out = buildContentFields({ content: "hello" });
  assert.equal(out.source, "html");
  assert.equal(out.body.html, "<p>hello</p>");
});

test("buildContentFields: content escapes HTML special chars", () => {
  const out = buildContentFields({ content: "a & <b>" });
  assert.equal(out.body.html, "<p>a &amp; &lt;b&gt;</p>");
});

test("buildContentFields: content double-newline splits into multiple <p>", () => {
  const out = buildContentFields({ content: "para one\n\npara two" });
  assert.equal(out.body.html, "<p>para one</p><p>para two</p>");
});

test("buildContentFields: content single newline becomes <br/>", () => {
  const out = buildContentFields({ content: "line1\nline2" });
  assert.equal(out.body.html, "<p>line1<br/>line2</p>");
});

test("buildContentFields: empty args yields empty body", () => {
  assert.deepEqual(buildContentFields({}), { body: {} });
});

test("buildContentFields: lexical wins over mobiledoc/html/content", () => {
  assert.deepEqual(
    buildContentFields({ lexical: "X", mobiledoc: "M", html: "<p>h</p>", content: "c" }),
    { body: { lexical: "X" } },
  );
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
