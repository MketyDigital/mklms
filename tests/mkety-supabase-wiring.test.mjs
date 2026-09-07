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

test('deploy workflow builds DATABASE_URL at runtime without printing it', () => {
  assert.match(deploy, /Construct Mkety DATABASE_URL/);
  assert.match(deploy, /new URL\('postgresql:\/\/'\)/);
  assert.match(deploy, /GITHUB_ENV/);
  assert.match(deploy, /DATABASE_SSL:\s*require/);
  assert.doesNotMatch(deploy, /echo\s+\"?\$DATABASE_URL/);
});
