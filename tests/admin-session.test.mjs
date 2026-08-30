import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdminSessionValue,
  verifyAdminSessionValue,
} from '../src/features/admin/domain/admin-session.ts';

test('admin session is signed and expires at the configured time', () => {
  const secret = 'very-secret-admin-session-key';
  const now = new Date('2026-08-30T12:00:00Z');
  const value = createAdminSessionValue(secret, now, 3600);

  assert.equal(
    verifyAdminSessionValue(value, secret, new Date('2026-08-30T12:30:00Z')),
    true,
  );
  assert.equal(
    verifyAdminSessionValue(value, secret, new Date('2026-08-30T13:00:01Z')),
    false,
  );
});

test('tampered admin session is rejected', () => {
  const secret = 'very-secret-admin-session-key';
  const value = createAdminSessionValue(secret, new Date(), 3600);
  assert.equal(verifyAdminSessionValue(`${value}x`, secret, new Date()), false);
});
