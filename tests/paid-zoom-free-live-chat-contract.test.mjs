import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('migration 014 is additive and preserves existing paid/free live defaults', async () => {
  const migration = await source('db/migrations/014_paid_zoom_and_free_live_chat_visibility.sql');
  assert.match(migration, /ALTER TABLE paid_course_live_sessions[\s\S]*delivery_mode[\s\S]*DEFAULT 'MEDIA'/);
  assert.match(migration, /ALTER TABLE paid_course_live_sessions[\s\S]*zoom_url/);
  assert.match(migration, /ALTER TABLE live_batches[\s\S]*attendee_chat_visibility[\s\S]*DEFAULT 'OWNER_ONLY'/);
  assert.match(migration, /MEDIA', 'ZOOM/);
  assert.match(migration, /OWNER_ONLY', 'PUBLIC/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|ALTER TABLE live_sessions/);
});

test('paid Zoom join endpoint is private enrollment-gated LIVE-only and scoped to Zoom', async () => {
  const route = await source('src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts');
  assert.match(route, /getCurrentStudentSession/);
  assert.match(route, /getEnrollment\(student\.studentId, courseId\)/);
  assert.match(route, /getCourseStatus\(courseId\)/);
  assert.match(route, /liveSession\.courseId !== courseId/);
  assert.match(route, /liveSession\.status !== "PUBLISHED"/);
  assert.match(route, /courseStatus !== "PUBLISHED"/);
  assert.match(route, /\["ACTIVE", "COMPLETED"\]/);
  assert.match(route, /deliveryMode !== "ZOOM"/);
  assert.match(route, /resolvePaidLiveState/);
  assert.match(route, /state !== "LIVE"/);
  assert.match(route, /isAllowedZoomUrl/);
  assert.match(route, /private, no-store/);
});

test('paid media playback remains separate and rejects Zoom sessions', async () => {
  const route = await source('src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts');
  assert.match(route, /paidLive\.deliveryMode !== "MEDIA"/);
  assert.match(route, /createPlaybackAuthorization/);
  assert.doesNotMatch(route, /joinUrl|zoomUrl/);
});

test('paid live admin and student UI support Zoom without exposing URL in page props', async () => {
  const admin = await source('src/features/paid-live/components/admin-paid-live-editor.tsx');
  const room = await source('src/features/paid-live/components/student-paid-live-room.tsx');
  const page = await source('src/app/(member)/courses/[courseId]/live/[sessionId]/page.tsx');
  assert.match(admin, /Scheduled video/);
  assert.match(admin, /Zoom live/);
  assert.match(admin, /Zoom meeting or webinar link/);
  assert.match(room, /\/join/);
  assert.match(room, /Join live class on Zoom/);
  assert.match(room, /window\.location\.assign\(payload\.joinUrl\)/);
  assert.doesNotMatch(page, /zoomUrl/);
});

test('free live admin control defaults to owner-only and exposes explicit public opt-in', async () => {
  const control = await source('src/features/live-classes/components/admin-live-chat-visibility-control.tsx');
  const page = await source('src/app/(admin)/admin/live-classes/page.tsx');
  assert.match(control, /Owner\/Admin only/);
  assert.match(control, /Visible to everyone/);
  assert.match(control, /attendeeChatVisibility/);
  assert.match(page, /AdminLiveChatVisibilityControl/);
});

test('free live shared comments use a private same-session endpoint while staged chat stays separate', async () => {
  const route = await source('src/app/api/live/[slug]/messages/route.ts');
  const chatRoute = await source('src/app/api/live/[slug]/chat/route.ts');
  assert.match(route, /batch\.attendeeChatVisibility !== "PUBLIC"/);
  assert.match(route, /sessionId: state\.session\.id/);
  assert.match(route, /new LiveRoomService\(repository\)\.getPublicChat/);
  assert.match(route, /private, no-store/);
  assert.match(chatRoute, /listTimelineMessages/);
  assert.doesNotMatch(chatRoute, /listSessionAttendeeMessages|attendeeChatVisibility/);
});

test('free live client polls shared comments, deduplicates IDs and preserves staged timeline stream', async () => {
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(room, /SHARED_CHAT_REFRESH_MS = 3_000/);
  assert.match(room, /fetchSharedChat/);
  assert.match(room, /\/messages/);
  assert.match(room, /ownIds\.has\(item\.id\)/);
  assert.match(room, /seenSharedMessageIdsRef/);
  assert.match(room, /currentIds\.has\(item\.id\)/);
  assert.match(room, /getNewTimelineMessages/);
  assert.match(room, /stagedStreamItem/);
});
