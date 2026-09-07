import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('drift comparator distinguishes match, drift and not_verifiable without secrets', async () => {
  const { compareObservedBindings } = await import('../scripts/cloudflare-drift.mjs');
  const manifest = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));
  const observed = [
    { name: 'APP_STORAGE_BUCKET', type: 'r2_bucket', bucket_name: 'spf-media' },
    { name: 'HYPERDRIVE_FRESH', type: 'hyperdrive', id: manifest.hyperdrive.freshId },
    { name: 'HYPERDRIVE_CACHED', type: 'hyperdrive' },
    { name: 'AUTH_RATE_LIMITER', type: 'ratelimit', namespace_id: 'WRONG' },
  ];
  const results = compareObservedBindings(manifest, observed, 'app');
  assert.ok(results.some((x) => x.field === 'APP_STORAGE_BUCKET' && x.status === 'match'));
  assert.ok(results.some((x) => x.field === 'HYPERDRIVE_CACHED.id' && x.status === 'not_verifiable'));
  assert.ok(results.some((x) => x.field === 'AUTH_RATE_LIMITER.namespace_id' && x.status === 'drift'));
  assert.doesNotMatch(JSON.stringify(results), /secret|password|token/i);
});

test('Cloudflare workflow remains manual, constrained and GET-only', () => {
  const workflow = readFileSync('.github/workflows/cloudflare-readonly-verify.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /installation:/);
  assert.match(workflow, /type:\s*choice/);
  assert.match(workflow, /-\s+starpips/);
  assert.match(workflow, /npm run installation:validate/);
  assert.match(workflow, /--request\s+GET/);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s+(POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy|opennextjs-cloudflare\s+deploy|wrangler\s+secret/i);
  assert.doesNotMatch(workflow, /db:migrate|scripts\/migrate|r2\s+bucket|dns/i);
  assert.match(workflow, /scripts\/verify-cloudflare-response\.mjs/);
});