import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  '.github/workflows/release-starpips-production.yml',
  '.github/workflows/run-db-migrations.yml',
  '.github/workflows/provision-installation.yml',
  '.github/workflows/deploy-installation-preview.yml',
  '.github/workflows/deploy-installation-production.yml',
];

test('production and provisioning workflows do not depend on GitHub Environments', () => {
  for (const path of files) {
    const workflow = readFileSync(path, 'utf8');
    assert.doesNotMatch(workflow, /^\s*environment:\s/m, `${path} still depends on GitHub Environments`);
  }
});

test('Starpips release uses repository-level installation-prefixed database secrets', () => {
  const workflow = readFileSync('.github/workflows/release-starpips-production.yml', 'utf8');
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_URL/);
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_SSL/);
  assert.doesNotMatch(workflow, /secrets\.MKLMS_DATABASE_URL/);
});

test('manual database migration workflow is explicitly Starpips-scoped on Free private', () => {
  const workflow = readFileSync('.github/workflows/run-db-migrations.yml', 'utf8');
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_URL/);
  assert.match(workflow, /secrets\.STARPIPS_DATABASE_SSL/);
});

test('generic deploy workflows receive secrets from installation wrappers instead of environment lookup', () => {
  for (const path of [
    '.github/workflows/deploy-installation-preview.yml',
    '.github/workflows/deploy-installation-production.yml',
  ]) {
    const workflow = readFileSync(path, 'utf8');
    assert.match(workflow, /workflow_call:/);
    assert.doesNotMatch(workflow, /^\s*environment:\s/m);
  }
});
