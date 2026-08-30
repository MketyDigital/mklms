import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateAccessCode,
  hashAccessCode,
  verifyAccessCode,
} from '../src/features/access/domain/access-code.ts';
import {
  findMatchingPreauthorization,
  normalizeIdentity,
} from '../src/features/access/domain/preauthorization.ts';

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

test('hashAccessCode and verifyAccessCode validate the right credential only', () => {
  const code = 'STUDENT-ABCD1234';
  const stored = hashAccessCode(code);

  assert.equal(verifyAccessCode(code, stored), true);
  assert.equal(verifyAccessCode('STUDENT-WRONG', stored), false);
  assert.notEqual(stored.hash, code);
});
