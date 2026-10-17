import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMessageRepositoryForBackend,
  createPostgresMessageRepository,
} from '../src/features/messages/repositories/message-repository.factory.ts';
import { D1MessageRepository } from '../src/features/messages/repositories/d1-message.repository.ts';
import { PostgresMessageRepository } from '../src/features/messages/repositories/postgres-message.repository.ts';

test('message repository factory constructs only the explicitly selected backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createMessageRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresMessageRepository);
  assert.ok(createMessageRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1MessageRepository);
  assert.ok(createPostgresMessageRepository(postgresPool) instanceof PostgresMessageRepository);
});

test('message repository factory fails closed for missing dependencies and unknown backends', () => {
  assert.throws(() => createMessageRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createMessageRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createMessageRepositoryForBackend('other', {}), /Unsupported database backend/);
});
