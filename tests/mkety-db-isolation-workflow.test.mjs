import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Mkety database guard refuses an existing MkLMS database without Mkety identity', () => {
  const source = readFileSync('scripts/guard-mkety-database.mjs', 'utf8');
  assert.match(source, /to_regclass\('public\.students'\)/);
  assert.match(source, /to_regclass\('public\.courses'\)/);
  assert.match(source, /to_regclass\('public\._mklms_migrations'\)/);
  assert.match(source, /mklms_installation_identity/);
  assert.match(source, /mkety-academy/);
  const readIndex = source.indexOf("to_regclass('public.students')");
  const createIndex = source.indexOf('CREATE TABLE mklms_installation_identity');
  assert.ok(readIndex >= 0 && createIndex > readIndex, 'existing app tables must be inspected before identity table creation');
});

test('Mkety migration workflow is manual-only and maps only MKETY_DATABASE_URL into migration commands', () => {
  const workflow = readFileSync('.github/workflows/mkety-db-migrate.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.match(workflow, /secrets\.MKETY_DATABASE_URL/);
  assert.doesNotMatch(workflow, /secrets\.MKLMS_DATABASE_URL/);
  assert.match(workflow, /guard-mkety-database\.mjs/);
  assert.match(workflow, /npm run db:migrate/);
  assert.match(workflow, /npm run db:status/);
  assert.doesNotMatch(workflow, /printenv|set\s+-x/);
});
