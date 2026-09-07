import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/cloudflare-readonly-verify.yml';

test('Cloudflare verification workflow is manual and read-only', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /curl[^\n]*--request\s+GET|curl[^\n]*-X\s+GET/);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s+(POST|PUT|PATCH|DELETE)/);
});

test('Cloudflare verification checks the pinned Starpips mklms Worker without deploying', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /CLOUDFLARE_WORKER_NAME:\s*mklms/);
  assert.match(workflow, /workers\/scripts\/\$\{CLOUDFLARE_WORKER_NAME\}\/settings/);
  assert.match(workflow, /workers\/scripts\/\$\{CLOUDFLARE_WORKER_NAME\}\/deployments/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy/);
});
