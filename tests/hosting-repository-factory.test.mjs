import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedHostingLedgerRepositoryForBackend, createManagedHostingRepositoryForBackend, createPostgresManagedHostingLedgerRepository, createPostgresManagedHostingRepository } from '../src/features/hosting/repositories/hosting-repository.factory.ts';
import { D1ManagedHostingLedgerRepository } from '../src/features/hosting/repositories/d1-managed-hosting-ledger.repository.ts';
import { D1ManagedHostingRepository } from '../src/features/hosting/repositories/d1-managed-hosting.repository.ts';
import { PostgresManagedHostingLedgerRepository } from '../src/features/hosting/repositories/postgres-managed-hosting-ledger.repository.ts';
import { PostgresManagedHostingRepository } from '../src/features/hosting/repositories/postgres-managed-hosting.repository.ts';

test('hosting factories select only the explicit backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createManagedHostingRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresManagedHostingRepository);
  assert.ok(createManagedHostingRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1ManagedHostingRepository);
  assert.ok(createManagedHostingLedgerRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresManagedHostingLedgerRepository);
  assert.ok(createManagedHostingLedgerRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1ManagedHostingLedgerRepository);
  assert.ok(createPostgresManagedHostingRepository(postgresPool) instanceof PostgresManagedHostingRepository);
  assert.ok(createPostgresManagedHostingLedgerRepository(postgresPool) instanceof PostgresManagedHostingLedgerRepository);
});

test('hosting factories fail closed for missing dependencies and unknown values', () => {
  for (const factory of [createManagedHostingRepositoryForBackend, createManagedHostingLedgerRepositoryForBackend]) {
    assert.throws(() => factory('postgresql', {}), /PostgreSQL pool is required/);
    assert.throws(() => factory('d1', {}), /D1 binding is required/);
    assert.throws(() => factory('unknown', {}), /Unsupported database backend/);
  }
});
