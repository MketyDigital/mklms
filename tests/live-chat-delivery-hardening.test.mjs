import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public live room has a dedicated active-session chat feed independent of cached live state', async () => {
  const route = await source('src/app/api/live/[slug]/chat/route.ts');
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');

  assert.match(route, /listTimelineMessages\(session\.id\)/);
  assert.match(route, /sessionId:\s*session\.id/);
  assert.match(route, /count:\s*messages\.length/);
  assert.match(route, /s-maxage=5/);
  assert.doesNotMatch(route, /stale-while-revalidate/);

  assert.match(room, /\/chat`/);
  assert.match(room, /cache:\s*"no-store"/);
  assert.match(room, /setStagedChat/);
  assert.match(room, /CHAT_REFRESH_MS/);
});

test('a briefly cached chat response from another session cannot suppress the live-state fallback timeline', async () => {
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const mismatchBranch = room.match(/if \(!expectedSessionId \|\| payload\.sessionId !== expectedSessionId\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';
  assert.match(mismatchBranch, /setChatFeedLoaded\(false\)/);
  assert.doesNotMatch(mismatchBranch, /setChatFeedLoaded\(true\)/);
});

test('admin synchronized chat accepts direct TXT or CSV file selection and shows confirmed stored timeline metadata', async () => {
  const manager = await source('src/features/live-classes/components/admin-live-class-manager.tsx');
  const adminPage = await source('src/app/(admin)/admin/live-classes/page.tsx');

  assert.match(manager, /type="file"/);
  assert.match(manager, /accept="[^"]*\.txt[^"]*\.csv/);
  assert.match(manager, /file\.text\(\)/);
  assert.match(manager, /Confirmed stored/);
  assert.match(manager, /timelineCount/);
  assert.match(adminPage, /getTimelineSummary/);
  assert.doesNotMatch(adminPage, /listTimelineMessages\(session\.id\)/);
});

test('large imported chat is inserted in bounded SQL batches instead of one database round-trip per message', async () => {
  const repository = await source('src/features/live-classes/repositories/postgres-admin-live-class.repository.ts');
  assert.match(repository, /TIMELINE_INSERT_BATCH_SIZE/);
  assert.match(repository, /insertTimelineBatch/);
  assert.doesNotMatch(repository, /for\s*\([^)]*items\.length[^)]*\)\s*await\s+this\.insertTimeline/);
});

test('main worker keeps live chat on the application worker and protected media worker remains media-only', async () => {
  const mainWrangler = await source('wrangler.jsonc');
  const mediaWrangler = await source('workers/media-delivery/wrangler.jsonc');
  const mediaWorker = await source('workers/media-delivery/src/index.ts');

  assert.match(mainWrangler, /\.open-next\/worker\.js/);
  assert.doesNotMatch(mediaWrangler, /api\/live/);
  assert.doesNotMatch(mediaWorker, /live_timeline_messages|\/api\/live\//);
});
