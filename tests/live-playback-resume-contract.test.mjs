import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('returning to a live tab refreshes playback authorization, not only shared live state', async () => {
  const liveRoom = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(liveRoom, /visibilitychange/);
  assert.match(liveRoom, /requestPlayback/);
  assert.match(liveRoom, /pageshow/);
});

test('live player exposes a user-gesture resume fallback when autoplay recovery is blocked', async () => {
  const liveRoom = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  assert.match(liveRoom, /needsPlaybackGesture/);
  assert.match(liveRoom, /Tap to resume/);
  assert.match(liveRoom, /onPause/);
  assert.match(liveRoom, /onPlaying/);
});
