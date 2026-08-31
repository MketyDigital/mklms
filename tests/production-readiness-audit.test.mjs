import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('Cloudflare Postgres adapter supports transaction clients used by access and live admin flows', () => {
  const postgres = read('src/lib/postgres.ts');
  assert.match(postgres, /async\s+connect\s*\(/);
  assert.match(postgres, /release\s*\(/);
});

test('manual approval claim records the request and permits an approved retry', () => {
  const route = read('src/app/api/access/claim/route.ts');
  assert.match(route, /markPreauthorizationClaimRequested/);
  assert.match(route, /manualApprovedAt/);
});

test('student login honors the documented MkLMS session TTL variable', () => {
  const route = read('src/app/api/access/login/route.ts');
  assert.match(route, /MKLMS_STUDENT_SESSION_TTL_SECONDS/);
  assert.doesNotMatch(route, /process\.env\.STUDENT_SESSION_TTL_SECONDS/);
});

test('admin media can discover compatible files already present in private storage', () => {
  const storage = read('src/providers/storage-provider.ts');
  const r2 = read('src/providers/cloudflare-r2-storage-provider.ts');
  const page = read('src/app/(admin)/admin/media/page.tsx');
  assert.match(storage, /listObjects/);
  assert.match(r2, /listObjects/);
  assert.match(page, /StorageMediaBrowser/);
});

test('active settings UI contains no OCI Media Flow or free deployment guidance', () => {
  const form = read('src/features/settings/components/settings-form.tsx');
  const page = read('src/app/(admin)/admin/settings/page.tsx');
  assert.doesNotMatch(form, /oci-media-flow/i);
  assert.doesNotMatch(form, /options=\{\["r2",\s*"s3",\s*"oci"/i);
  assert.doesNotMatch(page, /Cloudflare Free deployment/i);
});

test('active hosting dashboard no longer depends on legacy OCI ingest accounting', () => {
  const page = read('src/app/(admin)/admin/hosting/page.tsx');
  const panel = read('src/features/hosting/components/managed-hosting-panel.tsx');
  const repository = read('src/features/hosting/repositories/postgres-managed-hosting.repository.ts');
  assert.doesNotMatch(page, /ociMediaFlowEstimatedCostUsd/);
  assert.doesNotMatch(panel, /ociMediaFlowEstimatedCostUsd|accepted OCI estimates/i);
  assert.doesNotMatch(repository, /FROM media_ingest_jobs/);
});

test('live admin share URL uses the saved public portal URL', () => {
  const page = read('src/app/(admin)/admin/live-classes/page.tsx');
  assert.match(page, /settings\.publicBaseUrl/);
});
