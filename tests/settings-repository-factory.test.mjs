import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresSettingsRepository, createSettingsRepositoryForBackend } from '../src/features/settings/repositories/settings-repository.factory.ts';
import { D1SettingsRepository } from '../src/features/settings/repositories/d1-settings.repository.ts';
import { PostgresSettingsRepository } from '../src/features/settings/repositories/postgres-settings.repository.ts';

test('D1 selection requires the D1 binding and constructs only the D1 settings repository', () => {
  const binding = { prepare() {}, batch() {} };
  const repository = createSettingsRepositoryForBackend('d1', { d1: binding });
  assert.ok(repository instanceof D1SettingsRepository);
  assert.throws(() => createSettingsRepositoryForBackend('d1', {}), /D1 binding is required/);
});

test('PostgreSQL selection constructs only PostgreSQL and requires its pool', () => {
  const pool = {};
  const repository = createSettingsRepositoryForBackend('postgresql', { postgresPool: pool });
  assert.ok(repository instanceof PostgresSettingsRepository);
  assert.throws(() => createSettingsRepositoryForBackend('postgresql', {}), /PostgreSQL pool is required/);
});

test('current settings runtime factory remains explicitly PostgreSQL-backed', () => {
  const repository = createPostgresSettingsRepository({});
  assert.ok(repository instanceof PostgresSettingsRepository);
});

test('unknown backend values fail without choosing either repository', () => {
  assert.throws(() => createSettingsRepositoryForBackend('unknown', {}), /Unsupported settings repository backend/);
});
