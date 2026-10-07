import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('streaming storage diagnostic is admin-only and returns sanitized results', () => {
  const route = read('src/app/api/admin/media/direct-upload/check/route.ts');
  const diagnostic = read('src/features/media/server/r2-direct-upload.ts');

  assert.match(route, /hasValidAdminSession/);
  assert.match(route, /runDirectMultipartStorageDiagnostic/);
  assert.match(route, /NextResponse\.json/);
  assert.match(diagnostic, /export async function runDirectMultipartStorageDiagnostic/);
  assert.match(diagnostic, /CreateMultipartUploadCommand/);
  assert.match(diagnostic, /AbortMultipartUploadCommand/);
  assert.match(diagnostic, /getClient\(config, \{ multipart: true \}\)/);
  assert.match(diagnostic, /normalizeUploadDiagnosticFailure/);
  assert.doesNotMatch(route, /secretAccessKey|accessKeyId|uploadUrl|uploadId|endpoint|bucket/i);
});

test('diagnostic failure normalization only returns safe fields', () => {
  const diagnostic = read('src/features/media/server/r2-direct-upload.ts');

  assert.match(diagnostic, /export function normalizeUploadDiagnosticFailure/);
  assert.match(diagnostic, /httpStatusCode/);
  assert.match(diagnostic, /storageRequestId/);
  assert.doesNotMatch(diagnostic, /message:\s*error\.message/);
  assert.doesNotMatch(diagnostic, /secretAccessKey\s*:/);
});

test('multipart upload retries preserve visible progress and explain the retry', () => {
  const panel = read('src/features/media/components/media-upload-panel.tsx');

  assert.match(panel, /highestProgress\s*=\s*Math\.max/);
  assert.match(panel, /Retrying video part/);
});

test('upload diagnostics use provider-neutral wording in the admin interface', () => {
  const panel = read('src/features/media/components/media-upload-panel.tsx');

  assert.match(panel, /Check Streaming Storage/);
  assert.doesNotMatch(panel, /Cloudflare|R2/i);
});
