import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  normalizeObjectKey,
  verifyPlaybackAuthorization,
} from "../workers/media-delivery/src/auth.ts";
import mediaWorker from "../workers/media-delivery/src/index.ts";
import { parseByteRange } from "../workers/media-delivery/src/range.ts";

function sign({ assetId, objectKey, viewer, expiresEpoch, secret }) {
  return createHmac("sha256", secret)
    .update([assetId, objectKey, viewer, expiresEpoch].join("|"))
    .digest("base64url");
}

function createRequest({
  method = "GET",
  key = "media/course-01/lesson-01.mp4",
  assetId = "asset-1",
  viewer = "viewer-1",
  expiresEpoch = Math.floor(Date.now() / 1000) + 180,
  secret = "test-signing-secret",
  range,
  signature,
} = {}) {
  const sig = signature ?? sign({ assetId, objectKey: key, viewer, expiresEpoch, secret });
  const url = new URL(`https://media.example.test/${key}`);
  url.searchParams.set("mk_asset", assetId);
  url.searchParams.set("mk_viewer", viewer);
  url.searchParams.set("mk_exp", String(expiresEpoch));
  url.searchParams.set("mk_sig", sig);
  const headers = range ? { Range: range } : undefined;
  return new Request(url, { method, headers });
}

function createBucket(bytes = new TextEncoder().encode("0123456789abcdefghijklmnopqrstuvwxyz")) {
  const calls = [];
  return {
    calls,
    async head(key) {
      calls.push({ type: "head", key });
      if (key.includes("missing")) return null;
      return {
        size: bytes.byteLength,
        httpMetadata: { contentType: "video/mp4" },
      };
    },
    async get(key, options) {
      calls.push({ type: "get", key, options });
      if (key.includes("missing")) return null;
      const offset = options?.range?.offset ?? 0;
      const length = options?.range?.length ?? bytes.byteLength;
      const bodyBytes = bytes.slice(offset, offset + length);
      return {
        size: bytes.byteLength,
        body: new Blob([bodyBytes]).stream(),
        httpMetadata: { contentType: "video/mp4" },
      };
    },
  };
}

function createEnv(bucket = createBucket()) {
  return {
    MEDIA_BUCKET: bucket,
    MKLMS_MEDIA_SIGNING_SECRET: "test-signing-secret",
    MKLMS_MEDIA_ALLOWED_ORIGINS: "https://app.example.test",
  };
}

test("valid MkLMS playback authorization verifies while tampering and expiry fail", async () => {
  const secret = "test-signing-secret";
  const now = 1_800_000_000;
  const input = {
    assetId: "asset-1",
    objectKey: "media/course-01/lesson-01.mp4",
    viewer: "viewer-1",
    expiresEpoch: now + 180,
  };
  const signature = sign({ ...input, secret });

  assert.deepEqual(
    await verifyPlaybackAuthorization({ ...input, signature }, secret, now),
    { ok: true },
  );
  assert.deepEqual(
    await verifyPlaybackAuthorization(
      { ...input, objectKey: "media/course-01/lesson-02.mp4", signature },
      secret,
      now,
    ),
    { ok: false, reason: "INVALID_SIGNATURE" },
  );
  assert.deepEqual(
    await verifyPlaybackAuthorization(
      { ...input, expiresEpoch: now, signature },
      secret,
      now,
    ),
    { ok: false, reason: "EXPIRED" },
  );
});

test("media object paths reject traversal and normalize URL pathnames", () => {
  assert.equal(normalizeObjectKey("/media/course-01/lesson%2001.mp4"), "media/course-01/lesson 01.mp4");
  assert.equal(normalizeObjectKey("/media/../secret.mp4"), null);
  assert.equal(normalizeObjectKey("/media/%2E%2E/secret.mp4"), null);
  assert.equal(normalizeObjectKey("/https://example.com/video.mp4"), null);
  assert.equal(normalizeObjectKey("/media\\secret.mp4"), null);
});

test("single byte ranges support bounded, open-ended, and suffix forms", () => {
  assert.deepEqual(parseByteRange("bytes=0-99", 1000), {
    ok: true,
    start: 0,
    end: 99,
    length: 100,
  });
  assert.deepEqual(parseByteRange("bytes=900-", 1000), {
    ok: true,
    start: 900,
    end: 999,
    length: 100,
  });
  assert.deepEqual(parseByteRange("bytes=-100", 1000), {
    ok: true,
    start: 900,
    end: 999,
    length: 100,
  });
  assert.equal(parseByteRange(null, 1000), null);
});

test("unsatisfiable and multiple ranges are rejected", () => {
  assert.deepEqual(parseByteRange("bytes=1000-1200", 1000), { ok: false });
  assert.deepEqual(parseByteRange("bytes=100-50", 1000), { ok: false });
  assert.deepEqual(parseByteRange("bytes=0-10,20-30", 1000), { ok: false });
});

test("media worker serves authorized full MP4 without leaking R2 origin", async () => {
  const bucket = createBucket();
  const response = await mediaWorker.fetch(createRequest(), createEnv(bucket));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.equal(await response.text(), "0123456789abcdefghijklmnopqrstuvwxyz");
  assert.equal(bucket.calls.some((call) => call.type === "get"), true);
  assert.doesNotMatch([...response.headers].flat().join(" "), /r2\.cloudflarestorage\.com/i);
});

test("media worker supports HEAD without returning media body", async () => {
  const bucket = createBucket();
  const response = await mediaWorker.fetch(createRequest({ method: "HEAD" }), createEnv(bucket));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-length"), "36");
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  assert.equal(bucket.calls.filter((call) => call.type === "get").length, 0);
});

test("media worker serves valid byte range as 206", async () => {
  const response = await mediaWorker.fetch(
    createRequest({ range: "bytes=10-19" }),
    createEnv(),
  );

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 10-19/36");
  assert.equal(response.headers.get("content-length"), "10");
  assert.equal(await response.text(), "abcdefghij");
});

test("media worker returns 416 for unsatisfiable range", async () => {
  const response = await mediaWorker.fetch(
    createRequest({ range: "bytes=100-200" }),
    createEnv(),
  );

  assert.equal(response.status, 416);
  assert.equal(response.headers.get("content-range"), "bytes */36");
});

test("media worker fails closed for missing objects and unsupported methods", async () => {
  const missing = await mediaWorker.fetch(
    createRequest({ key: "media/missing.mp4" }),
    createEnv(),
  );
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /missing\.mp4|r2/i);

  const post = await mediaWorker.fetch(createRequest({ method: "POST" }), createEnv());
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
});

test("media worker verifies authorization before every R2 read", async () => {
  const bucket = createBucket();
  const response = await mediaWorker.fetch(
    createRequest({ signature: "tampered" }),
    createEnv(bucket),
  );

  assert.equal(response.status, 403);
  assert.equal(bucket.calls.length, 0);
});
