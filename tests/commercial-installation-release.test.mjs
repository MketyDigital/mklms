import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const releaseModulePath = '../scripts/installation-release.mjs';

function sampleManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'installation',
    deployable: true,
    id: 'customer-a',
    productionBranch: 'production/customer-a',
    appWorker: 'mklms-customer-a',
    mediaWorker: 'mklms-media-customer-a',
    publicDomain: 'academy.customer-a.example',
    r2Bucket: 'customer-a-media',
    hyperdrive: { freshId: 'fresh-a', cachedId: 'cached-a' },
    rateLimits: {
      auth: '61000001', admin: '61000002', studentMutation: '61000003', playback: '61000004', certificate: '61000005',
    },
    billingInstallationId: 'customer-a',
    databaseOrigin: {
      host: 'db.example.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'customer_a_app',
    },
    ...overrides,
  };
}

test('release helper exposes generic commercial installation interfaces', async () => {
  const mod = await import(releaseModulePath);
  for (const name of ['assertReleaseBranch', 'assertProvisionableDatabaseOrigin', 'buildDatabaseUrl', 'assertSelectedInstallationIsolation']) {
    assert.equal(typeof mod[name], 'function', `${name} must be exported`);
  }
});

test('release branch must exactly match the selected installation production pointer', async () => {
  const { assertReleaseBranch } = await import(releaseModulePath);
  const manifest = sampleManifest();
  assert.doesNotThrow(() => assertReleaseBranch(manifest, 'production/customer-a'));
  assert.throws(() => assertReleaseBranch(manifest, 'production/customer-b'), /production branch/i);
  assert.throws(() => assertReleaseBranch(manifest, 'main'), /production branch/i);
});

test('database origin is non-secret, structurally valid and URL encoding is safe', async () => {
  const { assertProvisionableDatabaseOrigin, buildDatabaseUrl } = await import(releaseModulePath);
  const manifest = sampleManifest({ databaseOrigin: { host: 'db.example.com', port: 5432, database: 'postgres', user: 'tenant@app' } });
  assert.doesNotThrow(() => assertProvisionableDatabaseOrigin(manifest));
  const url = buildDatabaseUrl(manifest, 'p@ss:/?#[] word');
  assert.equal(url, 'postgresql://tenant%40app:p%40ss%3A%2F%3F%23%5B%5D%20word@db.example.com:5432/postgres?sslmode=require');
  assert.throws(() => buildDatabaseUrl(manifest, ''), /password/i);
  assert.throws(() => assertProvisionableDatabaseOrigin(sampleManifest({ databaseOrigin: undefined })), /database origin/i);
  assert.throws(() => assertProvisionableDatabaseOrigin(sampleManifest({ databaseOrigin: { host: 'https://bad', port: 5432, database: 'postgres', user: 'u' } })), /database origin/i);
});

test('selected installation isolation rejects collisions with another concrete production', async () => {
  const { assertSelectedInstallationIsolation } = await import(releaseModulePath);
  const alpha = sampleManifest();
  const beta = sampleManifest({
    id: 'customer-b',
    productionBranch: 'production/customer-b',
    appWorker: 'mklms-customer-b',
    mediaWorker: 'mklms-media-customer-b',
    publicDomain: 'academy.customer-b.example',
    r2Bucket: 'customer-b-media',
    hyperdrive: { freshId: 'fresh-b', cachedId: 'cached-b' },
    rateLimits: { auth: '62000001', admin: '62000002', studentMutation: '62000003', playback: '62000004', certificate: '62000005' },
    billingInstallationId: 'customer-b',
  });
  assert.doesNotThrow(() => assertSelectedInstallationIsolation([
    { filename: 'customer-a.json', manifest: alpha, manifestType: 'concrete' },
    { filename: 'customer-b.json', manifest: beta, manifestType: 'concrete' },
  ], 'customer-a'));
  beta.r2Bucket = alpha.r2Bucket;
  assert.throws(() => assertSelectedInstallationIsolation([
    { filename: 'customer-a.json', manifest: alpha, manifestType: 'concrete' },
    { filename: 'customer-b.json', manifest: beta, manifestType: 'concrete' },
  ], 'customer-a'), /duplicates|collision/i);
});

test('generic provision workflow is installation-driven and contains no Mkety resource constants', () => {
  const source = readFileSync('.github/workflows/provision-installation.yml', 'utf8');
  assert.match(source, /installation_id:/);
  assert.match(source, /deploy\/installations/);
  assert.match(source, /installation-release\.mjs/);
  assert.match(source, /DATABASE_PASSWORD/);
  assert.doesNotMatch(source, /MKETY_DB_|mklms-mkety-academy|mkety-academy-media|db\.vdblajgxrfndjesoyayy\.supabase\.co/);
  assert.match(source, /protected-installation-resources/);
});

test('generic preview deployment is manifest-driven, migration-free and uses standard secrets', () => {
  const source = readFileSync('.github/workflows/deploy-installation-preview.yml', 'utf8');
  assert.match(source, /installation_id:/);
  assert.match(source, /generate-installation-config/);
  assert.match(source, /MKLMS_ADMIN_ACCESS_KEY/);
  assert.match(source, /MKLMS_ADMIN_SESSION_SECRET/);
  assert.match(source, /MKLMS_MEDIA_SIGNING_SECRET/);
  assert.doesNotMatch(source, /MKETY_DB_|mklms-mkety-academy|mkety-academy-media|db\.vdblajgxrfndjesoyayy\.supabase\.co/);
  assert.doesNotMatch(source, /run-db-migrations|Apply .*database migrations|npm run db:migrate/);
  assert.match(source, /Smoke test installation preview/);
});

test('production promotion workflow requires selected installation, exact SHA and confirmation', () => {
  const source = readFileSync('.github/workflows/promote-installation.yml', 'utf8');
  assert.match(source, /installation_id:/);
  assert.match(source, /release_sha:/);
  assert.match(source, /confirmation:/);
  assert.match(source, /PROMOTE/);
  assert.match(source, /productionBranch/);
  assert.doesNotMatch(source, /production\/starpips[^\n]*update-ref/);
});
