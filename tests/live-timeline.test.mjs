import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getInitialTimelineMessages,
  getNewTimelineMessages,
  getTimelineMessagesAfter,
  isLiveCtaVisible,
} from '../src/features/live-classes/domain/live-timeline.ts';

const messages = [
  { id: 'm1', offsetSeconds: 10, displayName: 'Ada', message: 'Good evening', position: 1 },
  { id: 'm2', offsetSeconds: 30, displayName: 'John', message: 'I can hear you', position: 2 },
  { id: 'm3', offsetSeconds: 60, displayName: 'Mary', message: 'This is clear', position: 3 },
  { id: 'm4', offsetSeconds: 120, displayName: 'Sam', message: 'Please repeat that', position: 4 },
  { id: 'm5', offsetSeconds: 180, displayName: 'Ngozi', message: 'Understood', position: 5 },
];

test('late join receives only recent staged context up to the current live offset', () => {
  const result = getInitialTimelineMessages(messages, 125, 2);
  assert.deepEqual(result.map((item) => item.id), ['m3', 'm4']);
});

test('messages after a cursor appear only when their timeline offset has been reached', () => {
  const result = getTimelineMessagesAfter(messages, { afterOffsetSeconds: 60, liveOffsetSeconds: 179 });
  assert.deepEqual(result.map((item) => item.id), ['m4']);
});

test('live stream appends a staged message only when its exact video offset is reached', () => {
  const seen = new Set(['m1']);
  assert.deepEqual(getNewTimelineMessages(messages, 29, seen).map((item) => item.id), []);
  assert.deepEqual(getNewTimelineMessages(messages, 30, seen).map((item) => item.id), ['m2']);
});

test('live stream never appends the same staged message twice', () => {
  const seen = new Set(['m1', 'm2', 'm3']);
  assert.deepEqual(getNewTimelineMessages(messages, 120, seen).map((item) => item.id), ['m4']);
});

test('same-second live messages append in explicit saved position order', () => {
  const sameSecond = [
    { id: 'b', offsetSeconds: 45, displayName: 'B', message: 'B', position: 2 },
    { id: 'a', offsetSeconds: 45, displayName: 'A', message: 'A', position: 1 },
    { id: 'c', offsetSeconds: 46, displayName: 'C', message: 'C', position: 3 },
  ];
  assert.deepEqual(getNewTimelineMessages(sameSecond, 45, new Set()).map((item) => item.id), ['a', 'b']);
});

test('timeline ordering is stable by offset then explicit position', () => {
  const unordered = [
    { id: 'b', offsetSeconds: 10, displayName: 'B', message: 'B', position: 2 },
    { id: 'c', offsetSeconds: 20, displayName: 'C', message: 'C', position: 3 },
    { id: 'a', offsetSeconds: 10, displayName: 'A', message: 'A', position: 1 },
  ];
  assert.deepEqual(getInitialTimelineMessages(unordered, 20, 10).map((item) => item.id), ['a', 'b', 'c']);
});

test('CTA stays hidden until its configured live offset and then becomes visible', () => {
  assert.equal(isLiveCtaVisible({ revealOffsetSeconds: 900, liveOffsetSeconds: 899 }), false);
  assert.equal(isLiveCtaVisible({ revealOffsetSeconds: 900, liveOffsetSeconds: 900 }), true);
});

test('CTA with no reveal offset can be visible for the full live session', () => {
  assert.equal(isLiveCtaVisible({ revealOffsetSeconds: null, liveOffsetSeconds: 0 }), true);
});
