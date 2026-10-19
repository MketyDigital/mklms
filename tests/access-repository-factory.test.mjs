import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccessRepositoryForBackend,
  createAdminAccessRepositoryForBackend,
} from '../src/features/access/repositories/access-repository.factory.ts';
import { D1AccessRepository } from '../src/features/access/repositories/d1-access.repository.ts';
import { D1AdminAccessRepository } from '../src/features/access/repositories/d1-admin-access.repository.ts';
import { PostgresAccessRepository } from '../src/features/access/repositories/postgres-access.repository.ts';
import { PostgresAdminAccessRepository } from '../src/features/access/repositories/postgres-admin-access.repository.ts';

test('access repository factories construct only the selected backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createAccessRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresAccessRepository);
  assert.ok(createAdminAccessRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresAdminAccessRepository);
  assert.ok(createAccessRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1AccessRepository);
  assert.ok(createAdminAccessRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1AdminAccessRepository);
});

test('access repository factories fail closed for missing dependencies and unknown backends', () => {
  assert.throws(() => createAccessRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createAdminAccessRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createAccessRepositoryForBackend('other', {}), /Unsupported database backend/);
});
