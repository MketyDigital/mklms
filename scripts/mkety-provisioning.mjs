const PROTECTED = new Set([
  'starpips',
  'production/starpips',
  'mklms',
  'mklms-media-delivery',
  'spf-media',
  'learn.starpipsforex.com',
  'spf-mklms',
  'bb7c9f70c2fe402080c22e06d0c0f305',
  '14a4baf3773d41c88e4600967ab3b68d',
  '51090501',
  '51090502',
  '51090503',
  '51090504',
  '51090505',
]);

const RATE_KEYS = ['auth', 'admin', 'studentMutation', 'playback', 'certificate'];

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

export function assertProvisioningTarget(input) {
  const scalarFields = [
    'id', 'productionBranch', 'appWorker', 'mediaWorker', 'publicDomain',
    'r2Bucket', 'billingInstallationId', 'hyperdriveFreshId', 'hyperdriveCachedId',
  ];
  for (const field of scalarFields) {
    const value = input[field];
    if (value && PROTECTED.has(String(value))) {
      throw new Error(`${field} references a protected Starpips resource.`);
    }
  }
  if (input.id !== 'mkety-academy') throw new Error('Only mkety-academy is provisionable in this rollout.');
  if (input.productionBranch !== 'production/mkety-academy') throw new Error('Mkety production branch must be production/mkety-academy.');
  const rateValues = RATE_KEYS.map((key) => requireString(input.rateLimits?.[key], `rateLimits.${key}`));
  if (rateValues.some((value) => PROTECTED.has(value))) {
    throw new Error('rateLimits references a protected Starpips resource.');
  }
  if (new Set(rateValues).size !== rateValues.length) throw new Error('Mkety rate-limit namespace IDs must be unique.');
  if (rateValues.some((value) => !/^\d+$/.test(value) || Number(value) <= 0)) {
    throw new Error('Mkety rate-limit namespace IDs must be positive integer strings.');
  }
  return true;
}

export function buildMketyProvisioningPlan(input) {
  const plan = {
    id: requireString(input.id, 'id'),
    productionBranch: requireString(input.productionBranch, 'productionBranch'),
    appWorker: requireString(input.appWorker, 'appWorker'),
    mediaWorker: requireString(input.mediaWorker, 'mediaWorker'),
    publicDomain: requireString(input.publicDomain, 'publicDomain'),
    r2Bucket: requireString(input.r2Bucket, 'r2Bucket'),
    billingInstallationId: requireString(input.billingInstallationId, 'billingInstallationId'),
    hyperdriveFreshName: `${requireString(input.appWorker, 'appWorker')}-fresh`,
    hyperdriveCachedName: `${requireString(input.appWorker, 'appWorker')}-cached`,
    rateLimits: Object.fromEntries(RATE_KEYS.map((key) => [key, requireString(input.rateLimits?.[key], `rateLimits.${key}`)])),
  };
  assertProvisioningTarget(plan);
  return plan;
}

export function buildProposedManifest(plan, created) {
  const manifest = {
    schemaVersion: 1,
    kind: 'installation',
    deployable: true,
    id: plan.id,
    productionBranch: plan.productionBranch,
    appWorker: plan.appWorker,
    mediaWorker: plan.mediaWorker,
    publicDomain: plan.publicDomain,
    r2Bucket: plan.r2Bucket,
    hyperdrive: {
      freshId: requireString(created.hyperdriveFreshId, 'hyperdriveFreshId'),
      cachedId: requireString(created.hyperdriveCachedId, 'hyperdriveCachedId'),
    },
    rateLimits: { ...plan.rateLimits },
    billingInstallationId: plan.billingInstallationId,
  };
  assertProvisioningTarget({
    ...plan,
    hyperdriveFreshId: manifest.hyperdrive.freshId,
    hyperdriveCachedId: manifest.hyperdrive.cachedId,
  });
  return manifest;
}
