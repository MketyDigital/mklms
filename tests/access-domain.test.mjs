import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateAccessCode,
  getAccessCodeLookupHash,
  hashAccessCode,
  verifyAccessCode,
} from '../src/features/access/domain/access-code.ts';
import {
  findMatchingPreauthorization,
  normalizeIdentity,
} from '../src/features/access/domain/preauthorization.ts';
import {
  CLAIM_VERIFICATION_STRATEGIES,
  requiresExternalVerification,
} from '../src/features/access/domain/claim-verification.ts';

test('normalizeIdentity trims and lowercases emails', () => {
  assert.equal(normalizeIdentity('  Student@Example.COM  ', 'email'), 'student@example.com');
});

test('normalizeIdentity strips non-digits from phone numbers', () => {
  assert.equal(normalizeIdentity('+234 803-123-4567', 'phone'), '2348031234567');
});

test('findMatchingPreauthorization only returns active approved records', () => {
  const records = [
    { id: '1', email: 'paid@example.com', phone: '2348011111111', status: 'PREAUTHORIZED' },
    { id: '2', email: 'revoked@example.com', phone: '2348022222222', status: 'REVOKED' },
  ];

  assert.equal(
    findMatchingPreauthorization(records, { email: 'PAID@example.com' })?.id,
    '1',
  );
  assert.equal(
    findMatchingPreauthorization(records, { email: 'revoked@example.com' }),
    null,
  );
  assert.equal(
    findMatchingPreauthorization(records, { email: 'unknown@example.com' }),
    null,
  );
});

test('generateAccessCode uses the configured prefix and produces unique codes', () => {
  const first = generateAccessCode({ prefix: 'STUDENT', randomBytes: 12 });
  const second = generateAccessCode({ prefix: 'STUDENT', randomBytes: 12 });

  assert.match(first, /^STUDENT-[A-Z0-9]+$/);
  assert.match(second, /^STUDENT-[A-Z0-9]+$/);
  assert.notEqual(first, second);
});

test('access-code lookup hash is deterministic but not plaintext', () => {
  const first = getAccessCodeLookupHash(' ACCESS-ABC123 ');
  const second = getAccessCodeLookupHash('access-abc123');

  assert.equal(first, second);
  assert.notEqual(first, 'ACCESS-ABC123');
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('hashAccessCode and verifyAccessCode validate the right credential only', () => {
  const code = 'STUDENT-ABCD1234';
  const stored = hashAccessCode(code);

  assert.equal(verifyAccessCode(code, stored), true);
  assert.equal(verifyAccessCode('STUDENT-WRONG', stored), false);
  assert.notEqual(stored.hash, code);
});

test('claim verification supports no-cost/manual options as well as OTP', () => {
  assert.deepEqual(CLAIM_VERIFICATION_STRATEGIES, [
    'preauth-only',
    'otp-email',
    'otp-sms',
    'claim-code',
    'manual-approval',
    'custom',
  ]);

  assert.equal(requiresExternalVerification('preauth-only'), false);
  assert.equal(requiresExternalVerification('claim-code'), false);
  assert.equal(requiresExternalVerification('manual-approval'), true);
  assert.equal(requiresExternalVerification('otp-email'), true);
});
