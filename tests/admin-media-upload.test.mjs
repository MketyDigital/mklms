import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('admin media page no longer exposes the legacy OCI ingest control panel', () => {
  const page = fs.readFileSync('src/app/(admin)/admin/media/page.tsx', 'utf8');

  assert.doesNotMatch(page, /MediaIngestPanel/);
  assert.doesNotMatch(page, /PostgresMediaIngestRepository/);
  assert.doesNotMatch(page, /getOciAutomationStatus/);
  assert.doesNotMatch(page, /OCI Media Flow/);
  assert.match(page, /MediaUploadPanel/);
});

test('admin media upload stores private MP4 through the configured storage adapter and registers DIRECT media', () => {
  const route = fs.readFileSync('src/app/api/admin/media/upload/route.ts', 'utf8');

  assert.match(route, /hasValidAdminSession/);
  assert.match(route, /getConfiguredStorageProvider/);
  assert.match(route, /video\/mp4/);
  assert.match(route, /visibility:\s*"private"/);
  assert.match(route, /media\//);
  assert.match(route, /sourceType:\s*"DIRECT"/);
  assert.doesNotMatch(route, /OCI|Media Flow|oci/i);
});
