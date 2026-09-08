import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Starpips release does not depend on environment-scoped secrets', () => {
  const workflow = readFileSync('.github/workflows/release-starpips-production.yml', 'utf8');
  assert.doesNotMatch(workflow, /^\s*environment:\s*(database-migrations|starpips)\s*$/m);
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_URL/);
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_SSL/);
  assert.doesNotMatch(workflow, /secrets\.MKLMS_DATABASE_URL/);
});

test('manual database migration workflow is explicitly Starpips-scoped on Free private', () => {
  const workflow = readFileSync('.github/workflows/run-db-migrations.yml', 'utf8');
  assert.doesNotMatch(workflow, /^\s*environment:\s*database-migrations\s*$/m);
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_URL/);
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_SSL/);
});

test('Mkety generic deploy workflows receive secrets from installation wrappers', () => {
  for (const path of [
    '.github/workflows/deploy-installation-preview.yml',
    '.github/workflows/deploy-installation-production.yml',
  ]) {
    const workflow = readFileSync(path, 'utf8');
    assert.match(workflow, /workflow_call:/);
    assert.match(workflow, /secrets:/);
    assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID:/);
    assert.match(workflow, /CLOUDFLARE_API_TOKEN:/);
    assert.match(workflow, /MKLMS_ADMIN_ACCESS_KEY:/);
    assert.match(workflow, /MKLMS_ADMIN_SESSION_SECRET:/);
    assert.match(workflow, /MKLMS_MEDIA_SIGNING_SECRET:/);
  }
});

test('Mkety release wrapper maps installation-prefixed repository secrets', () => {
  const workflow = readFileSync('.github/workflows/mkety-academy-release.yml', 'utf8');
  assert.match(workflow, /secrets\.MKETY_ADMIN_ACCESS_KEY/);
  assert.match(workflow, /secrets\.MKETY_ADMIN_SESSION_SECRET/);
  assert.match(workflow, /secrets\.MKETY_MEDIA_SIGNING_SECRET/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
});

test('generic provisioning documents wrapper-secret requirement for Hyperdrive password', () => {
  const workflow = readFileSync('.github/workflows/provision-installation.yml', 'utf8');
  assert.match(workflow, /workflow_call:/);
  assert.match(workflow, /DATABASE_PASSWORD:/);
  assert.match(workflow, /required:\s*false/);
});
