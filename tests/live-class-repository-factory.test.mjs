import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminLiveClassRepositoryForBackend, createLiveClassRepositoryForBackend, createPostgresAdminLiveClassRepository, createPostgresLiveClassRepository } from '../src/features/live-classes/repositories/live-class-repository.factory.ts';
import { D1AdminLiveClassRepository } from '../src/features/live-classes/repositories/d1-admin-live-class.repository.ts';
import { D1LiveClassRepository } from '../src/features/live-classes/repositories/d1-live-class.repository.ts';
import { PostgresAdminLiveClassRepository } from '../src/features/live-classes/repositories/postgres-admin-live-class.repository.ts';
import { PostgresLiveClassRepository } from '../src/features/live-classes/repositories/postgres-live-class.repository.ts';

test('live class factories select only the requested backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createLiveClassRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresLiveClassRepository);
  assert.ok(createLiveClassRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1LiveClassRepository);
  assert.ok(createAdminLiveClassRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresAdminLiveClassRepository);
  assert.ok(createAdminLiveClassRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1AdminLiveClassRepository);
  assert.ok(createPostgresLiveClassRepository(postgresPool) instanceof PostgresLiveClassRepository);
  assert.ok(createPostgresAdminLiveClassRepository(postgresPool) instanceof PostgresAdminLiveClassRepository);
});

test('live class factories fail closed for missing dependencies and unknown backends', () => {
  for (const factory of [createLiveClassRepositoryForBackend, createAdminLiveClassRepositoryForBackend]) {
    assert.throws(() => factory('postgresql', {}), /PostgreSQL pool is required/);
    assert.throws(() => factory('d1', {}), /D1 binding is required/);
    assert.throws(() => factory('unknown', {}), /Unsupported database backend/);
  }
});
