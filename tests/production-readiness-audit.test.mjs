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

test('student onboarding uses the configured claim strategy', () => {
  const page = read('src/app/(auth)/onboarding/page.tsx');
  assert.match(page, /PostgresSettingsRepository/);
  assert.match(page, /settings\.claimVerificationStrategy/);
  assert.doesNotMatch(page, /verificationStrategy="preauth-only"/);
});

test('student onboarding can submit a per-student claim code even when the global default differs', () => {
  const form = read('src/features/access/components/claim-access-form.tsx');
  assert.match(form, /claimCode:\s*claimCode\s*\|\|\s*undefined/);
  assert.match(form, /Claim code \(if issued\)/);
  assert.doesNotMatch(form, /claimCode:\s*verificationStrategy\s*===\s*"claim-code"\s*\?/);
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

test('active media UI keeps supported sources without legacy OCI wording', () => {
  const manager = read('src/features/media/components/admin-media-manager.tsx');
  assert.match(manager, /DIRECT/);
  assert.match(manager, /HLS/);
  assert.match(manager, /YOUTUBE/);
  assert.match(manager, /EXTERNAL_EMBED/);
  assert.match(manager, /CUSTOM/);
  assert.doesNotMatch(manager, /oci-r2|OCI Media Flow/i);
});

test('active settings UI and API contain no OCI Media Flow or free deployment guidance', () => {
  const form = read('src/features/settings/components/settings-form.tsx');
  const page = read('src/app/(admin)/admin/settings/page.tsx');
  const route = read('src/app/api/admin/settings/platform/route.ts');
  assert.doesNotMatch(form, /oci-media-flow/i);
  assert.doesNotMatch(form, /options=\{\["r2",\s*"s3",\s*"oci"/i);
  assert.doesNotMatch(page, /Cloudflare Free deployment/i);
  assert.doesNotMatch(route, /"oci-media-flow"/i);
  assert.doesNotMatch(route, /"oci"/i);
});

test('legacy OCI settings values are normalized before the active settings form is rendered', () => {
  const repository = read('src/features/settings/repositories/postgres-settings.repository.ts');
  assert.match(repository, /row\.media_provider\s*===\s*"oci-media-flow"/);
  assert.match(repository, /row\.storage_provider\s*===\s*"oci"/);
});

test('settings integration health treats a reachable Hyperdrive database as configured', () => {
  const status = read('src/features/settings/integration-status.ts');
  const page = read('src/app/(admin)/admin/settings/page.tsx');
  assert.match(status, /databaseConnected/);
  assert.match(page, /databaseConnected:\s*dbHealth\.connected/);
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

test('admin messages mark only the conversation the administrator actually opens as read', () => {
  const repository = read('src/features/messages/repositories/postgres-message.repository.ts');
  const route = read('src/app/api/admin/messages/[threadId]/route.ts');
  const panel = read('src/features/messages/components/admin/admin-message-panel.tsx');
  assert.match(repository, /markThreadRead/);
  assert.match(route, /export async function PATCH/);
  assert.match(panel, /method:\s*"PATCH"/);
});
