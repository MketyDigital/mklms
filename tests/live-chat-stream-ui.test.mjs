import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('live room maintains an append-only session chat stream instead of static recombination', async () => {
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(room, /liveChatStream/);
  assert.match(room, /seenStagedMessageIdsRef/);
  assert.match(room, /getNewTimelineMessages/);
  assert.doesNotMatch(room, /const combinedChat = useMemo/);
});

test('viewer comments append immediately into the same live stream', async () => {
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(room, /source:\s*"viewer"/);
  assert.match(room, /const sentMessage = payload\.message/);
  assert.match(room, /setLiveChatStream\(\(current\).*sentMessage/s);
});

test('live chat follows the newest message unless the viewer intentionally scrolls away', async () => {
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(room, /chatScrollRef/);
  assert.match(room, /isFollowingLiveChat/);
  assert.match(room, /scrollTo\(\{[^}]*scrollHeight[^}]*behavior/s);
  assert.match(room, /scrollChatToLive\("smooth"\)/);
  assert.match(room, /New messages/);
  assert.match(room, /onScroll/);
});

test('late join seeds only recent reached context before continuing one-by-one', async () => {
  const room = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(room, /LIVE_CHAT_INITIAL_CONTEXT/);
  assert.match(room, /getInitialTimelineMessages/);
  assert.match(room, /seenStagedMessageIdsRef\.current/);
});
