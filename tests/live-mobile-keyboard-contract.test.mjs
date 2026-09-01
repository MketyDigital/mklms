import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('mobile live shell is fixed to the visual viewport so name/comment focus cannot pan the player', async () => {
  const liveRoom = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const globals = await source('src/app/globals.css');
  assert.match(liveRoom, /--live-visual-viewport-height/);
  assert.match(liveRoom, /viewport\.height/);
  assert.match(globals, /\[data-live-mobile-viewport\][\s\S]*position:\s*fixed/);
  assert.match(globals, /\[data-live-mobile-viewport\][\s\S]*inset:\s*0/);
  assert.match(globals, /height:\s*var\(--live-visual-viewport-height/);
  assert.match(globals, /overflow:\s*hidden/);
});
