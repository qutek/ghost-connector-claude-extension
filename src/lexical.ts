"use strict";

// ---- Content body helpers ----
// Ghost Admin API converts HTML -> Lexical server-side when the request
// is sent with ?source=html (see admin-api/posts/creating-a-post.mdx).
// We no longer build Lexical JSON client-side.

export interface LexicalTextNode {
  type: "text";
  version: 1;
  text: string;
  format: 0;
  detail: 0;
  mode: "normal";
  style: string;
}

export interface LexicalLineBreakNode {
  type: "linebreak";
  version: 1;
}

export interface LexicalParagraphNode {
  type: "paragraph";
  version: 1;
  children: Array<LexicalTextNode | LexicalLineBreakNode>;
}

export interface LexicalRootNode {
  type: "root";
  children: LexicalParagraphNode[];
  direction: "ltr";
  format: "";
  indent: 0;
  version: 1;
}

export interface LexicalDocument {
  root: LexicalRootNode;
}

export interface ContentArgs {
  lexical?: string;
  mobiledoc?: string;
  html?: string;
  content?: string;
}

export type ContentFields =
  | { lexical: string }
  | { mobiledoc: string }
  | {};

export const MAX_ITEMS = 50;

export function escapeHtml(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textNode(text: string): LexicalTextNode {
  return { type: "text", version: 1, text, format: 0, detail: 0, mode: "normal", style: "" };
}

function lineBreak(): LexicalLineBreakNode {
  return { type: "linebreak", version: 1 };
}

function emptyParagraph(): LexicalParagraphNode {
  return { type: "paragraph", version: 1, children: [] };
}


// Inline tags Ghost's Lexical renderer understands within text nodes.


export interface BuiltContent {
  body: ContentFields;
  source?: "html";
}

// Returns body fields + optional `source` query param. Plain `content`
// (markdown/text) is wrapped in <p> tags and sent as HTML; Ghost performs
// server-side conversion to Lexical.
export function buildContentFields(args: ContentArgs): BuiltContent {
  if (args.lexical) return { body: { lexical: args.lexical } };
  if (args.mobiledoc) return { body: { mobiledoc: args.mobiledoc } };
  if (args.html) return { body: { html: args.html }, source: "html" };
  if (args.content) {
    const html = String(args.content)
      .split(/\n\n+/)
      .map((blk) => `<p>${blk.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`)
      .join("");
    return { body: { html }, source: "html" };
  }
  return { body: {} };
}

export interface SummaryItem {
  id?: string;
  name?: string;
  slug?: string;
  title?: string;
  email?: string;
  status?: string;
  visibility?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface SummarizedResult {
  count: number;
  truncated: boolean;
  [collection: string]: number | boolean | SummaryItem[];
}

export function summarize(collection: string, items: SummaryItem[] | null | undefined): SummarizedResult {
  const list = items || [];
  const out = list.slice(0, MAX_ITEMS).map((it) => {
    const o: SummaryItem = { id: it.id };
    if (it.name) o.name = it.name;
    if (it.slug) o.slug = it.slug;
    if (it.title) o.title = it.title;
    if (it.email) o.email = it.email;
    if (it.status) o.status = it.status;
    if (it.visibility) o.visibility = it.visibility;
    if (it.updated_at) o.updated_at = it.updated_at;
    return o;
  });
  return { count: list.length, truncated: list.length > MAX_ITEMS, [collection]: out };
}
