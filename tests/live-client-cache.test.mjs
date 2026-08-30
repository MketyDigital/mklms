import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_STATE_CACHE_CONTROL,
  appendOwnLiveComment,
  parseOwnLiveComments,
} from '../src/features/live-classes/domain/live-client-cache.ts';

test('shared live state is edge-cacheable with short freshness and stale revalidation', () => {
  assert.equal(
    LIVE_STATE_CACHE_CONTROL,
    'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
  );
});

test('own live comments are restored from browser-storage JSON and invalid data fails closed', () => {
  const valid = JSON.stringify([
    { id: 'm1', displayName: 'Mfon', message: 'Hello', createdAt: '2026-08-30T17:00:00.000Z' },
  ]);
  assert.deepEqual(parseOwnLiveComments(valid), [
    { id: 'm1', displayName: 'Mfon', message: 'Hello', createdAt: '2026-08-30T17:00:00.000Z' },
  ]);
  assert.deepEqual(parseOwnLiveComments('{broken'), []);
  assert.deepEqual(parseOwnLiveComments(null), []);
});

test('appendOwnLiveComment keeps only the newest bounded local history', () => {
  let comments = [];
  for (let index = 0; index < 55; index += 1) {
    comments = appendOwnLiveComment(comments, {
      id: `m${index}`,
      displayName: null,
      message: `message ${index}`,
      createdAt: `2026-08-30T17:00:${String(index % 60).padStart(2, '0')}.000Z`,
    });
  }
  assert.equal(comments.length, 50);
  assert.equal(comments[0].id, 'm5');
  assert.equal(comments.at(-1).id, 'm54');
});
