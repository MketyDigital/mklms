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
  assert.match(source, /db\.vdblajgxrfndjesoyayy\.supabase\.co/);
  assert.match(source, /mkety_academy_app/);
  assert.match(source, /npm run db:status/);
  assert.match(source, /npm run db:migrate/);
  assert.match(source, /needs:\s*migrate/);
});

test('Mkety production maps its private hosting operator secret into the generic production deploy', () => {
  const wrapper = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy-installation-production.yml', 'utf8');
  assert.match(wrapper, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:\s*\$\{\{ secrets\.MKETY_MANAGED_HOSTING_OPERATOR_KEY \}\}/);
  assert.match(deploy, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:/);
  assert.match(deploy, /MANAGED_HOSTING_OPERATOR_KEY:\s*\$\{\{ secrets\.MKLMS_MANAGED_HOSTING_OPERATOR_KEY \}\}/);
  assert.match(deploy, /MKLMS_MANAGED_HOSTING_OPERATOR_KEY:\$operatorKey/);
});
