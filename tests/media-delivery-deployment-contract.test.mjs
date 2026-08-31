import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("media delivery has an isolated private R2 Worker configuration", () => {
  const wrangler = JSON.parse(read("workers/media-delivery/wrangler.jsonc"));
  assert.equal(wrangler.name, "mklms-media-delivery");
  assert.equal(wrangler.main, "src/index.ts");
  assert.deepEqual(wrangler.r2_buckets, [
    { binding: "MEDIA_BUCKET", bucket_name: "mklms-media" },
  ]);
  assert.doesNotMatch(JSON.stringify(wrangler), /secret_access|access_key|MKLMS_MEDIA_SIGNING_SECRET/i);
});

test("environment guide separates portable variables from Cloudflare bindings", () => {
  const guide = read("docs/deployment/environment-variables.md");
  for (const name of [
    "DATABASE_URL",
    "MKLMS_ADMIN_ACCESS_KEY",
    "MKLMS_ADMIN_SESSION_SECRET",
    "MKLMS_MEDIA_DELIVERY_BASE_URL",
    "MKLMS_MEDIA_SIGNING_SECRET",
    "HYPERDRIVE_FRESH",
    "HYPERDRIVE_CACHED",
    "MEDIA_BUCKET",
  ]) {
    assert.match(guide, new RegExp(name));
  }
  assert.match(guide, /bindings?[^\n]*not[^\n]*environment variable/i);
  assert.match(guide, /no external auth/i);
  assert.match(guide, /Vercel/i);
  assert.match(guide, /OCI|VPS/i);
  assert.match(guide, /self-hosted PostgreSQL/i);
});

test("media worker operator guide documents shared signing secret and deployment URL", () => {
  const guide = read("workers/media-delivery/README.md");
  assert.match(guide, /wrangler secret put MKLMS_MEDIA_SIGNING_SECRET/);
  assert.match(guide, /wrangler deploy/);
  assert.match(guide, /MKLMS_MEDIA_DELIVERY_BASE_URL/);
  assert.match(guide, /workers\.dev|custom domain/i);
  assert.doesNotMatch(guide, /https:\/\/[^\s<]*r2\.cloudflarestorage\.com[^\s<]*\.mp4/i);
});
