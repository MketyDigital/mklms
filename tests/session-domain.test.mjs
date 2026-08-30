import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSessionToken,
  hashSessionToken,
  verifySessionToken,
  isSessionExpired,
} from '../src/features/access/domain/session.ts';

test('session tokens are random and not stored as plaintext', () => {
  const first = createSessionToken();
  const second = createSessionToken();
  const stored = hashSessionToken(first);

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(stored.hash, first);
  assert.equal(verifySessionToken(first, stored), true);
  assert.equal(verifySessionToken(second, stored), false);
});

test('session expiration uses an explicit expiry timestamp', () => {
  const now = new Date('2026-08-30T12:00:00Z');
  assert.equal(isSessionExpired(new Date('2026-08-30T13:00:00Z'), now), false);
  assert.equal(isSessionExpired(new Date('2026-08-30T11:59:59Z'), now), true);
});
