import test from 'node:test';
import assert from 'node:assert/strict';

import { FixedWindowRateLimiter } from '../src/lib/security/rate-limit.ts';

test('fixed-window limiter allows configured burst then blocks until the next window', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000, maxEntries: 100 });
  const now = new Date('2026-08-30T16:00:00Z');

  assert.equal(limiter.consume('client-a', now).allowed, true);
  assert.equal(limiter.consume('client-a', now).allowed, true);
  assert.equal(limiter.consume('client-a', now).allowed, true);
  const blocked = limiter.consume('client-a', now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);

  assert.equal(limiter.consume('client-a', new Date(now.getTime() + 60_001)).allowed, true);
});

test('fixed-window limiter isolates keys and keeps memory bounded', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 2 });
  const now = new Date('2026-08-30T16:00:00Z');

  assert.equal(limiter.consume('a', now).allowed, true);
  assert.equal(limiter.consume('b', now).allowed, true);
  assert.equal(limiter.consume('c', now).allowed, true);
  assert.ok(limiter.size <= 2);
});
