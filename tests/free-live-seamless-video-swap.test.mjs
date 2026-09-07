import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const room = readFileSync('src/features/live-classes/components/live-class-room-mobile-first.tsx', 'utf8');

test('free live direct-video refresh waits for a painted frame before swapping visible slots', () => {
  assert.match(room, /requestVideoFrameCallback/);
  assert.match(room, /await\s+waitForRenderableFrame\(targetVideo\)/);
  const waitIndex = room.indexOf('await waitForRenderableFrame(targetVideo)');
  const swapIndex = room.indexOf('setDirectSlot(targetSlot)', waitIndex);
  assert.ok(waitIndex >= 0, 'replacement video should wait for a renderable frame');
  assert.ok(swapIndex > waitIndex, 'visible slot must change only after a renderable frame is ready');
});
