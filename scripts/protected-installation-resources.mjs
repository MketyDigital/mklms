export const PROTECTED_STARPIPS_VALUES = new Set([
  'starpips',
  'production/starpips',
  'mklms',
  'mklms-media-delivery',
  'learn.starpipsforex.com',
  'spf-media',
  'spf-mklms',
  'bb7c9f70c2fe402080c22e06d0c0f305',
  '14a4baf3773d41c88e4600967ab3b68d',
  '51090501',
  '51090502',
  '51090503',
  '51090504',
  '51090505',
]);

export function assertNotProtectedInstallationTarget(value, label = 'target') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (PROTECTED_STARPIPS_VALUES.has(value.trim())) {
    throw new Error(`${label} resolves to a protected Starpips production resource: ${value.trim()}`);
  }
  return value.trim();
}

export function assertInstallationObjectIsUnprotected(manifest) {
  const values = [
    manifest?.id,
    manifest?.productionBranch,
    manifest?.appWorker,
    manifest?.mediaWorker,
    manifest?.publicDomain,
    manifest?.r2Bucket,
    manifest?.billingInstallationId,
    manifest?.hyperdrive?.freshId,
    manifest?.hyperdrive?.cachedId,
    ...Object.values(manifest?.rateLimits ?? {}),
  ].filter((value) => typeof value === 'string' && value.length > 0);

  for (const value of values) assertNotProtectedInstallationTarget(value);
  return true;
}
