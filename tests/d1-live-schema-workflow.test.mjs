import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/d1-live-schema-readonly.yml', 'utf8');

test('live D1 inventory is manually dispatched with one installation and read-only repository scope', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /options:\s*\n\s*- starpips\s*\n\s*- mkety-academy/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /node scripts\/cloudflare-d1-live-inventory\.mjs/);
  assert.match(workflow, /name: d1-live-schema-\$\{\{ inputs\.installation \}\}/);
});

test('live D1 inventory workflow contains no migration, deployment, or infrastructure mutation command', () => {
  assert.doesNotMatch(workflow, /wrangler\s+(?:deploy|d1\s+migrations\s+apply)|\b(?:DELETE|UPDATE|INSERT|DROP|ALTER|CREATE)\s+(?:FROM|TABLE|DATABASE|INDEX|TRIGGER)/i);
});
