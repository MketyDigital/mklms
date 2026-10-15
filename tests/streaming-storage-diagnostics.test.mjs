import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { normalizeUploadDiagnosticFailure } from '../src/features/media/server/upload-diagnostic.ts';

const read = (path) => fs.readFileSync(path, 'utf8');

test('streaming storage diagnostic is admin-only and uses the production multipart flow', () => {
  const route = read('src/app/api/admin/media/direct-upload/check/route.ts');
  const diagnostic = read('src/features/media/server/direct-upload-diagnostic.ts');
  const directUpload = read('src/features/media/server/r2-direct-upload.ts');

  assert.match(route, /hasValidAdminSession/);
  assert.match(route, /runDirectMultipartStorageDiagnostic/);
  assert.match(route, /NextResponse\.json/);
  assert.match(diagnostic, /createDirectR2UploadAuthorization/);
  assert.match(diagnostic, /abortDirectR2MultipartUpload/);
  assert.match(directUpload, /CreateMultipartUploadCommand/);
  assert.match(directUpload, /AbortMultipartUploadCommand/);
  assert.match(directUpload, /getClient\(config, \{ multipart: true \}\)/);
  assert.doesNotMatch(route, /secretAccessKey|accessKeyId|uploadUrl|uploadId|endpoint|bucket/i);
});

test('diagnostic failure normalization only returns safe fields', () => {
  const diagnostic = read('src/features/media/server/upload-diagnostic.ts');

  assert.match(diagnostic, /export function normalizeUploadDiagnosticFailure/);
  assert.match(diagnostic, /httpStatusCode/);
  assert.match(diagnostic, /storageRequestId/);
  assert.doesNotMatch(diagnostic, /message:\s*error\.message/);
  assert.doesNotMatch(diagnostic, /secretAccessKey\s*:/);
});

test('diagnostic normalization omits raw provider messages and credential-like values', () => {
  const error = Object.assign(new Error('signed canonical request includes hidden data'), {
    name: 'SignatureDoesNotMatch',
    secretAccessKey: 'must-not-escape',
    $metadata: { httpStatusCode: 403, requestId: 'storage-req-42' },
  });
  const result = normalizeUploadDiagnosticFailure(error, 'start');

  assert.deepEqual(result, {
    ok: false,
    stage: 'start',
    detailCode: 'SignatureDoesNotMatch',
    httpStatusCode: 403,
    storageRequestId: 'storage-req-42',
  });
  assert.equal(JSON.stringify(result).includes('must-not-escape'), false);
  assert.equal(JSON.stringify(result).includes('canonical request'), false);
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
