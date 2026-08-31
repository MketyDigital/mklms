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
