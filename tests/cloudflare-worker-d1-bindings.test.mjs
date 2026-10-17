import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeD1Bindings } from '../scripts/summarize-cloudflare-d1-bindings.mjs';

test('Worker D1 binding summary reports only binding and database names', () => {
  const result = summarizeD1Bindings({
    success: true,
    result: { bindings: [
      { type: 'r2_bucket', name: 'APP_STORAGE_BUCKET', bucket_name: 'media' },
      { type: 'd1', name: 'MKLMS_DB', database_name: 'starpips-db', id: 'private-resource-id' },
      { type: 'd1', name: 'AUDIT_DB', database_name: 'audit-db', id: 'another-private-id' },
    ] },
  }, 'starpips');

  assert.deepEqual(result, {
    mode: 'read-only-worker-d1-binding-summary',
    installationId: 'starpips',
    count: 2,
    bindings: [
      { binding: 'AUDIT_DB', databaseName: 'audit-db' },
      { binding: 'MKLMS_DB', databaseName: 'starpips-db' },
    ],
  });
  assert.doesNotMatch(JSON.stringify(result), /private-resource-id|another-private-id/);
});

test('Worker D1 binding summary rejects malformed, incomplete, and unknown installation data', () => {
  assert.throws(() => summarizeD1Bindings({ success: false, result: { bindings: [] } }, 'starpips'));
  assert.throws(() => summarizeD1Bindings({ success: true, result: {} }, 'starpips'));
  assert.throws(() => summarizeD1Bindings({
    success: true,
    result: { bindings: [{ type: 'd1', name: 'MKLMS_DB', id: 'private-resource-id' }] },
  }, 'starpips'));
  assert.throws(() => summarizeD1Bindings({ success: true, result: { bindings: [] } }, 'other'));
});

test('PR live Cloudflare audit reads Worker settings without mutating bindings', async () => {
  const workflow = await readFile('.github/workflows/phase1-ci.yml', 'utf8');
  const step = workflow.split('Inspect existing application Worker D1 bindings (read-only)')[1]?.split('      - name: Verify all read-only schema snapshots were captured')[0];
  assert.ok(step);
  assert.match(step, /--request GET/);
  assert.match(step, /summarize-cloudflare-d1-bindings\.mjs/);
  assert.doesNotMatch(step, /wrangler\s+(?:deploy|d1\s+migrations\s+apply)|--request\s+(?:POST|PUT|PATCH|DELETE)/i);
});
