import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  REQUIRED_RATE_LIMIT_KEYS,
  classifyManifest,
  validateInstallationSet,
  validateManifest,
} from '../scripts/installation-manifest.mjs';

const STAR_PIPS = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));

function concrete(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'installation',
    deployable: true,
    id: 'customer-a',
    productionBranch: 'production/customer-a',
    appWorker: 'mklms-customer-a',
    mediaWorker: 'mklms-media-customer-a',
    publicDomain: 'learn.customer-a.example',
    r2Bucket: 'customer-a-media',
    hyperdrive: {
      freshId: '11111111111111111111111111111111',
      cachedId: '22222222222222222222222222222222',
    },
    rateLimits: {
      auth: '60000001',
      admin: '60000002',
      studentMutation: '60000003',
      playback: '60000004',
      certificate: '60000005',
    },
    billingInstallationId: 'customer-a',
    ...overrides,
  };
}

test('installation manifest module exposes the locked validation interface', () => {
  assert.deepEqual(REQUIRED_RATE_LIMIT_KEYS, [
    'auth',
    'admin',
    'studentMutation',
    'playback',
    'certificate',
  ]);
  assert.equal(typeof classifyManifest, 'function');
  assert.equal(typeof validateManifest, 'function');
  assert.equal(typeof validateInstallationSet, 'function');
});

test('manifest filenames classify concrete, example and template files', () => {
  assert.equal(classifyManifest('starpips.json'), 'concrete');
  assert.equal(classifyManifest('mkety-academy.example.json'), 'example');
  assert.equal(classifyManifest('customer-template.json'), 'template');
});

test('concrete manifests enforce required fields and isolation inside one installation', () => {
  assert.deepEqual(validateManifest(concrete(), { filename: 'customer-a.json', manifestType: 'concrete' }), []);

  const errors = validateManifest(
    concrete({
      appWorker: 'same-worker',
      mediaWorker: 'same-worker',
      hyperdrive: { freshId: 'same-hyperdrive', cachedId: 'same-hyperdrive' },
      rateLimits: {
        auth: '1', admin: '1', studentMutation: '2', playback: '3', certificate: '4',
      },
    }),
    { filename: 'customer-a.json', manifestType: 'concrete' },
  );
  assert.ok(errors.some((error) => error.includes('appWorker') && error.includes('mediaWorker')));
  assert.ok(errors.some((error) => error.includes('freshId') && error.includes('cachedId')));
  assert.ok(errors.some((error) => error.includes('rate limit namespace')));
});

test('all five rate limit namespaces are required', () => {
  const manifest = concrete();
  delete manifest.rateLimits.certificate;
  const errors = validateManifest(manifest, { filename: 'customer-a.json', manifestType: 'concrete' });
  assert.ok(errors.some((error) => error.includes('certificate')));
});

test('secret-like fields and inline database URLs are forbidden', () => {
  const secretErrors = validateManifest(
    concrete({ nested: { API_TOKEN: 'not-allowed' } }),
    { filename: 'customer-a.json', manifestType: 'concrete' },
  );
  assert.ok(secretErrors.some((error) => error.includes('secret-like key')));

  const urlErrors = validateManifest(
    concrete({ nested: { connection: 'postgresql://user:pass@example/db' } }),
    { filename: 'customer-a.json', manifestType: 'concrete' },
  );
  assert.ok(urlErrors.some((error) => error.includes('database URL')));
});

