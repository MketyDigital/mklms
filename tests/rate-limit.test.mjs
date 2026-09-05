import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FixedWindowRateLimiter,
  consumeRateLimitBinding,
} from '../src/lib/security/rate-limit.ts';

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

test('distributed binding allows requests when Cloudflare returns success', async () => {
  const result = await consumeRateLimitBinding(
    { async limit({ key }) { assert.equal(key, 'student:42:quiz:abc'); return { success: true }; } },
    'student:42:quiz:abc',
    60,
  );

  assert.deepEqual(result, { allowed: true, remaining: -1, retryAfterSeconds: 60 });
});

test('distributed binding blocks requests when Cloudflare returns failure', async () => {
  const result = await consumeRateLimitBinding(
    { async limit() { return { success: false }; } },
    'student:42:quiz:abc',
    60,
  );

  assert.deepEqual(result, { allowed: false, remaining: 0, retryAfterSeconds: 60 });
});

test('distributed binding uses local fallback when Cloudflare binding throws', async () => {
  const fallback = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 });
  const now = new Date('2026-09-05T18:45:00Z');

  const first = await consumeRateLimitBinding(
    { async limit() { throw new Error('binding unavailable'); } },
    'admin:upload',
    60,
    fallback,
    now,
  );
  const second = await consumeRateLimitBinding(
    { async limit() { throw new Error('binding unavailable'); } },
    'admin:upload',
    60,
    fallback,
    now,
  );

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});

test('distributed binding warns and fails open when no binding or fallback exists', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(' '));

  try {
    const result = await consumeRateLimitBinding(undefined, 'any-key', 60);
    assert.deepEqual(result, { allowed: true, remaining: -1, retryAfterSeconds: 60 });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /distributed rate limiter binding is missing/i);
  } finally {
    console.warn = originalWarn;
  }
});
