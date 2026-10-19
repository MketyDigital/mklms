import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseAudienceRepositoryForBackend, createPostgresCourseAudienceRepository } from '../src/features/courses/repositories/course-audience-repository.factory.ts';
import { D1CourseAudienceRepository } from '../src/features/courses/repositories/d1-course-audience.repository.ts';
import { PostgresCourseAudienceRepository } from '../src/features/courses/repositories/postgres-course-audience.repository.ts';

test('course audience factory selects only the explicitly requested backend', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createCourseAudienceRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresCourseAudienceRepository);
  assert.ok(createCourseAudienceRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1CourseAudienceRepository);
  assert.ok(createPostgresCourseAudienceRepository(postgresPool) instanceof PostgresCourseAudienceRepository);
});

test('course audience factory fails closed for missing dependencies and unsupported backend', () => {
  assert.throws(() => createCourseAudienceRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
  assert.throws(() => createCourseAudienceRepositoryForBackend('d1', {}), /D1 binding is required/);
  assert.throws(() => createCourseAudienceRepositoryForBackend('other', {}), /Unsupported database backend/);
});
