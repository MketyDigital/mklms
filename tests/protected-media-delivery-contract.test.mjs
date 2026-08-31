import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const playbackRoute = readFileSync(
  "src/app/api/courses/[courseId]/lessons/[lessonId]/playback/route.ts",
  "utf8",
);
const signedProvider = readFileSync(
  "src/providers/signed-delivery-media-provider.ts",
  "utf8",
);
const player = readFileSync(
  "src/features/media/components/protected-lesson-player.tsx",
  "utf8",
);

test("student course playback uses the signed delivery provider rather than an R2/S3 origin", () => {
  assert.match(playbackRoute, /getConfiguredMediaProvider/);
  assert.match(playbackRoute, /Cache-Control[\s\S]*private, no-store/);
  assert.doesNotMatch(playbackRoute, /r2\.cloudflarestorage\.com|S3CompatibleStorageProvider/);

  assert.match(signedProvider, /MKLMS_MEDIA_DELIVERY_BASE_URL/);
  assert.match(signedProvider, /MKLMS_MEDIA_SIGNING_SECRET/);
  assert.match(signedProvider, /createHmac\("sha256"/);
  assert.match(signedProvider, /mk_asset/);
  assert.match(signedProvider, /mk_viewer/);
  assert.match(signedProvider, /mk_exp/);
  assert.match(signedProvider, /mk_sig/);
  assert.doesNotMatch(signedProvider, /r2\.cloudflarestorage\.com/);
});

test("the browser requests only the short-lived authorization returned by MkLMS", () => {
  assert.match(player, /cache:\s*"no-store"/);
  assert.match(player, /authorization\.url/);
  assert.doesNotMatch(player, /r2\.cloudflarestorage\.com/);
});
