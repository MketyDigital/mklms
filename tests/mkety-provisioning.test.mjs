import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertProvisioningTarget,
  buildMketyProvisioningPlan,
  buildProposedManifest,
} from '../scripts/mkety-provisioning.mjs';

const base = {
  id: 'mkety-academy',
  productionBranch: 'production/mkety-academy',
  appWorker: 'mklms-mkety-academy',
  mediaWorker: 'mklms-media-mkety-academy',
  publicDomain: 'academy.mkety.com',
  r2Bucket: 'mkety-academy-media',
  billingInstallationId: 'mkety-academy',
  rateLimits: {
    auth: '62091001',
    admin: '62091002',
    studentMutation: '62091003',
    playback: '62091004',
    certificate: '62091005',
  },
};

test('Mkety provisioning plan accepts isolated identifiers and is deterministic', () => {
  const plan = buildMketyProvisioningPlan(base);
  assert.equal(plan.id, 'mkety-academy');
  assert.equal(plan.hyperdriveFreshName, 'mklms-mkety-academy-fresh');
  assert.equal(plan.hyperdriveCachedName, 'mklms-mkety-academy-cached');
  assert.equal(plan.r2Bucket, 'mkety-academy-media');
  assert.deepEqual(plan.rateLimits, base.rateLimits);
  assertProvisioningTarget(plan);
});

test('provisioning guard rejects every protected Starpips identity', () => {
  const protectedOverrides = [
    ['id', 'starpips'],
    ['productionBranch', 'production/starpips'],
    ['appWorker', 'mklms'],
    ['mediaWorker', 'mklms-media-delivery'],
    ['publicDomain', 'learn.starpipsforex.com'],
    ['r2Bucket', 'spf-media'],
    ['billingInstallationId', 'spf-mklms'],
    ['hyperdriveFreshId', 'bb7c9f70c2fe402080c22e06d0c0f305'],
    ['hyperdriveCachedId', '14a4baf3773d41c88e4600967ab3b68d'],
  ];
  for (const [field, value] of protectedOverrides) {
    const input = { ...buildMketyProvisioningPlan(base), [field]: value };
    assert.throws(() => assertProvisioningTarget(input), /protected Starpips/i, `${field} should be rejected`);
  }
});

test('provisioning guard rejects Starpips rate-limit namespaces and duplicate Mkety namespaces', () => {
  const plan = buildMketyProvisioningPlan(base);
  assert.throws(
    () => assertProvisioningTarget({ ...plan, rateLimits: { ...plan.rateLimits, auth: '51090501' } }),
    /protected Starpips/i,
  );
  assert.throws(
    () => assertProvisioningTarget({ ...plan, rateLimits: { ...plan.rateLimits, admin: plan.rateLimits.auth } }),
    /unique/i,
  );
});

test('proposed manifest contains only new non-secret resource identifiers', () => {
  const plan = buildMketyProvisioningPlan(base);
  const manifest = buildProposedManifest(plan, {
    hyperdriveFreshId: 'fresh-new-id',
    hyperdriveCachedId: 'cached-new-id',
  });
  assert.deepEqual(manifest.hyperdrive, {
    freshId: 'fresh-new-id',
    cachedId: 'cached-new-id',
  });
  assert.equal(manifest.deployable, true);
  assert.equal(manifest.r2Bucket, 'mkety-academy-media');
  assert.doesNotMatch(JSON.stringify(manifest), /password|database_url|token|secret|credential/i);
});
