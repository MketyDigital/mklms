import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('mobile live shell follows visual viewport top as well as height during keyboard focus', async () => {
  const liveRoom = await source('src/features/live-classes/components/live-class-room-mobile-first.tsx');
  const globals = await source('src/app/globals.css');
  assert.match(liveRoom, /--live-visual-viewport-top/);
  assert.match(liveRoom, /viewport\.offsetTop/);
  assert.match(globals, /--live-visual-viewport-top/);
  assert.match(globals, /position:\s*fixed/);
});
