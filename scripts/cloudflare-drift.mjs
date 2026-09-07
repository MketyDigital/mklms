const APP_EXPECTATIONS = (manifest) => [
  { name: 'APP_STORAGE_BUCKET', type: 'r2_bucket', detail: 'bucket_name', expected: manifest.r2Bucket },
  { name: 'HYPERDRIVE_FRESH', type: 'hyperdrive', detail: 'id', expected: manifest.hyperdrive.freshId },
  { name: 'HYPERDRIVE_CACHED', type: 'hyperdrive', detail: 'id', expected: manifest.hyperdrive.cachedId },
  { name: 'AUTH_RATE_LIMITER', type: 'ratelimit', detail: 'namespace_id', expected: manifest.rateLimits.auth },
  { name: 'ADMIN_RATE_LIMITER', type: 'ratelimit', detail: 'namespace_id', expected: manifest.rateLimits.admin },
  { name: 'STUDENT_MUTATION_RATE_LIMITER', type: 'ratelimit', detail: 'namespace_id', expected: manifest.rateLimits.studentMutation },
  { name: 'PLAYBACK_RATE_LIMITER', type: 'ratelimit', detail: 'namespace_id', expected: manifest.rateLimits.playback },
  { name: 'CERT_RATE_LIMITER', type: 'ratelimit', detail: 'namespace_id', expected: manifest.rateLimits.certificate },
];

const MEDIA_EXPECTATIONS = (manifest) => [
  { name: 'MEDIA_BUCKET', type: 'r2_bucket', detail: 'bucket_name', expected: manifest.r2Bucket },
];

export function compareObservedBindings(manifest, observedBindings, role = 'app') {
  const expectedBindings = role === 'media' ? MEDIA_EXPECTATIONS(manifest) : APP_EXPECTATIONS(manifest);
  const observed = new Map((observedBindings ?? []).map((binding) => [binding.name, binding]));
  const results = [];

  for (const expected of expectedBindings) {
    const binding = observed.get(expected.name);
    if (!binding) {
      results.push({ field: expected.name, status: 'drift', expected: expected.type, observed: 'missing' });
      continue;
    }
    if (binding.type !== expected.type) {
      results.push({ field: `${expected.name}.type`, status: 'drift', expected: expected.type, observed: binding.type });
      continue;
    }
    results.push({ field: `${expected.name}.type`, status: 'match', expected: expected.type, observed: binding.type });

    if (!(expected.detail in binding) || binding[expected.detail] == null || binding[expected.detail] === '') {
      results.push({ field: `${expected.name}.${expected.detail}`, status: 'not_verifiable' });
      continue;
    }
    results.push({
      field: `${expected.name}.${expected.detail}`,
      status: String(binding[expected.detail]) === String(expected.expected) ? 'match' : 'drift',
      expected: String(expected.expected),
      observed: String(binding[expected.detail]),
    });
  }

  return results;
}
