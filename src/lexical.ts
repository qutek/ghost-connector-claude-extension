"use strict";

// ---- Lexical helpers (Ghost v6+ uses Lexical editor format) ----
// Ghost Admin API does NOT auto-convert html on input. We escape user
// text and build a minimal tree.

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

export function textToLexical(text: string): LexicalDocument {
  const paragraphs = String(text).replace(/\r\n/g, "\n").split(/\n\n+/);
  const children = paragraphs
    .map((p): LexicalParagraphNode => {
      const lines = p.split("\n");
      const kids: Array<LexicalTextNode | LexicalLineBreakNode> = [];
      lines.forEach((line, i) => {
        if (line.length > 0) kids.push(textNode(line));
        if (i < lines.length - 1) kids.push(lineBreak());
      });
      return { type: "paragraph", version: 1, children: kids };
    })
    .filter((p) => p.children.length > 0);
  if (children.length === 0) children.push(emptyParagraph());
  return { root: { type: "root", children, direction: "ltr", format: "", indent: 0, version: 1 } };
}

// Inline tags Ghost's Lexical renderer understands within text nodes.

export function htmlToLexical(html: string): LexicalDocument {
  const block = /<\/(?:p|div|h[1-6]|li|ul|ol|blockquote|pre|hr|br)\s*>/i;
  const chunks = String(html)
    .split(block)
    .map((c) => c.replace(/^\s+|\s+$/g, ""))
    .filter(Boolean);
  const children = chunks
    .map((chunk): LexicalParagraphNode => {
      // Strip block-level wrappers but keep inline HTML intact for Ghost to render.
      const cleaned = chunk
        .replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote)\b[^>]*>/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      return { type: "paragraph", version: 1, children: cleaned.length ? [textNode(cleaned)] : [] };
    })
    .filter((p) => p.children.length > 0);
  if (children.length === 0) children.push(emptyParagraph());
  return { root: { type: "root", children, direction: "ltr", format: "", indent: 0, version: 1 } };
}

export function buildContentFields(args: ContentArgs): ContentFields {
  if (args.lexical) return { lexical: args.lexical };
  if (args.mobiledoc) return { mobiledoc: args.mobiledoc };
  if (args.html) return { lexical: JSON.stringify(htmlToLexical(args.html)) };
  if (args.content) return { lexical: JSON.stringify(textToLexical(args.content)) };
  return {};
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
