import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const provision = readFileSync('.github/workflows/provision-mkety-installation.yml', 'utf8');
const deploy = readFileSync('.github/workflows/deploy-mkety-installation.yml', 'utf8');

for (const [name, workflow] of [['provision', provision], ['deploy', deploy]]) {
  test(`${name} workflow reads all Mkety database coordinates from installation secrets`, () => {
    for (const key of ['MKETY_DB_HOST', 'MKETY_DB_PORT', 'MKETY_DB_NAME', 'MKETY_DB_USER', 'MKETY_DB_PASSWORD']) {
      assert.match(workflow, new RegExp(`${key}:\\s*\\$\\{\\{ secrets\\.${key} \\}\\}`));
      assert.match(workflow, new RegExp(`name in .*${key}`));
    }
    assert.doesNotMatch(workflow, /\.supabase\.co/i);
    assert.doesNotMatch(workflow, /MKLMS_DATABASE_URL|MKLMS_DATABASE_SSL/);
  });
}

test('preview deploy leaves database migrations to the operator', () => {
  assert.match(deploy, /Database schema changes are operator-managed/);
  assert.doesNotMatch(deploy, /MKETY_MIGRATION_DB_HOST|MKETY_MIGRATION_DB_PORT|MKETY_MIGRATION_DB_USER/);
  assert.doesNotMatch(deploy, /MIGRATION_DATABASE_URL/);
  assert.doesNotMatch(deploy, /npm run db:migrate/);
});

test('deploy workflow keeps the application DATABASE_URL on the direct Mkety database coordinates', () => {
  assert.match(deploy, /Construct Mkety application DATABASE_URL/);
  assert.match(deploy, /process\.env\.MKETY_DB_HOST/);
  assert.match(deploy, /process\.env\.MKETY_DB_USER/);
  assert.match(deploy, /APP_DATABASE_URL/);
  assert.match(deploy, /--arg database \"\$APP_DATABASE_URL\"/);
  assert.match(deploy, /DATABASE_SSL:\s*require/);
  assert.doesNotMatch(deploy, /echo\s+\"?\$APP_DATABASE_URL/);
});

test('manual deployment verifies Hyperdrive origins before changing either Worker', () => {
  assert.match(deploy, /Verify both Hyperdrive origins match the approved target/);
  const preflight = deploy.split('Verify both Hyperdrive origins match the approved target')[1].split('\n      - name:')[0];
  assert.match(preflight, /scripts\/assert-hyperdrive-origin\.mjs/);
  assert.match(preflight, /hyperdrive\/configs\/\$id/);
  assert.doesNotMatch(preflight, /--request\s+(?:POST|PUT|PATCH|DELETE)/i);
});
