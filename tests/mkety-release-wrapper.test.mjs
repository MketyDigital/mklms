import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Mkety compatibility wrapper delegates to generic isolated preview and production deploy workflows', () => {
  const source = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(source, /preview\/mkety-academy/);
  assert.match(source, /production\/mkety-academy/);
  assert.match(source, /deploy-installation-preview\.yml/);
  assert.match(source, /deploy-installation-production\.yml/);
  assert.match(source, /installation_id:\s*mkety-academy/);
  assert.match(source, /MKETY_ADMIN_ACCESS_KEY/);
  assert.match(source, /MKETY_MEDIA_SIGNING_SECRET/);
  assert.doesNotMatch(source, /production\/starpips|learn\.starpipsforex\.com|spf-media/);
});

test('Mkety production release migrates its own Supabase schema before application deployment', () => {
  const source = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(source, /MKETY_DB_PASSWORD/);
  assert.match(source, /pooler\.supabase\.com/);
  assert.match(source, /MKETY_MIGRATION_DB_USER:\s*mkety_academy_app/);
  assert.doesNotMatch(source, /MKETY_MIGRATION_DB_USER:\s*mkety_academy_app\.vdblajgxrfndjesoyayy/);
  assert.match(source, /MKETY_MIGRATION_TENANT_REF:\s*vdblajgxrfndjesoyayy/);
  assert.match(source, /url\.searchParams\.set\('options', `--reference=\$\{process\.env\.MKETY_MIGRATION_TENANT_REF\}`\)/);
  assert.match(source, /DATABASE_URL=\$\{url\.toString\(\)\}/);
  assert.match(source, /uselibpqcompat/);
  const hostAssignment = source.indexOf('url.hostname = process.env.MKETY_MIGRATION_DB_HOST;');
  const usernameAssignment = source.indexOf('url.username = process.env.MKETY_MIGRATION_DB_USER;');
  const passwordAssignment = source.indexOf('url.password = process.env.MKETY_DB_PASSWORD;');
  assert.ok(hostAssignment >= 0 && usernameAssignment > hostAssignment && passwordAssignment > hostAssignment,
    'database host must be established before URL username/password so Node preserves credentials');
  assert.match(source, /npm run db:status/);
  assert.match(source, /npm run db:migrate/);
  assert.match(source, /needs:\s*migrate/);
});

test('Mkety production alone wires the managed-hosting operator key into the application Worker', () => {
  const wrapper = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  const production = readFileSync('.github/workflows/deploy-installation-production.yml', 'utf8');
  const preview = readFileSync('.github/workflows/deploy-installation-preview.yml', 'utf8');

  assert.match(wrapper, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:\s*\$\{\{ secrets\.MKETY_MANAGED_HOSTING_OPERATOR_KEY \}\}/);
  assert.match(production, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:/);
  assert.match(production, /MANAGED_HOSTING_OPERATOR_KEY:\s*\$\{\{ secrets\.MKLMS_MANAGED_HOSTING_OPERATOR_KEY \}\}/);
  assert.match(production, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:\$operatorKey/);
  assert.doesNotMatch(preview, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY/);
});
