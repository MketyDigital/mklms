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
  assert.match(workflow, /installation:/);
  assert.match(workflow, /type:\s*choice/);
  assert.match(workflow, /-\s+starpips/);
  assert.match(workflow, /curl[^\n]*--request\s+GET/);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s+(POST|PUT|PATCH|DELETE)/);
});

test('Cloudflare verification derives known Workers from the validated manifest without deploying', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /npm run installation:validate/);
  assert.match(workflow, /APP_WORKER=.*appWorker/);
  assert.match(workflow, /MEDIA_WORKER=.*mediaWorker/);
  assert.match(workflow, /workers\/scripts\/\$\{APP_WORKER\}\/settings/);
  assert.match(workflow, /workers\/scripts\/\$\{APP_WORKER\}\/deployments/);
  assert.match(workflow, /workers\/scripts\/\$\{MEDIA_WORKER\}\/settings/);
  assert.match(workflow, /workers\/scripts\/\$\{MEDIA_WORKER\}\/deployments/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy|opennextjs-cloudflare\s+deploy|wrangler\s+secret/i);
});
