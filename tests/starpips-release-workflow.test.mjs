import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/release-starpips-production.yml';

test('Starpips production release is manual, confirmation-gated and exact-pointer gated', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.match(workflow, /confirmation:/);
  assert.match(workflow, /RELEASE_STARPIPS/);
  assert.match(workflow, /release_sha:/);
  assert.match(workflow, /production\/starpips/);
  assert.match(workflow, /git rev-parse "origin\/\$PRODUCTION_BRANCH"/);
  assert.match(workflow, /RELEASE_SHA/);
});

test('Starpips release deploys existing Workers without rotating or deleting live secrets', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /generate-installation-config\.mjs starpips/);
  assert.match(workflow, /npx wrangler deploy --config ".generated\/starpips\/media\.wrangler\.jsonc"/);
  assert.match(workflow, /npx wrangler deploy --config ".generated\/starpips\/app\.wrangler\.jsonc"/);
  assert.doesNotMatch(workflow, /wrangler secret (put|bulk|delete)/i);
  assert.doesNotMatch(workflow, /MKLMS_ADMIN_ACCESS_KEY|MKLMS_ADMIN_SESSION_SECRET|MKLMS_MEDIA_SIGNING_SECRET/);
});

test('Starpips release never mutates SaaS hostname, route, DNS, Hyperdrive or R2 resources', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /custom_hostnames/);
  assert.doesNotMatch(workflow, /workers\/routes/);
  assert.doesNotMatch(workflow, /workers\/domains/);
  assert.doesNotMatch(workflow, /dns_records/);
  assert.doesNotMatch(workflow, /hyperdrive\/configs/);
  assert.doesNotMatch(workflow, /r2\/buckets/);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)/);
});

test('Starpips release smoke-tests the real production hostname after deploy', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /https:\/\/learn\.starpipsforex\.com\/login/);
  assert.match(workflow, /https:\/\/learn\.starpipsforex\.com\//);
  assert.match(workflow, /--retry 8/);
  assert.match(workflow, /--retry-all-errors/);
});
