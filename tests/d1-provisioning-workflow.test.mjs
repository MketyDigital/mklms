import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/phase1-ci.yml', 'utf8');
const provisioningJob = workflow.split('\n  provision-empty-d1-targets:\n')[1] ?? '';

test('D1 provisioning is restricted to the same-repository migration PR', () => {
  assert.notEqual(provisioningJob, '');
  assert.match(provisioningJob, /github\.event\.pull_request\.number == 149/);
  assert.match(provisioningJob, /head\.repo\.full_name == github\.repository/);
});

test('D1 provisioning creates only named targets and applies schema migrations without deploying Workers', () => {
  assert.match(provisioningJob, /node scripts\/ensure-cloudflare-d1-databases\.mjs/);
  assert.match(provisioningJob, /for installation in starpips mkety-academy/);
  assert.match(provisioningJob, /wrangler d1 migrations apply "\$database" --remote --config "\$config"/);
  assert.match(provisioningJob, /wrangler d1 migrations list "\$database" --remote --config "\$config"/);
  assert.match(provisioningJob, /Verify migrated D1 catalogs with counts-only summaries/);
  assert.match(provisioningJob, /D1_SCHEMA_SUMMARY_COUNTS_ONLY: '1'/);
  assert.doesNotMatch(provisioningJob, /wrangler deploy|opennextjs-cloudflare deploy/i);
});

test('the two concrete installation manifests bind distinct isolated D1 databases', () => {
  const starpips = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));
  const academy = JSON.parse(readFileSync('deploy/installations/mkety-academy.json', 'utf8'));
  assert.deepEqual(starpips.d1Database, { name: 'mklms-starpips', id: 'cce87337-bcb7-42a2-8e19-358b91b5289a' });
  assert.deepEqual(academy.d1Database, { name: 'mklms-mkety-academy', id: 'a486cbca-0d53-40c2-937e-55eb0c0cfbde' });
  assert.notEqual(starpips.d1Database.id, academy.d1Database.id);
});
