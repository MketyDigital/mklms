import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveLiveBatchState,
  resolveViewerDisplayCount,
} from '../src/features/live-classes/domain/live-session.ts';

const batch = {
  id: 'batch-1',
  slug: 'august-free-class',
  status: 'ACTIVE',
  expectedViewerBaseline: 500,
  viewerDisplayMode: 'CONFIGURED_BASELINE',
  sessions: [
    {
      id: 'session-1',
      batchId: 'batch-1',
      title: 'Day 1',
      startsAt: new Date('2026-08-30T19:00:00.000Z'),
      durationSeconds: 3600,
      position: 1,
      status: 'PUBLISHED',
    },
    {
      id: 'session-2',
      batchId: 'batch-1',
      title: 'Day 2',
      startsAt: new Date('2026-08-31T19:00:00.000Z'),
      durationSeconds: 3600,
      position: 2,
      status: 'PUBLISHED',
    },
  ],
};

test('before first session the batch resolves to UPCOMING with countdown target and no LIVE state', () => {
  const result = resolveLiveBatchState(batch, new Date('2026-08-30T18:45:00.000Z'));
  assert.equal(result.state, 'UPCOMING');
  assert.equal(result.isLive, false);
  assert.equal(result.session?.id, 'session-1');
  assert.equal(result.countdownTo?.toISOString(), '2026-08-30T19:00:00.000Z');
  assert.equal(result.liveOffsetSeconds, null);
});

test('during a session the batch resolves to LIVE and offset comes from server clock', () => {
  const result = resolveLiveBatchState(batch, new Date('2026-08-30T19:23:40.000Z'));
  assert.equal(result.state, 'LIVE');
  assert.equal(result.isLive, true);
  assert.equal(result.session?.id, 'session-1');
  assert.equal(result.liveOffsetSeconds, 1420);
});

test('refresh or late join resolves to the same current live offset, not viewer registration time', () => {
  const first = resolveLiveBatchState(batch, new Date('2026-08-30T19:40:00.000Z'));
  const second = resolveLiveBatchState(batch, new Date('2026-08-30T19:40:00.000Z'));
  assert.equal(first.liveOffsetSeconds, 2400);
  assert.equal(second.liveOffsetSeconds, 2400);
});

test('between multi-day sessions batch resolves to BETWEEN_SESSIONS and counts down to next session', () => {
  const result = resolveLiveBatchState(batch, new Date('2026-08-30T21:00:00.000Z'));
  assert.equal(result.state, 'BETWEEN_SESSIONS');
  assert.equal(result.isLive, false);
  assert.equal(result.session?.id, 'session-2');
  assert.equal(result.countdownTo?.toISOString(), '2026-08-31T19:00:00.000Z');
});

test('after the final session the batch resolves to ENDED and never shows LIVE', () => {
  const result = resolveLiveBatchState(batch, new Date('2026-08-31T21:00:00.000Z'));
  assert.equal(result.state, 'ENDED');
  assert.equal(result.isLive, false);
  assert.equal(result.session, null);
  assert.equal(result.liveOffsetSeconds, null);
});

test('configured baseline viewer display uses the admin expected audience', () => {
  assert.equal(resolveViewerDisplayCount({ mode: 'CONFIGURED_BASELINE', baseline: 500, activeViewers: 37 }), 500);
});

test('active-only viewer display uses measured active presence', () => {
  assert.equal(resolveViewerDisplayCount({ mode: 'ACTIVE_ONLY', baseline: 500, activeViewers: 37 }), 37);
});

test('baseline-plus-active combines admin baseline with actual presence', () => {
  assert.equal(resolveViewerDisplayCount({ mode: 'BASELINE_PLUS_ACTIVE', baseline: 500, activeViewers: 37 }), 537);
});

test('viewer display never returns a negative or non-integer count', () => {
  assert.equal(resolveViewerDisplayCount({ mode: 'CONFIGURED_BASELINE', baseline: -25.4, activeViewers: -2 }), 0);
  assert.equal(resolveViewerDisplayCount({ mode: 'BASELINE_PLUS_ACTIVE', baseline: 10.9, activeViewers: 2.8 }), 12);
});
