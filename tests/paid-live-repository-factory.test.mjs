import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaidLiveRepositoryForBackend, createPostgresPaidLiveRepository } from '../src/features/paid-live/repositories/paid-live-repository.factory.ts';
import { D1PaidLiveRepository } from '../src/features/paid-live/repositories/d1-paid-live.repository.ts';
import { PostgresPaidLiveRepository } from '../src/features/paid-live/repositories/postgres-paid-live.repository.ts';

test('paid-live factory explicitly selects one backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createPaidLiveRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresPaidLiveRepository);
  assert.ok(createPaidLiveRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1PaidLiveRepository);
  assert.ok(createPostgresPaidLiveRepository(postgresPool) instanceof PostgresPaidLiveRepository);
});

test('paid-live factory fails closed for absent dependencies and unknown backend', () => {
  assert.throws(() => createPaidLiveRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createPaidLiveRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createPaidLiveRepositoryForBackend('unknown', {}), /Unsupported database backend/);
});
