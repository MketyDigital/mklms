import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('migration 014 is additive and defaults existing free live to owner-only comments', async () => {
  const migration = await source('db/migrations/014_paid_zoom_and_free_live_chat_visibility.sql');
  assert.match(migration, /ALTER TABLE paid_course_live_sessions[\s\S]*delivery_mode[\s\S]*DEFAULT 'MEDIA'/);
  assert.match(migration, /zoom_url/);
  assert.match(migration, /ALTER TABLE live_batches[\s\S]*attendee_chat_visibility[\s\S]*DEFAULT 'OWNER_ONLY'/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|ALTER TABLE live_sessions/i);
});

test('paid live admin supports both scheduled video and Zoom without changing public free-live routes', async () => {
  const editor = await source('src/features/paid-live/components/admin-paid-live-editor.tsx');
  const createRoute = await source('src/app/api/admin/courses/[courseId]/paid-live/route.ts');
  const updateRoute = await source('src/app/api/admin/paid-live/[sessionId]/route.ts');
  assert.match(editor, /Scheduled video/);
  assert.match(editor, /Zoom live/);
  assert.match(editor, /Zoom meeting or webinar link/);
  assert.match(createRoute, /deliveryMode/);
  assert.match(createRoute, /zoomUrl/);
  assert.match(updateRoute, /isAllowedZoomUrl/);
  assert.match(updateRoute, /Select a ready video before publishing/);
  assert.match(updateRoute, /Add a valid Zoom link before publishing/);
});

test('paid Zoom join link is enrollment gated and never embedded in student page props', async () => {
  const joinRoute = await source('src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts');
  const playbackRoute = await source('src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts');
  const page = await source('src/app/(member)/courses/[courseId]/live/[sessionId]/page.tsx');
  const room = await source('src/features/paid-live/components/student-paid-live-room.tsx');
  assert.match(joinRoute, /getCurrentStudentSession/);
  assert.match(joinRoute, /getEnrollment/);
  assert.match(joinRoute, /ACTIVE/);
  assert.match(joinRoute, /COMPLETED/);
  assert.match(joinRoute, /deliveryMode !== "ZOOM"/);
  assert.match(joinRoute, /state !== "LIVE"/);
  assert.match(joinRoute, /isAllowedZoomUrl/);
  assert.match(playbackRoute, /deliveryMode !== "MEDIA"/);
  assert.doesNotMatch(page, /zoomUrl/);
  assert.match(room, /\/join/);
  assert.match(room, /Join live class on Zoom/);
});

test('free live admin explicitly controls real attendee visibility while owner-only remains the default', async () => {
  const control = await source('src/features/live-classes/components/admin-live-chat-visibility-control.tsx');
  const service = await source('src/features/live-classes/services/admin-live-class.service.ts');
  const stateRoute = await source('src/app/api/live/[slug]/state/route.ts');
  const playbackRoute = await source('src/app/api/live/[slug]/playback/route.ts');
  assert.match(control, /Owner\/Admin only/);
  assert.match(control, /Visible to everyone/);
  assert.match(service, /attendeeChatVisibility: input\.attendeeChatVisibility \?\? "OWNER_ONLY"/);
  assert.doesNotMatch(stateRoute, /attendeeChatVisibility|listSessionAttendeeMessages/);
  assert.doesNotMatch(playbackRoute, /attendeeChatVisibility|listSessionAttendeeMessages/);
});

test('public free-live front end polls viewer-specific shared comments and deduplicates them in the same stream', async () => {
  const messagesRoute = await source('src/app/api/live/[slug]/messages/route.ts');
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const stagedRoute = await source('src/app/api/live/[slug]/chat/route.ts');
  assert.match(messagesRoute, /export async function GET/);
  assert.match(messagesRoute, /attendeeChatVisibility !== "PUBLIC"/);
  assert.match(messagesRoute, /PRIVATE_NO_STORE/);
  assert.match(messagesRoute, /sessionId: state\.session\.id/);
  assert.match(room, /\/messages/);
  assert.match(room, /shared/);
  assert.match(room, /viewer-\$\{.*\.id\}/);
  assert.match(room, /some\(.*\.id ===/s);
  assert.match(stagedRoute, /s-maxage=5/);
  assert.doesNotMatch(stagedRoute, /listSessionAttendeeMessages|attendee_chat_visibility/);
});
