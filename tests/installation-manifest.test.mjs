import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const manifestModulePath = '../scripts/installation-manifest.mjs';

function validConcrete(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'installation',
    deployable: true,
    id: 'alpha-academy',
    productionBranch: 'production/alpha-academy',
    appWorker: 'mklms-alpha-academy',
    mediaWorker: 'mklms-media-alpha-academy',
    publicDomain: 'learn.alpha.example',
    r2Bucket: 'alpha-academy-media',
    hyperdrive: {
      freshId: 'alpha-fresh',
      cachedId: 'alpha-cached',
    },
    rateLimits: {
      auth: 'alpha-rate-auth',
      admin: 'alpha-rate-admin',
      studentMutation: 'alpha-rate-student',
      playback: 'alpha-rate-playback',
      certificate: 'alpha-rate-certificate',
    },
    billingInstallationId: 'alpha-billing',
    ...overrides,
  };
}

test('installation manifest module exposes the locked validation interface', async () => {
  const mod = await import(manifestModulePath);
  assert.deepEqual(mod.REQUIRED_RATE_LIMIT_KEYS, ['auth', 'admin', 'studentMutation', 'playback', 'certificate']);
  assert.equal(typeof mod.classifyManifest, 'function');
  assert.equal(typeof mod.validateManifest, 'function');
  assert.equal(typeof mod.validateInstallationSet, 'function');
});

test('manifest filenames classify concrete, example and template files', async () => {
  const { classifyManifest } = await import(manifestModulePath);
  assert.equal(classifyManifest('starpips.json'), 'concrete');
  assert.equal(classifyManifest('mkety-academy.example.json'), 'example');
  assert.equal(classifyManifest('customer-template.json'), 'template');
});

test('concrete manifests enforce required fields and isolation inside one installation', async () => {
  const { validateManifest } = await import(manifestModulePath);
  const requiredTopLevel = ['schemaVersion', 'kind', 'deployable', 'id', 'productionBranch', 'appWorker', 'mediaWorker', 'publicDomain', 'r2Bucket', 'hyperdrive', 'rateLimits', 'billingInstallationId'];

  for (const field of requiredTopLevel) {
    const manifest = validConcrete();
    delete manifest[field];
    const errors = validateManifest(manifest, { filename: 'alpha-academy.json', manifestType: 'concrete' });
    assert.ok(errors.some((error) => error.includes(field)), `expected missing ${field} error`);
  }

  assert.ok(validateManifest(validConcrete({ id: 'Star Pips' }), { filename: 'x.json', manifestType: 'concrete' }).length > 0);
  assert.ok(validateManifest(validConcrete({ productionBranch: 'main' }), { filename: 'x.json', manifestType: 'concrete' }).length > 0);
  assert.ok(validateManifest(validConcrete({ mediaWorker: 'mklms-alpha-academy' }), { filename: 'x.json', manifestType: 'concrete' }).length > 0);

  const sameHyperdrive = validConcrete({ hyperdrive: { freshId: 'same', cachedId: 'same' } });
  assert.ok(validateManifest(sameHyperdrive, { filename: 'x.json', manifestType: 'concrete' }).length > 0);

  const duplicateRate = validConcrete();
  duplicateRate.rateLimits.admin = duplicateRate.rateLimits.auth;
  assert.ok(validateManifest(duplicateRate, { filename: 'x.json', manifestType: 'concrete' }).length > 0);
});

test('all five rate limit namespaces are required', async () => {
  const { validateManifest } = await import(manifestModulePath);
  for (const key of ['auth', 'admin', 'studentMutation', 'playback', 'certificate']) {
    const manifest = validConcrete();
    delete manifest.rateLimits[key];
    const errors = validateManifest(manifest, { filename: 'x.json', manifestType: 'concrete' });
    assert.ok(errors.some((error) => error.includes(key)), `expected missing rate limit ${key}`);
  }
});

test('secret-like fields and inline database URLs are forbidden', async () => {
  const { validateManifest } = await import(manifestModulePath);
  const mutations = [
    ['DATABASE_URL', 'postgresql://user:password@example/db'],
    ['MKLMS_ADMIN_ACCESS_KEY', 'secret'],
    ['apiToken', 'secret'],
    ['password', 'secret'],
    ['credentials', { key: 'secret' }],
    ['harmlessName', 'postgres://user:password@example/db'],
  ];

  for (const [key, value] of mutations) {
    const manifest = validConcrete();
    manifest[key] = value;
    const errors = validateManifest(manifest, { filename: 'x.json', manifestType: 'concrete' });
    assert.ok(errors.length > 0, `expected ${key} to be rejected`);
  }
});

