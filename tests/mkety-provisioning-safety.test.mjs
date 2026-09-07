import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROTECTED_STARPIPS_VALUES,
  assertNotProtectedInstallationTarget,
} from '../scripts/protected-installation-resources.mjs';
import {
  buildPreparedProposal,
  deterministicRateLimitNamespaceId,
} from '../scripts/prepare-installation-proposal.mjs';
import { materializeInstallationManifest } from '../scripts/materialize-installation-manifest.mjs';

const starpipsValues = [
  'starpips',
  'production/starpips',
  'mklms',
  'mklms-media-delivery',
  'learn.starpipsforex.com',
  'spf-media',
  'spf-mklms',
  'bb7c9f70c2fe402080c22e06d0c0f305',
  '14a4baf3773d41c88e4600967ab3b68d',
  '51090501', '51090502', '51090503', '51090504', '51090505',
];

test('all known Starpips production identifiers are protected', () => {
  for (const value of starpipsValues) {
    assert.equal(PROTECTED_STARPIPS_VALUES.has(value), true, value);
    assert.throws(() => assertNotProtectedInstallationTarget(value), /protected Starpips/i);
  }
  assert.doesNotThrow(() => assertNotProtectedInstallationTarget('mklms-mkety-academy'));
});

test('Mkety rate limit namespace ids are deterministic unique positive integer strings', () => {
  const keys = ['auth', 'admin', 'studentMutation', 'playback', 'certificate'];
  const ids = keys.map((key) => deterministicRateLimitNamespaceId('mkety-academy', key));
  assert.equal(new Set(ids).size, keys.length);
  for (const id of ids) assert.match(id, /^[1-9][0-9]+$/);
  assert.deepEqual(ids, keys.map((key) => deterministicRateLimitNamespaceId('mkety-academy', key)));
  for (const id of ids) assert.equal(PROTECTED_STARPIPS_VALUES.has(id), false);
});

test('prepared Mkety proposal is non-deployable and cannot collide with Starpips', () => {
  const prepared = buildPreparedProposal({ publicDomain: 'academy.mkety.com' });
  assert.equal(prepared.id, 'mkety-academy');
  assert.equal(prepared.deployable, false);
  assert.equal(prepared.productionBranch, 'production/mkety-academy');
  assert.equal(prepared.appWorker, 'mklms-mkety-academy');
  assert.equal(prepared.mediaWorker, 'mklms-media-mkety-academy');
  assert.equal(prepared.r2Bucket, 'mkety-academy-media');
  assert.equal(prepared.billingInstallationId, 'mkety-academy');
  assert.equal(Object.values(prepared.rateLimits).every((id) => /^[1-9][0-9]+$/.test(id)), true);
});

test('manifest materialization fails closed until both Mkety Hyperdrive ids exist', () => {
  const proposal = buildPreparedProposal({ publicDomain: 'academy.mkety.com' });
  assert.throws(
    () => materializeInstallationManifest(proposal, { r2Bucket: 'mkety-academy-media' }),
    /Hyperdrive/i,
  );
});

test('manifest materialization produces a concrete deployable Mkety manifest only from safe ids', () => {
  const proposal = buildPreparedProposal({ publicDomain: 'academy.mkety.com' });
  const manifest = materializeInstallationManifest(proposal, {
    r2Bucket: 'mkety-academy-media',
    hyperdriveFreshId: '11111111111111111111111111111111',
    hyperdriveCachedId: '22222222222222222222222222222222',
  });
  assert.equal(manifest.deployable, true);
  assert.equal(manifest.hyperdrive.freshId, '11111111111111111111111111111111');
  assert.equal(manifest.hyperdrive.cachedId, '22222222222222222222222222222222');
});

test('provisioning and deploy workflows are manual Mkety-only and protect Starpips', () => {
  const provision = readFileSync('.github/workflows/provision-mkety-installation.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy-mkety-installation.yml', 'utf8');

  for (const source of [provision, deploy]) {
    assert.match(source, /workflow_dispatch:/);
    assert.match(source, /mkety-academy/);
    assert.match(source, /protected-installation-resources/);
    assert.doesNotMatch(source, /production\/starpips/);
    assert.doesNotMatch(source, /spf-media/);
  }

  assert.match(provision, /accounts\/\$\{?CLOUDFLARE_ACCOUNT_ID\}?\/r2\/buckets|accounts\/\$CLOUDFLARE_ACCOUNT_ID\/r2\/buckets/);
  assert.match(provision, /hyperdrive\/configs/);
  assert.match(deploy, /generate-installation-config/);
});
