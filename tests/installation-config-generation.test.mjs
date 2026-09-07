import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const STAR_PIPS = JSON.parse(readFileSync('deploy/installations/starpips.json', 'utf8'));

test('generation module exposes deterministic config interfaces', async () => {
  const mod = await import('../scripts/installation-config.mjs');
  assert.equal(typeof mod.buildAppWrangler, 'function');
  assert.equal(typeof mod.buildMediaWrangler, 'function');
  assert.equal(typeof mod.renderJson, 'function');
  assert.equal(typeof mod.loadConcreteInstallation, 'function');
});

test('generated Starpips app config matches manifest resources', async () => {
  const { buildAppWrangler } = await import('../scripts/installation-config.mjs');
  const config = buildAppWrangler(STAR_PIPS);
  assert.equal(config.name, 'mklms');
  assert.equal(config.main, '.open-next/worker.js');
  assert.equal(config.compatibility_date, '2026-08-30');
  assert.deepEqual(config.compatibility_flags, ['nodejs_compat']);
  assert.equal(config.build.command, 'npm run cf:build');
  assert.deepEqual(config.assets, { directory: '.open-next/assets', binding: 'ASSETS' });
  assert.equal(config.observability.enabled, true);
  assert.deepEqual(config.hyperdrive, [
    { binding: 'HYPERDRIVE_FRESH', id: STAR_PIPS.hyperdrive.freshId },
    { binding: 'HYPERDRIVE_CACHED', id: STAR_PIPS.hyperdrive.cachedId },
  ]);
  assert.deepEqual(config.r2_buckets, [{ binding: 'APP_STORAGE_BUCKET', bucket_name: 'spf-media' }]);
  assert.deepEqual(config.ratelimits.map(({ name, namespace_id, simple }) => ({ name, namespace_id, simple })), [
    { name: 'AUTH_RATE_LIMITER', namespace_id: '51090501', simple: { limit: 10, period: 60 } },
    { name: 'ADMIN_RATE_LIMITER', namespace_id: '51090502', simple: { limit: 30, period: 60 } },
    { name: 'STUDENT_MUTATION_RATE_LIMITER', namespace_id: '51090503', simple: { limit: 20, period: 60 } },
    { name: 'PLAYBACK_RATE_LIMITER', namespace_id: '51090504', simple: { limit: 60, period: 60 } },
    { name: 'CERT_RATE_LIMITER', namespace_id: '51090505', simple: { limit: 10, period: 60 } },
  ]);
});

test('generated Starpips media config matches manifest resources', async () => {
  const { buildMediaWrangler } = await import('../scripts/installation-config.mjs');
  const config = buildMediaWrangler(STAR_PIPS);
  assert.equal(config.name, 'mklms-media-delivery');
  assert.equal(config.main, 'src/index.ts');
  assert.equal(config.compatibility_date, '2026-08-30');
  assert.equal(config.observability.enabled, true);
  assert.deepEqual(config.r2_buckets, [{ binding: 'MEDIA_BUCKET', bucket_name: 'spf-media' }]);
});

test('rendering is deterministic and contains no secret material', async () => {
  const { buildAppWrangler, renderJson } = await import('../scripts/installation-config.mjs');
  const a = renderJson(buildAppWrangler(STAR_PIPS));
  const b = renderJson(buildAppWrangler(STAR_PIPS));
  assert.equal(a, b);
  assert.ok(a.endsWith('\n'));
  assert.doesNotMatch(a, /DATABASE_URL|PASSWORD|SECRET|TOKEN|ACCESS_KEY/i);
});

test('production generation rejects unknown and non-deployable installations', async () => {
  const { loadConcreteInstallation } = await import('../scripts/installation-config.mjs');
  await assert.rejects(() => loadConcreteInstallation('does-not-exist'));
  await assert.rejects(() => loadConcreteInstallation('mkety-academy'));
  await assert.rejects(() => loadConcreteInstallation('customer-template'));
});

test('generated output directory is ignored', () => {
  const gitignore = readFileSync('.gitignore', 'utf8');
  assert.match(gitignore, /^\/\.generated\/$/m);
});

test('Starpips generated configuration is semantically equivalent to committed Wrangler configs', async () => {
  const { compareStarpipsGeneratedConfig } = await import('../scripts/compare-starpips-generated-config.mjs');
  const result = compareStarpipsGeneratedConfig();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
});

test('generated Wrangler files use paths relative to their .generated installation directory', () => {
  const result = spawnSync(process.execPath, ['scripts/generate-installation-config.mjs', 'starpips'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const app = JSON.parse(readFileSync('.generated/starpips/app.wrangler.jsonc', 'utf8'));
  const media = JSON.parse(readFileSync('.generated/starpips/media.wrangler.jsonc', 'utf8'));
  assert.equal(app.main, '../../.open-next/worker.js');
  assert.equal(app.assets.directory, '../../.open-next/assets');
  assert.equal('build' in app, false);
  assert.equal(media.main, '../../workers/media-delivery/src/index.ts');
});

test('generation and comparison sources are local-only and never deploy', () => {
  for (const path of [
    'scripts/installation-config.mjs',
    'scripts/generate-installation-config.mjs',
    'scripts/compare-starpips-generated-config.mjs',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|\bcurl\b|wrangler\s+deploy|opennextjs-cloudflare\s+deploy/i);
    assert.doesNotMatch(source, /node:child_process|\bexec\s*\(|\bspawn\s*\(/);
  }
});
