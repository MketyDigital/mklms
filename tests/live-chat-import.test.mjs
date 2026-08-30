import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseLiveChatCsv,
  parseTimestampedLiveChat,
} from '../src/features/live-classes/domain/import-live-chat.ts';

test('CSV import accepts normalized offset_seconds, display_name, message rows', () => {
  const result = parseLiveChatCsv(`offset_seconds,display_name,message\n10,Ada,Good evening\n75,John,"This is clear, thank you"`);
  assert.deepEqual(result.items, [
    { offsetSeconds: 10, displayName: 'Ada', message: 'Good evening' },
    { offsetSeconds: 75, displayName: 'John', message: 'This is clear, thank you' },
  ]);
  assert.equal(result.errors.length, 0);
});

test('timestamped text accepts HH:MM:SS Name: message lines', () => {
  const result = parseTimestampedLiveChat(`00:00:10 Ada: Good evening\n00:01:15 John: This is clear`);
  assert.deepEqual(result.items.map((item) => item.offsetSeconds), [10, 75]);
  assert.deepEqual(result.items.map((item) => item.displayName), ['Ada', 'John']);
});

test('Zoom-style relative timestamp lines remove From/to Everyone wrapper', () => {
  const result = parseTimestampedLiveChat(`00:00:30 From Mary to Everyone: I can hear you\n00:02:00 From Sam to Everyone : Please repeat that`);
  assert.deepEqual(result.items, [
    { offsetSeconds: 30, displayName: 'Mary', message: 'I can hear you' },
    { offsetSeconds: 120, displayName: 'Sam', message: 'Please repeat that' },
  ]);
});

test('invalid rows are reported without discarding valid imported chat', () => {
  const result = parseTimestampedLiveChat(`bad row\n00:00:05 Ada: Ready`);
  assert.equal(result.items.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 1);
});
