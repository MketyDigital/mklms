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

test("live player does not replace an already playing source solely on authorization refresh", async () => {
  const liveRoom = await source("src/features/live-classes/components/live-class-room-mobile-first.tsx");
  assert.match(liveRoom, /loadedMediaSessionRef/);
  assert.match(liveRoom, /loadedMediaTypeRef/);
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

test("paid student dashboard keeps member live sessions separate from public free live classes", async () => {
  const dashboard = await source("src/app/(member)/dashboard/page.tsx");
  assert.match(dashboard, /Member live sessions/);
  assert.doesNotMatch(dashboard, /\/live\/\$\{/);
  assert.doesNotMatch(dashboard, /PostgresLiveClassRepository/);
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
