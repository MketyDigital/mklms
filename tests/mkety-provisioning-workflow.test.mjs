import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = '.github/workflows/mkety-provision.yml';

test('Mkety provisioning workflow is manual-only and cannot target Starpips', () => {
  const workflow = readFileSync(path, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.match(workflow, /mkety-academy/);
  assert.match(workflow, /production\/starpips|spf-media|mklms-media-delivery/);
  assert.match(workflow, /scripts\/mkety-provisioning\.mjs/);
});

test('Mkety provisioning workflow is create-only and fails closed on collisions', () => {
  const workflow = readFileSync(path, 'utf8');
  assert.match(workflow, /mode:/);
  assert.match(workflow, /plan/);
  assert.match(workflow, /provision/);
  assert.match(workflow, /--request\s+GET/);
  assert.match(workflow, /--request\s+POST/);
  assert.doesNotMatch(workflow, /--request\s+(PUT|PATCH|DELETE)|-X\s+(PUT|PATCH|DELETE)/);
  assert.match(workflow, /r2\/buckets/);
  assert.match(workflow, /hyperdrive\/configs/);
  assert.match(workflow, /collision|already exists|must be absent/i);
});

test('Mkety provisioning keeps database and Cloudflare credentials out of artifacts/log output', () => {
  const workflow = readFileSync(path, 'utf8');
  assert.match(workflow, /secrets\.MKETY_DATABASE_URL/);
  assert.match(workflow, /secrets\.CLOUDFLARE_PROVISIONING_API_TOKEN/);
  assert.doesNotMatch(workflow, /echo\s+.*MKETY_DATABASE_URL|printenv|set\s+-x|curl\s+[^\n]*--verbose/);
  assert.match(workflow, /mkety-academy-provisioning/);
  assert.match(workflow, /proposed-manifest\.json/);
});
