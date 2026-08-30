import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getInitialTimelineMessages,
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
