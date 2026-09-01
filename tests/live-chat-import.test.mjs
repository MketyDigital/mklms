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

test('Zoom meeting_saved_chat tab-delimited rows import correctly', () => {
  const result = parseTimestampedLiveChat(`\uFEFF00:00:30\tFrom Mary Jane to Everyone:\tI can hear you\r\n00:02:00\tFrom Sam K. to Everyone:\tPlease repeat that`);
  assert.deepEqual(result.items, [
    { offsetSeconds: 30, displayName: 'Mary Jane', message: 'I can hear you' },
    { offsetSeconds: 120, displayName: 'Sam K.', message: 'Please repeat that' },
  ]);
  assert.equal(result.errors.length, 0);
});

test('Zoom meeting_saved_chat multiline message rows import correctly', () => {
  const result = parseTimestampedLiveChat(`00:00:30 From Mary Jane to Everyone:\n\tI can hear you\n00:02:00 From Sam K. to Everyone:\n\tPlease repeat that`);
  assert.deepEqual(result.items, [
    { offsetSeconds: 30, displayName: 'Mary Jane', message: 'I can hear you' },
    { offsetSeconds: 120, displayName: 'Sam K.', message: 'Please repeat that' },
  ]);
  assert.equal(result.errors.length, 0);
});

test('Zoom wall-clock timestamps are rebased so imported messages appear during normal video playback', () => {
  const result = parseTimestampedLiveChat(`20:03:15 From Mary to Everyone: Good evening\n20:04:45 From Sam to Everyone: I can hear you`);
  assert.deepEqual(result.items, [
    { offsetSeconds: 0, displayName: 'Mary', message: 'Good evening' },
    { offsetSeconds: 90, displayName: 'Sam', message: 'I can hear you' },
  ]);
  assert.equal(result.errors.length, 0);
});

test('Zoom host and panelist recipient headers import as normal staged chat', () => {
  const result = parseTimestampedLiveChat(`18:57:14 From Brooke Balthaser to Hosts and panelists:\n\tTuesday evenings work for our community.\n19:02:23 From Miles Hogan to Hosts and panelists:\n\tThank you.`);
  assert.deepEqual(result.items.map(({ displayName, message }) => ({ displayName, message })), [
    { displayName: 'Brooke Balthaser', message: 'Tuesday evenings work for our community.' },
    { displayName: 'Miles Hogan', message: 'Thank you.' },
  ]);
  assert.equal(result.errors.length, 0);
});

test('older Zoom exports with timestamp on one line and From header on the next import correctly', () => {
  const result = parseTimestampedLiveChat(`11:45:12\n From KOTSIDIS EFTHYMIOS : Ready for class\n11:45:32\n From TSANIS NIKOLAOS : Good morning`);
  assert.deepEqual(result.items.map(({ displayName, message }) => ({ displayName, message })), [
    { displayName: 'KOTSIDIS EFTHYMIOS', message: 'Ready for class' },
    { displayName: 'TSANIS NIKOLAOS', message: 'Good morning' },
  ]);
  assert.equal(result.errors.length, 0);
});

test('wrapped long Zoom messages keep continuation lines until the next timestamped chat entry', () => {
  const result = parseTimestampedLiveChat(`11:52:16 From Riley to Everyone: This is a long message that was copied from Zoom and wrapped\nonto a second line without another timestamp.\n11:52:24 From Riley to Everyone: Welcome to my meeting`);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].message, 'This is a long message that was copied from Zoom and wrapped\nonto a second line without another timestamp.');
  assert.equal(result.errors.length, 0);
});

test('invalid rows are reported without discarding valid imported chat', () => {
  const result = parseTimestampedLiveChat(`bad row\n00:00:05 Ada: Ready`);
  assert.equal(result.items.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 1);
});
