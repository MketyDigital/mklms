import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresQuizRepository, createQuizRepositoryForBackend } from '../src/features/quizzes/repositories/quiz-repository.factory.ts';
import { D1QuizRepository } from '../src/features/quizzes/repositories/d1-quiz.repository.ts';
import { PostgresQuizRepository } from '../src/features/quizzes/repositories/postgres-quiz.repository.ts';

test('quiz factory selects only the explicitly requested backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createQuizRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresQuizRepository);
  assert.ok(createQuizRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1QuizRepository);
  assert.ok(createPostgresQuizRepository(postgresPool) instanceof PostgresQuizRepository);
});

test('quiz factory fails closed for missing dependencies and unsupported backends', () => {
  assert.throws(() => createQuizRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createQuizRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createQuizRepositoryForBackend('unknown', {}), /Unsupported database backend/);
});
