import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminMediaRepositoryForBackend,
  createMediaIngestRepositoryForBackend,
  createMediaPlaybackRepositoryForBackend,
  createVideoProgressRepositoryForBackend,
} from '../src/features/media/repositories/media-repository.factory.ts';
import { D1AdminMediaRepository } from '../src/features/media/repositories/d1-admin-media.repository.ts';
import { D1MediaIngestRepository } from '../src/features/media/repositories/d1-media-ingest.repository.ts';
import { D1MediaPlaybackRepository } from '../src/features/media/repositories/d1-media-playback.repository.ts';
import { PostgresAdminMediaRepository } from '../src/features/media/repositories/postgres-admin-media.repository.ts';
import { PostgresMediaIngestRepository } from '../src/features/media/repositories/postgres-media-ingest.repository.ts';
import { PostgresMediaPlaybackRepository } from '../src/features/media/repositories/postgres-media-playback.repository.ts';
import { PostgresVideoProgressRepository } from '../src/features/media/repositories/postgres-video-progress.repository.ts';

test('media factories select only the requested backend, including shared progress implementation', () => {
  const postgresPool = {};
  const d1 = { prepare() {}, batch() {} };
  assert.ok(createAdminMediaRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresAdminMediaRepository);
  assert.ok(createAdminMediaRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1AdminMediaRepository);
  assert.ok(createMediaIngestRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresMediaIngestRepository);
  assert.ok(createMediaIngestRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1MediaIngestRepository);
  assert.ok(createMediaPlaybackRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresMediaPlaybackRepository);
  assert.ok(createMediaPlaybackRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1MediaPlaybackRepository);
  assert.ok(createVideoProgressRepositoryForBackend('postgresql', { postgresPool, d1 }) instanceof PostgresVideoProgressRepository);
  assert.ok(createVideoProgressRepositoryForBackend('d1', { postgresPool, d1 }) instanceof D1MediaPlaybackRepository);
});

test('media factories fail closed for missing dependencies or unsupported backend', () => {
  for (const factory of [createAdminMediaRepositoryForBackend, createMediaIngestRepositoryForBackend, createMediaPlaybackRepositoryForBackend, createVideoProgressRepositoryForBackend]) {
    assert.throws(() => factory('postgresql', {}), /PostgreSQL pool is required/);
    assert.throws(() => factory('d1', {}), /D1 binding is required/);
    assert.throws(() => factory('unknown', {}), /Unsupported database backend/);
  }
});
