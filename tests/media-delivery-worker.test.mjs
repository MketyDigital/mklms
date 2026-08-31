import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  normalizeObjectKey,
  verifyPlaybackAuthorization,
} from "../workers/media-delivery/src/auth.ts";
import { parseByteRange } from "../workers/media-delivery/src/range.ts";

function sign({ assetId, objectKey, viewer, expiresEpoch, secret }) {
  return createHmac("sha256", secret)
    .update([assetId, objectKey, viewer, expiresEpoch].join("|"))
    .digest("base64url");
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
