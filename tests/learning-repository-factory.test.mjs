import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminLearningRepositoryForBackend,
  createStudentLearningRepositoryForBackend,
} from '../src/features/courses/repositories/learning-repository.factory.ts';
import { D1AdminLearningRepository } from '../src/features/courses/repositories/d1-admin-learning.repository.ts';
import { D1LearningRepository } from '../src/features/courses/repositories/d1-learning.repository.ts';
import { PostgresAdminLearningRepository } from '../src/features/courses/repositories/postgres-admin-learning.repository.ts';
import { PostgresLearningRepository } from '../src/features/courses/repositories/postgres-learning.repository.ts';

test('learning repository factories construct only the explicitly selected backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createAdminLearningRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresAdminLearningRepository);
  assert.ok(createStudentLearningRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresLearningRepository);
  assert.ok(createAdminLearningRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1AdminLearningRepository);
  assert.ok(createStudentLearningRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1LearningRepository);
});

test('learning repository factories fail closed for missing dependencies and unknown backends', () => {
  assert.throws(() => createAdminLearningRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createStudentLearningRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createAdminLearningRepositoryForBackend('other', {}), /Unsupported database backend/);
});
