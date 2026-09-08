import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const provision = readFileSync('.github/workflows/provision-mkety-installation.yml', 'utf8');
const deploy = readFileSync('.github/workflows/deploy-mkety-installation.yml', 'utf8');

for (const [name, workflow] of [['provision', provision], ['deploy', deploy]]) {
  test(`${name} workflow pins Mkety Supabase coordinates and only secrets the password`, () => {
    assert.match(workflow, /db\.vdblajgxrfndjesoyayy\.supabase\.co/);
    assert.match(workflow, /MKETY_DB_PORT:\s*5432/);
    assert.match(workflow, /MKETY_DB_NAME:\s*postgres/);
    assert.match(workflow, /MKETY_DB_USER:\s*mkety_academy_app/);
    assert.match(workflow, /MKETY_DB_PASSWORD:\s*\$\{\{ secrets\.MKETY_DB_PASSWORD \}\}/);
    assert.doesNotMatch(workflow, /secrets\.MKETY_DB_HOST|secrets\.MKETY_DB_PORT|secrets\.MKETY_DB_NAME|secrets\.MKETY_DB_USER/);
    assert.doesNotMatch(workflow, /MKLMS_DATABASE_URL|MKLMS_DATABASE_SSL/);
  });
}

test('deploy workflow uses Supavisor session pooling for GitHub Actions migrations only', () => {
  assert.match(deploy, /MKETY_MIGRATION_DB_HOST:\s*aws-0-eu-west-1\.pooler\.supabase\.com/);
  assert.match(deploy, /MKETY_MIGRATION_DB_PORT:\s*5432/);
  assert.match(deploy, /MKETY_MIGRATION_DB_USER:\s*mkety_academy_app\.vdblajgxrfndjesoyayy/);
  assert.match(deploy, /Construct Mkety migration DATABASE_URL/);
  assert.match(deploy, /process\.env\.MKETY_MIGRATION_DB_HOST/);
  assert.match(deploy, /process\.env\.MKETY_MIGRATION_DB_USER/);
  assert.match(deploy, /MIGRATION_DATABASE_URL/);
  assert.match(deploy, /DATABASE_URL=\"\$MIGRATION_DATABASE_URL\"\s+npm run db:migrate/);
});

test('deploy workflow keeps the application DATABASE_URL on the direct Mkety database coordinates', () => {
  assert.match(deploy, /Construct Mkety application DATABASE_URL/);
  assert.match(deploy, /process\.env\.MKETY_DB_HOST/);
  assert.match(deploy, /process\.env\.MKETY_DB_USER/);
  assert.match(deploy, /APP_DATABASE_URL/);
  assert.match(deploy, /--arg database \"\$APP_DATABASE_URL\"/);
  assert.match(deploy, /DATABASE_SSL:\s*require/);
  assert.doesNotMatch(deploy, /echo\s+\"?\$(MIGRATION_DATABASE_URL|APP_DATABASE_URL)/);
});
