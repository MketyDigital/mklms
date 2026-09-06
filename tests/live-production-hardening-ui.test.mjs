import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public live chat does not disclose private-message isolation", async () => {
  const liveRoom = await source("src/features/live-classes/components/live-class-room-mobile-first.tsx");
  assert.doesNotMatch(liveRoom, /only your own messages/i);
  assert.doesNotMatch(liveRoom, /privately to the host/i);
  assert.doesNotMatch(liveRoom, /private comment/i);
  assert.match(liveRoom, /placeholder="Write a comment…"/);
});

test("live player buffers a refreshed authorization before replacing the visible direct source", async () => {
  const liveRoom = await source("src/features/live-classes/components/live-class-room-mobile-first.tsx");
  assert.match(liveRoom, /loadedMediaSessionRef/);
  assert.match(liveRoom, /loadedMediaTypeRef/);
  assert.match(liveRoom, /directVideoARef/);
  assert.match(liveRoom, /directVideoBRef/);
  assert.match(liveRoom, /loadedmetadata/);
  assert.match(liveRoom, /setDirectSlot/);
  assert.doesNotMatch(
    liveRoom,
    /else if \(authorization\.playbackType === "DIRECT"\) \{\s*video\.src = authorization\.url;/,
  );
});

test("admin live class creation and editing expose labelled schedule/media controls", async () => {
  const manager = await source("src/features/live-classes/components/admin-live-class-manager.tsx");
  for (const label of [
    "Live class title",
    "Public slug",
    "Expected viewer baseline",
    "Viewer count mode",
    "Session title",
    "Day / position",
    "Start date and time",
    "Duration (minutes)",
    "Video / media",
    "CTA reveal (minutes)",
  ]) {
    assert.match(manager, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(manager, /window\.prompt\(/);
});

test("deleting a live class cascades through sessions imported chat viewers and attendee comments", async () => {
  const migration = await source("db/migrations/008_mklms_live_classes.sql");
  const manager = await source("src/features/live-classes/components/admin-live-class-manager.tsx");
  assert.match(migration, /live_sessions[\s\S]*REFERENCES live_batches\(id\) ON DELETE CASCADE/);
  assert.match(migration, /live_timeline_messages[\s\S]*REFERENCES live_sessions\(id\) ON DELETE CASCADE/);
  assert.match(migration, /live_viewers[\s\S]*REFERENCES live_batches\(id\) ON DELETE CASCADE/);
  assert.match(migration, /live_attendee_messages[\s\S]*REFERENCES live_batches\(id\) ON DELETE CASCADE/);
  assert.match(manager, /imported chat, viewer records and attendee comments/);
});

test("paid student dashboard keeps member live sessions separate from public free live classes", async () => {
  const dashboard = await source("src/app/(member)/dashboard/page.tsx");
  assert.match(dashboard, /Member live sessions/);
  assert.match(dashboard, /\/courses\/\$\{liveSession\.courseId\}\/live\/\$\{liveSession\.id\}/);
  assert.doesNotMatch(dashboard, /href=\{`\/live\/\$\{/);
  assert.doesNotMatch(dashboard, /PostgresLiveClassRepository/);
});

test("paid lesson playback stays enrollment scoped and separate from public live playback", async () => {
  const paidPlayback = await source("src/app/api/courses/[courseId]/lessons/[lessonId]/playback/route.ts");
  const publicLivePlayback = await source("src/app/api/live/[slug]/playback/route.ts");
  assert.match(paidPlayback, /studentId/);
  assert.match(paidPlayback, /courseId/);
  assert.match(paidPlayback, /lessonId/);
  assert.doesNotMatch(paidPlayback, /PostgresLiveClassRepository/);
  assert.match(publicLivePlayback, /PostgresLiveClassRepository/);
  assert.doesNotMatch(publicLivePlayback, /StudentLearningService/);
});

test("certificate page gates graduate community link behind a valid issued certificate", async () => {
  const certificates = await source("src/app/(member)/certificates/page.tsx");
  const settings = await source("src/features/settings/platform-settings.ts");
  const migration = await source("db/migrations/012_add_completion_community_url.sql");
  assert.match(settings, /completionCommunityUrl/);
  assert.match(migration, /completion_community_url/i);
  assert.match(certificates, /Join graduate community/);
  assert.match(certificates, /certificate\.status === "ISSUED"/);
  assert.match(certificates, /completionCommunityUrl/);
});
