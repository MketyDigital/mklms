import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePreauthorizationCsv,
  parsePreauthorizationPaste,
} from '../src/features/access/domain/import-preauthorizations.ts';

test('CSV import normalizes fields and reports duplicate identities', () => {
  const input = `name,email,phone,courseId\nJohn Doe, JOHN@example.com ,+234 801 111 1111,course-1\nJane Doe,jane@example.com,+2348022222222,course-1\nDuplicate,john@example.com,,course-1`;
  const result = parsePreauthorizationCsv(input);

  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].email, 'john@example.com');
  assert.equal(result.rows[0].phone, '2348011111111');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, 'DUPLICATE_IDENTITY');
});

test('Google Forms CSV headers map name email and phone without using timestamp as identity', () => {
  const input = `Timestamp,Full Name,Email Address,Phone Number\n8/31/2026 20:01:11,John Doe, JOHN@example.com ,+234 801 111 1111\n8/31/2026 20:05:42,Jane Doe,jane@example.com,+2348022222222`;
  const result = parsePreauthorizationCsv(input);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.rows, [
    { name: 'John Doe', email: 'john@example.com', phone: '2348011111111', courseId: null },
    { name: 'Jane Doe', email: 'jane@example.com', phone: '2348022222222', courseId: null },
  ]);
});

test('Google Forms duplicate rows are rejected when either normalized email or phone overlaps', () => {
  const input = `Timestamp,Name,Email Address,Mobile Number\n1,Ada,ada@example.com,+2348011111111\n2,Ada Again,ADA@example.com,+2348099999999\n3,Phone Duplicate,new@example.com,+234 801 111 1111`;
  const result = parsePreauthorizationCsv(input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((error) => error.code === 'DUPLICATE_IDENTITY'));
});

test('bulk paste accepts email or phone per line and rejects empty/invalid rows', () => {
  const result = parsePreauthorizationPaste(`paid@example.com\n+234 803 333 3333\nnot-an-email\n`);

  assert.deepEqual(
    result.rows.map((row) => ({ email: row.email ?? null, phone: row.phone ?? null })),
    [
      { email: 'paid@example.com', phone: null },
      { email: null, phone: '2348033333333' },
    ],
  );
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, 'INVALID_IDENTITY');
});