test('examples and templates are non-deployable and concrete manifests reject sentinels', async () => {
  const { validateManifest } = await import(manifestModulePath);

  const example = validConcrete({
    deployable: false,
    r2Bucket: 'EXAMPLE_BUCKET',
    hyperdrive: { freshId: 'EXAMPLE_FRESH', cachedId: 'EXAMPLE_CACHED' },
    rateLimits: {
      auth: 'EXAMPLE_AUTH', admin: 'EXAMPLE_ADMIN', studentMutation: 'EXAMPLE_STUDENT', playback: 'EXAMPLE_PLAYBACK', certificate: 'EXAMPLE_CERT',
    },
    billingInstallationId: 'EXAMPLE_BILLING',
  });
  assert.deepEqual(validateManifest(example, { filename: 'mkety-academy.example.json', manifestType: 'example' }), []);
  assert.ok(validateManifest({ ...example, deployable: true }, { filename: 'mkety-academy.example.json', manifestType: 'example' }).length > 0);

  const template = structuredClone(example);
  template.r2Bucket = 'TEMPLATE_BUCKET';
  template.hyperdrive = { freshId: 'TEMPLATE_FRESH', cachedId: 'TEMPLATE_CACHED' };
  template.rateLimits = { auth: 'TEMPLATE_AUTH', admin: 'TEMPLATE_ADMIN', studentMutation: 'TEMPLATE_STUDENT', playback: 'TEMPLATE_PLAYBACK', certificate: 'TEMPLATE_CERT' };
  template.billingInstallationId = 'TEMPLATE_BILLING';
  assert.deepEqual(validateManifest(template, { filename: 'customer-template.json', manifestType: 'template' }), []);
  assert.ok(validateManifest({ ...template, deployable: true }, { filename: 'customer-template.json', manifestType: 'template' }).length > 0);

  assert.ok(validateManifest(validConcrete({ r2Bucket: 'EXAMPLE_BUCKET' }), { filename: 'x.json', manifestType: 'concrete' }).length > 0);
  assert.ok(validateManifest(validConcrete({ r2Bucket: 'TEMPLATE_BUCKET' }), { filename: 'x.json', manifestType: 'concrete' }).length > 0);
});

test('cross-installation isolation rejects reused resources', async () => {
  const { validateInstallationSet } = await import(manifestModulePath);
  const alpha = validConcrete();
  const betaBase = validConcrete({
    id: 'beta-academy',
    productionBranch: 'production/beta-academy',
    appWorker: 'mklms-beta-academy',
    mediaWorker: 'mklms-media-beta-academy',
    publicDomain: 'learn.beta.example',
    r2Bucket: 'beta-academy-media',
    hyperdrive: { freshId: 'beta-fresh', cachedId: 'beta-cached' },
    rateLimits: { auth: 'beta-auth', admin: 'beta-admin', studentMutation: 'beta-student', playback: 'beta-playback', certificate: 'beta-cert' },
    billingInstallationId: 'beta-billing',
  });

  const mutations = [
    (m) => { m.id = alpha.id; },
    (m) => { m.productionBranch = alpha.productionBranch; },
    (m) => { m.appWorker = alpha.appWorker; },
    (m) => { m.mediaWorker = alpha.mediaWorker; },
    (m) => { m.publicDomain = alpha.publicDomain; },
    (m) => { m.r2Bucket = alpha.r2Bucket; },
    (m) => { m.hyperdrive.freshId = alpha.hyperdrive.cachedId; },
    (m) => { m.rateLimits.auth = alpha.rateLimits.playback; },
    (m) => { m.billingInstallationId = alpha.billingInstallationId; },
  ];

  for (const mutate of mutations) {
    const beta = structuredClone(betaBase);
    mutate(beta);
    const errors = validateInstallationSet([
      { filename: 'alpha.json', manifest: alpha, manifestType: 'concrete' },
      { filename: 'beta.json', manifest: beta, manifestType: 'concrete' },
    ]);
    assert.ok(errors.length > 0, 'expected cross-installation collision');
  }
});

test('Starpips reference manifest exactly matches known non-secret deployment identifiers', () => {
  const manifest = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));
  assert.deepEqual(manifest, {
    schemaVersion: 1,
    kind: 'installation',
    deployable: true,
    id: 'starpips',
    productionBranch: 'production/starpips',
    appWorker: 'mklms',
    mediaWorker: 'mklms-media-delivery',
    publicDomain: 'learn.starpipsforex.com',
    r2Bucket: 'spf-media',
    hyperdrive: {
      freshId: 'bb7c9f70c2fe402080c22e06d0c0f305',
      cachedId: '14a4baf3773d41c88e4600967ab3b68d',
    },
    rateLimits: {
      auth: '51090501',
      admin: '51090502',
      studentMutation: '51090503',
      playback: '51090504',
      certificate: '51090505',
    },
    billingInstallationId: 'spf-mklms',
  });

  const appWrangler = readFileSync('wrangler.jsonc', 'utf8');
  const mediaWrangler = readFileSync('workers/media-delivery/wrangler.jsonc', 'utf8');
  for (const expected of ['"name": "mklms"', 'bb7c9f70c2fe402080c22e06d0c0f305', '14a4baf3773d41c88e4600967ab3b68d', 'spf-media', '51090501', '51090502', '51090503', '51090504', '51090505']) {
    assert.match(appWrangler, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(mediaWrangler, /"name": "mklms-media-delivery"/);
  assert.match(mediaWrangler, /"bucket_name": "spf-media"/);
});

test('manifest validator source is local-only and contains no deployment/network clients', () => {
  for (const path of ['scripts/installation-manifest.mjs', 'scripts/validate-installation-manifest.mjs']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\bcurl\b/);
    assert.doesNotMatch(source, /wrangler\s+deploy/);
    assert.doesNotMatch(source, /node:child_process|from ['"]child_process['"]/);
    assert.doesNotMatch(source, /\bexec\s*\(|\bspawn\s*\(/);
    assert.doesNotMatch(source, /@aws-sdk|cloudflare/i);
    assert.doesNotMatch(source, /from ['"]pg['"]|require\(['"]pg['"]\)/);
  }
});

test('package and CI wire validation without secrets or deploy side effects', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['installation:validate'], 'node scripts/validate-installation-manifest.mjs');

  const workflow = readFileSync('.github/workflows/phase1-ci.yml', 'utf8');
  assert.match(workflow, /- name: Validate installation manifests\s+run: npm run installation:validate/);
});

test('repository installation validation CLI succeeds locally', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-installation-manifest.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 3 installation manifest files\./);
});
