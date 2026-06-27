"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { makeToken, normalizeBase } = require("../src/ghost.ts");

// Ghost Admin key format: {key_id}:{hex_secret}. Deterministic given iat.
// We can't fix time without monkeypatching Date; instead verify structural
// correctness + signature validity against the secret.

const KEY_ID = "5c9e3bf3e2babc0b3a4f5e6d";
const SECRET_HEX = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
const KEY = `${KEY_ID}:${SECRET_HEX}`;

test("makeToken: throws on missing colon", () => {
  assert.throws(() => makeToken("nocolon"), /Invalid Ghost Admin API key/);
});

test("makeToken: throws on empty", () => {
  assert.throws(() => makeToken(""), /Invalid Ghost Admin API key/);
  assert.throws(() => makeToken(":secret"), /Invalid Ghost Admin API key/);
  assert.throws(() => makeToken("id:"), /Invalid Ghost Admin API key/);
});

test("makeToken: produces three base64url segments", () => {
  const tok = makeToken(KEY);
  const parts = tok.split(".");
  assert.equal(parts.length, 3);
  for (const p of parts) {
    assert.ok(/^[A-Za-z0-9_-]+$/.test(p), `segment not base64url: ${p}`);
    assert.ok(!p.includes("="), "no padding");
  }
});

test("makeToken: header decodes with alg HS256, kid=key_id", () => {
  const tok = makeToken(KEY);
  const header = JSON.parse(Buffer.from(tok.split(".")[0], "base64url").toString());
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");
  assert.equal(header.kid, KEY_ID);
});

test("makeToken: payload has iat, exp=iat+300, aud=/admin/", () => {
  const tok = makeToken(KEY);
  const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
  assert.equal(typeof payload.iat, "number");
  assert.equal(payload.exp, payload.iat + 300);
  assert.equal(payload.aud, "/admin/");
});

test("makeToken: signature verifies with HS256 over header.payload", () => {
  const tok = makeToken(KEY);
  const [h, p, sig] = tok.split(".");
  const expected = crypto
    .createHmac("sha256", Buffer.from(SECRET_HEX, "hex"))
    .update(`${h}.${p}`)
    .digest("base64url");
  assert.equal(sig, expected);
});

test("makeToken: token changes over time (iat advances)", async () => {
  const t1 = makeToken(KEY);
  await new Promise((r) => setTimeout(r, 1100));
  const t2 = makeToken(KEY);
  assert.notEqual(t1, t2);
});

test("normalizeBase: strips trailing slashes", () => {
  assert.equal(normalizeBase("https://blog.example.com///"), "https://blog.example.com");
});

test("normalizeBase: adds https:// if scheme missing", () => {
  assert.equal(normalizeBase("blog.example.com"), "https://blog.example.com");
});

test("normalizeBase: preserves explicit http", () => {
  assert.equal(normalizeBase("http://localhost:2368/"), "http://localhost:2368");
});

test("normalizeBase: throws on empty", () => {
  assert.throws(() => normalizeBase(""), /Missing Ghost blog URL/);
  assert.throws(() => normalizeBase(undefined), /Missing Ghost blog URL/);
});

test("validateKeyFormat: accepts valid key", () => {
  const { validateKeyFormat } = require("../src/ghost.ts");
  // Should not throw
  validateKeyFormat(KEY);
});

test("validateKeyFormat: rejects malformed key", () => {
  const { validateKeyFormat } = require("../src/ghost.ts");
  assert.throws(() => validateKeyFormat("short:bad"), /Invalid Ghost Admin API key format/);
  assert.throws(() => validateKeyFormat("5c9e3bf3e2babc0b3a4f5e6d:not-hex"), /Invalid Ghost Admin API key format/);
  assert.throws(() => validateKeyFormat(""), /Invalid Ghost Admin API key format/);
});

test("GhostClient: constructor rejects malformed key via validateKeyFormat", () => {
  const { GhostClient } = require("../src/ghost.ts");
  assert.throws(
    () => new GhostClient({ ghostUrl: "https://x.example.com", adminKey: "bad" }),
    /Invalid Ghost Admin API key format/,
  );
});
