"use strict";
import crypto from "node:crypto";

// Ghost Admin API key format: {key_id}:{hex_secret}
// Returns a Ghost-format JWT good for 5 minutes.

const KEY_RE = /^[0-9a-f]{24}:[0-9a-f]{64}$/i;

export function makeToken(adminKey: string): string {
  const [id, secret] = adminKey.split(":");
  if (!id || !secret) {
    throw new Error("Invalid Ghost Admin API key. Expected '<id>:<secret>'.");
  }
  const header = { alg: "HS256" as const, typ: "JWT" as const, kid: id };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iat, exp: iat + 5 * 60, aud: "/admin/" };
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto
    .createHmac("sha256", Buffer.from(secret, "hex"))
    .update(signingInput)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${signingInput}.${sig}`;
}

export function validateKeyFormat(adminKey: string): void {
  if (!KEY_RE.test(adminKey)) {
    throw new Error(
      "Invalid Ghost Admin API key format. Expected '<24hex_id>:<64hex_secret>' (from Ghost Admin → Integrations → Custom Integration)."
    );
  }
}

export function normalizeBase(blogUrl: string | undefined): string {
  if (!blogUrl) throw new Error("Missing Ghost blog URL.");
  let u = String(blogUrl).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface GhostClientOptions {
  blogUrl: string | undefined;
  adminKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GhostApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly context?: unknown;
  constructor(message: string, status: number, code?: string, context?: unknown) {
    super(message);
    this.name = "GhostApiError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

/** @deprecated use GhostApiError */
export type GhostError = GhostApiError;

interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  formData?: FormData;
}

type Json = Record<string, unknown> | null;

export class GhostClient {
  private readonly base: string;
  private readonly adminKey: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private cachedToken: { token: string; exp: number } | null = null;

  constructor({ blogUrl, adminKey, fetchImpl, timeoutMs = 30_000, maxRetries = 2 }: GhostClientOptions) {
    this.base = `${normalizeBase(blogUrl)}/ghost/api/admin`;
    this.adminKey = adminKey;
    validateKeyFormat(adminKey);
    this.fetch = fetchImpl || globalThis.fetch;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    if (!this.fetch) throw new Error("global fetch unavailable (need Node >= 18).");
  }

  private async _headers(): Promise<Record<string, string>> {
    const token = this._token();
    return { Authorization: `Ghost ${token}`, Accept: "application/json" };
  }

  private _token(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.cachedToken.exp - 30 > now) return this.cachedToken.token;
    const token = makeToken(this.adminKey);
    this.cachedToken = { token, exp: now + 5 * 60 };
    return token;
  }

  async _request(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<Json> {
    const url = new URL(`${this.base}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const baseHeaders = await this._headers();
    let payload: BodyInit | undefined;
    if (opts.formData) {
      payload = opts.formData;
    } else if (opts.body !== undefined) {
      baseHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(opts.body);
    }

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let res: Response;
      try {
        res = await this.fetch(url, {
          method,
          headers: baseHeaders,
          body: payload,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // Network error or timeout: retry idempotently on last attempt only
        if (attempt < this.maxRetries && (method === "GET" || method === "DELETE")) {
          await this._backoff(attempt);
          attempt++;
          continue;
        }
        throw new GhostApiError(
          `Ghost API ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          0,
          "NETWORK_ERROR",
        );
      }
      const text = await res.text();
      let json: Json = null;
      if (text) {
        try { json = JSON.parse(text) as Json; } catch { /* non-JSON */ }
      }
      if (res.ok) return json;

      // Retryable: 429 (rate limit) and 5xx (transient server errors).
      // Only retry idempotent methods (GET/DELETE) — never POST/PUT, which
      // may have side effects that already partially applied.
      const idempotent = method === "GET" || method === "DELETE";
      const retryable = idempotent && (res.status === 429 || res.status >= 500);
      if (retryable && attempt < this.maxRetries) {
        await this._backoff(attempt, res);
        attempt++;
        continue;
      }

      const errors = (json?.errors as Array<{ type: string; message: string; code?: string }> | undefined);
      const code = errors?.[0]?.code;
      const msg =
        errors?.map((e) => `${e.type}: ${e.message}`).join("; ") ||
        `${res.status} ${res.statusText}`;
      throw new GhostApiError(`Ghost API ${method} ${path} failed: ${msg}`, res.status, code, json);
    }
  }

  private async _backoff(attempt: number, res?: Response): Promise<void> {
    // Honor Retry-After if present (seconds), else exponential: 250ms, 500ms, 1000ms...
    const retryAfter = res?.headers.get("retry-after");
    let ms: number;
    if (retryAfter && /^\d+$/.test(retryAfter)) {
      ms = parseInt(retryAfter, 10) * 1000;
    } else {
      ms = Math.min(250 * 2 ** attempt, 4000);
    }
    await new Promise((r) => setTimeout(r, ms));
  }

  list(resource: string, params: Record<string, unknown> = {}): Promise<Json> {
    return this._request("GET", `/${resource}/`, { query: params });
  }

  // ---- Posts ----
  listPosts(params?: Record<string, unknown>) { return this.list("posts", params); }
  getPost(id: string, params?: Record<string, unknown>) {
    return this._request("GET", `/posts/${id}/`, { query: params });
  }
  createPost(doc: Record<string, unknown>) { return this._request("POST", "/posts/", { body: { posts: [doc] } }); }
  updatePost(id: string, doc: Record<string, unknown>, updatedAt: string) {
    doc.updated_at = updatedAt;
    return this._request("PUT", `/posts/${id}/`, { body: { posts: [doc] } });
  }
  deletePost(id: string) { return this._request("DELETE", `/posts/${id}/`); }

  // ---- Pages ----
  listPages(params?: Record<string, unknown>) { return this.list("pages", params); }
  getPage(id: string, params?: Record<string, unknown>) {
    return this._request("GET", `/pages/${id}/`, { query: params });
  }
  createPage(doc: Record<string, unknown>) { return this._request("POST", "/pages/", { body: { pages: [doc] } }); }
  updatePage(id: string, doc: Record<string, unknown>, updatedAt: string) {
    doc.updated_at = updatedAt;
    return this._request("PUT", `/pages/${id}/`, { body: { pages: [doc] } });
  }
  deletePage(id: string) { return this._request("DELETE", `/pages/${id}/`); }

  // ---- Tags ----
  listTags(params?: Record<string, unknown>) { return this.list("tags", params); }
  getTag(id: string) { return this._request("GET", `/tags/${id}/`); }
  createTag(doc: Record<string, unknown>) { return this._request("POST", "/tags/", { body: { tags: [doc] } }); }
  updateTag(id: string, doc: Record<string, unknown>) { return this._request("PUT", `/tags/${id}/`, { body: { tags: [doc] } }); }
  deleteTag(id: string) { return this._request("DELETE", `/tags/${id}/`); }

  // ---- Authors / Users ----
  listUsers(params?: Record<string, unknown>) { return this.list("users", params); }
  getUser(id: string) { return this._request("GET", `/users/${id}/`); }
  updateUser(id: string, doc: Record<string, unknown>) { return this._request("PUT", `/users/${id}/`, { body: { users: [doc] } }); }

  // ---- Members ----
  listMembers(params?: Record<string, unknown>) { return this.list("members", params); }
  getMember(id: string) { return this._request("GET", `/members/${id}/`); }
  createMember(doc: Record<string, unknown>) { return this._request("POST", "/members/", { body: { members: [doc] } }); }
  updateMember(id: string, doc: Record<string, unknown>) { return this._request("PUT", `/members/${id}/`, { body: { members: [doc] } }); }
  deleteMember(id: string) { return this._request("DELETE", `/members/${id}/`); }

  // ---- Tiers ----
  listTiers(params?: Record<string, unknown>) { return this.list("tiers", params); }
  updateTier(id: string, doc: Record<string, unknown>) { return this._request("PUT", `/tiers/${id}/`, { body: { tiers: [doc] } }); }

  // ---- Newsletters ----
  listNewsletters(params?: Record<string, unknown>) { return this.list("newsletters", params); }

  // ---- Settings ----
  getSettings() { return this._request("GET", "/settings/"); }
  updateSettings(docs: Array<{ key: string; value?: unknown }>) {
    return this._request("PUT", "/settings/", { body: { settings: docs } });
  }

  // ---- Themes ----
  listThemes() { return this._request("GET", "/themes/"); }
  activateTheme(name: string) {
    return this._request("PUT", "/themes/", { body: { themes: [{ name, action: "activate" }] } });
  }

  // ---- Media / images ----
  uploadImage(buffer: Buffer, filename: string, contentType: string) {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }), filename);
    fd.append("purpose", "image");
    return this._request("POST", "/images/upload/", { formData: fd });
  }

  // ---- Webhooks ----
  listWebhooks() { return this._request("GET", "/webhooks/"); }
  createWebhook(doc: Record<string, unknown>) { return this._request("POST", "/webhooks/", { body: { webhooks: [doc] } }); }
  deleteWebhook(id: string) { return this._request("DELETE", `/webhooks/${id}/`); }
}