test('examples and templates are non-deployable and concrete manifests reject sentinels', () => {
  const example = concrete({
    deployable: false,
    r2Bucket: 'EXAMPLE_BUCKET',
    hyperdrive: { freshId: 'EXAMPLE_FRESH', cachedId: 'EXAMPLE_CACHED' },
    rateLimits: {
      auth: 'EXAMPLE_AUTH', admin: 'EXAMPLE_ADMIN', studentMutation: 'EXAMPLE_MUTATION', playback: 'EXAMPLE_PLAYBACK', certificate: 'EXAMPLE_CERT',
    },
    billingInstallationId: 'EXAMPLE_BILLING',
  });
  assert.deepEqual(validateManifest(example, { filename: 'customer-a.example.json', manifestType: 'example' }), []);

  const template = structuredClone(example);
  template.r2Bucket = 'TEMPLATE_BUCKET';
  template.hyperdrive = { freshId: 'TEMPLATE_FRESH', cachedId: 'TEMPLATE_CACHED' };
  template.rateLimits = {
    auth: 'TEMPLATE_AUTH', admin: 'TEMPLATE_ADMIN', studentMutation: 'TEMPLATE_MUTATION', playback: 'TEMPLATE_PLAYBACK', certificate: 'TEMPLATE_CERT',
  };
  template.billingInstallationId = 'TEMPLATE_BILLING';
  assert.deepEqual(validateManifest(template, { filename: 'customer-template.json', manifestType: 'template' }), []);

  const concreteSentinel = validateManifest(
    concrete({ r2Bucket: 'EXAMPLE_BUCKET' }),
    { filename: 'customer-a.json', manifestType: 'concrete' },
  );
  assert.ok(concreteSentinel.some((error) => error.includes('sentinel')));
});

test('cross-installation isolation rejects reused resources', () => {
  const a = concrete();
  const b = concrete({
    id: 'customer-b',
    productionBranch: 'production/customer-b',
    appWorker: 'mklms-customer-b',
    mediaWorker: 'mklms-media-customer-b',
    publicDomain: 'learn.customer-b.example',
    r2Bucket: 'customer-b-media',
    hyperdrive: {
      freshId: '33333333333333333333333333333333',
      cachedId: '44444444444444444444444444444444',
    },
    rateLimits: {
      auth: '70000001', admin: '70000002', studentMutation: '70000003', playback: '70000004', certificate: '70000005',
    },
    billingInstallationId: 'customer-b',
  });
  assert.deepEqual(validateInstallationSet([
    { filename: 'customer-a.json', manifest: a },
    { filename: 'customer-b.json', manifest: b },
  ]), []);

  b.r2Bucket = a.r2Bucket;
  const errors = validateInstallationSet([
    { filename: 'customer-a.json', manifest: a },
    { filename: 'customer-b.json', manifest: b },
  ]);
  assert.ok(errors.some((error) => error.includes('r2Bucket')));
});

test('Starpips reference manifest exactly matches known non-secret deployment identifiers', () => {
  assert.equal(STAR_PIPS.id, 'starpips');
  assert.equal(STAR_PIPS.productionBranch, 'production/starpips');
  assert.equal(STAR_PIPS.appWorker, 'mklms');
  assert.equal(STAR_PIPS.mediaWorker, 'mklms-media-delivery');
  assert.equal(STAR_PIPS.publicDomain, 'learn.starpipsforex.com');
  assert.equal(STAR_PIPS.r2Bucket, 'spf-media');
  assert.equal(STAR_PIPS.hyperdrive.freshId, 'bb7c9f70c2fe402080c22e06d0c0f305');
  assert.equal(STAR_PIPS.hyperdrive.cachedId, '14a4baf3773d41c88e4600967ab3b68d');
  assert.deepEqual(STAR_PIPS.rateLimits, {
    auth: '51090501',
    admin: '51090502',
    studentMutation: '51090503',
    playback: '51090504',
    certificate: '51090505',
  });
  assert.equal(STAR_PIPS.billingInstallationId, 'spf-mklms');
});

test('manifest validator source is local-only and contains no deployment/network clients', () => {
  for (const path of [
    'scripts/installation-manifest.mjs',
    'scripts/validate-installation-manifest.mjs',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|\bcurl\b|wrangler\s+deploy|opennextjs-cloudflare\s+deploy/i);
    assert.doesNotMatch(source, /node:child_process|\bexec\s*\(|\bspawn\s*\(|\bpg\b|@aws-sdk/i);
  }
});

test('package wires the pure local installation validation command', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['installation:validate'], 'node scripts/validate-installation-manifest.mjs');
});

test('repository installation validation CLI succeeds locally', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-installation-manifest.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 4 installation manifest files\./);
});
