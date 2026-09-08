import { createHash } from 'node:crypto';
import { assertInstallationObjectIsUnprotected, PROTECTED_STARPIPS_VALUES } from './protected-installation-resources.mjs';

const RATE_KEYS = ['auth', 'admin', 'studentMutation', 'playback', 'certificate'];

export function deterministicRateLimitNamespaceId(installationId, key) {
  const digest = createHash('sha256').update(`${installationId}:${key}`).digest();
  let value = digest.readUInt32BE(0) % 900000000;
  value += 100000000;
  let candidate = String(value);
  while (PROTECTED_STARPIPS_VALUES.has(candidate)) {
    value = value >= 999999999 ? 100000000 : value + 1;
    candidate = String(value);
  }
  return candidate;
}

export function buildPreparedProposal({ publicDomain = 'academy.mkety.com' } = {}) {
  const proposal = {
    schemaVersion: 1,
    kind: 'installation',
    deployable: false,
    id: 'mkety-academy',
    productionBranch: 'production/mkety-academy',
    appWorker: 'mklms-mkety-academy',
    mediaWorker: 'mklms-media-mkety-academy',
    publicDomain,
    domain: {
      mode: 'provider-domain',
      platformId: 'mkety-saas',
    },
    r2Bucket: 'mkety-academy-media',
    hyperdrive: {
      freshId: 'EXAMPLE_MKETY_HYPERDRIVE_FRESH_ID',
      cachedId: 'EXAMPLE_MKETY_HYPERDRIVE_CACHED_ID',
    },
    rateLimits: Object.fromEntries(
      RATE_KEYS.map((key) => [key, deterministicRateLimitNamespaceId('mkety-academy', key)]),
    ),
    billingInstallationId: 'mkety-academy',
    databaseOrigin: {
      host: 'db.vdblajgxrfndjesoyayy.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'mkety_academy_app',
    },
  };
  assertInstallationObjectIsUnprotected(proposal);
  return proposal;
}
