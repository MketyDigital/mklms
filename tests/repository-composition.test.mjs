import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositorySetForBackend } from '../src/lib/repository-composition.ts';

test('repository composition constructs the complete set from exactly one selected backend', () => {
  const postgresPool = {};
  const d1 = {};
  const factories = {
    access: {
      postgresql: (pool) => ({ backend: 'postgresql', pool }),
      d1: (binding) => ({ backend: 'd1', binding }),
    },
    settings: {
      postgresql: (pool) => ({ backend: 'postgresql', pool }),
      d1: (binding) => ({ backend: 'd1', binding }),
    },
  };

  const postgres = createRepositorySetForBackend('postgresql', { postgresPool, d1 }, factories);
  assert.deepEqual(Object.keys(postgres), ['access', 'settings']);
  assert.ok(Object.values(postgres).every((repository) => repository.backend === 'postgresql'));
  assert.ok(Object.values(postgres).every((repository) => repository.pool === postgresPool));

  const d1Repositories = createRepositorySetForBackend('d1', { postgresPool, d1 }, factories);
  assert.deepEqual(Object.keys(d1Repositories), ['access', 'settings']);
  assert.ok(Object.values(d1Repositories).every((repository) => repository.backend === 'd1'));
  assert.ok(Object.values(d1Repositories).every((repository) => repository.binding === d1));
});

test('composition fails closed when the selected backend dependency is absent', () => {
  const factories = { access: { postgresql: () => ({}), d1: () => ({}) } };
  assert.throws(() => createRepositorySetForBackend('d1', {}, factories), /D1 binding is required/);
  assert.throws(() => createRepositorySetForBackend('postgresql', {}, factories), /PostgreSQL pool is required/);
});

test('composition rejects unknown backends and incomplete repository maps', () => {
  const factories = { access: { postgresql: () => ({}) } };
  assert.throws(() => createRepositorySetForBackend('unknown', {}, factories), /Unsupported database backend/);
  assert.throws(() => createRepositorySetForBackend('d1', { d1: {} }, factories), /D1 factory is missing for access/);
});
