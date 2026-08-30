import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveBroadcastPosition,
  shouldCorrectBroadcastPosition,
} from '../src/features/live-classes/domain/broadcast-position.ts';

test('broadcast position advances from the last server clock snapshot', () => {
  const position = resolveBroadcastPosition({
    liveOffsetSeconds: 600,
    serverNow: new Date('2026-08-30T19:10:00Z'),
    clientNow: new Date('2026-08-30T19:10:12Z'),
    durationSeconds: 3600,
  });
  assert.equal(position, 612);
});

test('broadcast position is clamped to session duration', () => {
  assert.equal(resolveBroadcastPosition({
    liveOffsetSeconds: 3598,
    serverNow: new Date('2026-08-30T19:59:58Z'),
    clientNow: new Date('2026-08-30T20:00:10Z'),
    durationSeconds: 3600,
  }), 3600);
});

test('viewer seeking materially away from live position must be corrected', () => {
  assert.equal(shouldCorrectBroadcastPosition({ currentSeconds: 200, expectedSeconds: 620, toleranceSeconds: 5 }), true);
  assert.equal(shouldCorrectBroadcastPosition({ currentSeconds: 617, expectedSeconds: 620, toleranceSeconds: 5 }), false);
});
