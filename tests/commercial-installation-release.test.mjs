import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const releaseModulePath = '../scripts/installation-release.mjs';
const manifestModulePath = '../scripts/installation-manifest.mjs';

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
    domain: { mode: 'saas-custom-hostname', platformId: 'mkety-saas' },
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

test('commercial manifest validation accepts SaaS customer domains without owning customer DNS', async () => {
  const { validateManifest } = await import(manifestModulePath);
  const options = { filename: 'customer-a.json', manifestType: 'concrete' };
  assert.deepEqual(validateManifest(sampleManifest(), options), []);
  assert.ok(validateManifest(sampleManifest({ domain: undefined }), options).some((error) => error.includes('domain')));
  assert.ok(validateManifest(sampleManifest({ domain: { mode: 'wrong', platformId: 'mkety-saas' } }), options).some((error) => error.includes('domain.mode')));
  assert.ok(validateManifest(sampleManifest({ domain: { mode: 'saas-custom-hostname', platformId: 'Bad Platform' } }), options).some((error) => error.includes('domain.platformId')));
  assert.ok(validateManifest(sampleManifest({ databaseOrigin: { host: 'https://bad', port: 5432, database: 'postgres', user: 'u' } }), options).some((error) => error.includes('databaseOrigin')));
});

test('release branch must exactly match the selected installation production pointer', async () => {
  const { assertReleaseBranch } = await import(releaseModulePath);
  const manifest = sampleManifest();
  assert.doesNotThrow(() => assertReleaseBranch(manifest, 'production/customer-a'));
  assert.throws(() => assertReleaseBranch(manifest, 'production/customer-b'), /production branch/i);
});

test('database origin is non-secret, structurally valid and URL encoding is safe', async () => {
  const { assertProvisionableDatabaseOrigin, buildDatabaseUrl } = await import(releaseModulePath);
  const manifest = sampleManifest({ databaseOrigin: { host: 'db.example.com', port: 5432, database: 'postgres', user: 'tenant@app' } });
  assert.doesNotThrow(() => assertProvisionableDatabaseOrigin(manifest));
  const url = buildDatabaseUrl(manifest, 'p@ss:/?#[] word');
  assert.equal(url, 'postgresql://tenant%40app:p%40ss%3A%2F%3F%23%5B%5D%20word@db.example.com:5432/postgres?sslmode=require');
});

test('selected installation isolation rejects collisions with another concrete production', async () => {
  const { assertSelectedInstallationIsolation } = await import(releaseModulePath);
  const alpha = sampleManifest();
  const beta = sampleManifest({
    id: 'customer-b', productionBranch: 'production/customer-b', appWorker: 'mklms-customer-b', mediaWorker: 'mklms-media-customer-b',
    publicDomain: 'academy.customer-b.example', r2Bucket: 'customer-b-media', hyperdrive: { freshId: 'fresh-b', cachedId: 'cached-b' },
    rateLimits: { auth: '62000001', admin: '62000002', studentMutation: '62000003', playback: '62000004', certificate: '62000005' }, billingInstallationId: 'customer-b',
  });
  assert.doesNotThrow(() => assertSelectedInstallationIsolation([
    { filename: 'customer-a.json', manifest: alpha, manifestType: 'concrete' },
    { filename: 'customer-b.json', manifest: beta, manifestType: 'concrete' },
  ], 'customer-a'));
});

test('generic provision workflow is installation-driven and contains no Mkety resource constants', () => {
  const source = readFileSync('.github/workflows/provision-installation.yml', 'utf8');
  assert.match(source, /installation_id:/);
  assert.doesNotMatch(source, /mklms-mkety-academy|mkety-academy-media|db\.vdblajgxrfndjesoyayy\.supabase\.co/);
});

test('generic preview deployment stays isolated and migration-free', () => {
  const source = readFileSync('.github/workflows/deploy-installation-preview.yml', 'utf8');
  assert.match(source, /-preview/);
  assert.doesNotMatch(source, /run-db-migrations|npm run db:migrate/);
});

test('production release preserves SaaS custom hostname lifecycle and only directly attaches provider domains', () => {
  const source = readFileSync('.github/workflows/deploy-installation-production.yml', 'utf8');
  assert.match(source, /domain\.mode|DOMAIN_MODE/);
  assert.match(source, /provider-domain/);
  assert.match(source, /saas-custom-hostname/);
  assert.match(source, /workers\/domains/);
  assert.doesNotMatch(source, /dnsZone/);
  assert.doesNotMatch(source, /custom_hostnames/);
  assert.match(source, /Smoke test installation production/);
});

test('production promotion workflow still moves only selected production pointer', () => {
  const source = readFileSync('.github/workflows/promote-installation.yml', 'utf8');
  assert.match(source, /installation_id:/);
  assert.match(source, /release_sha:/);
  assert.match(source, /PROMOTE/);
});
