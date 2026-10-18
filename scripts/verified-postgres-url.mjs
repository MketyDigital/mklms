const VERIFIED_TLS_MODES = new Set(['verify-full', 'verify-ca', 'require']);

/**
 * Keep the configured host intact while requiring TLS for a migration source.
 * The repository stores SSL mode separately for some legacy database secrets.
 */
export function verifiedPostgresUrl(connectionString, configuredSslMode, { allowUnverifiedRequire = false } = {}) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Configured PostgreSQL connection URL is invalid.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('PostgreSQL URL required.');
  }

  const queryMode = url.searchParams.get('sslmode')?.toLowerCase();
  const separateMode = configuredSslMode?.trim().toLowerCase();
  if (queryMode && separateMode && queryMode !== separateMode) {
    throw new Error('PostgreSQL URL SSL mode conflicts with the configured database SSL mode.');
  }
  const sslMode = queryMode || separateMode;
  if (!VERIFIED_TLS_MODES.has(sslMode)) {
    throw new Error('Production PostgreSQL audit URL must require verified TLS.');
  }
  // By default, strengthen libpq's "require" to verify-full. The explicit
  // compatibility option is only for read-only catalog audits against the
  // existing Starpips endpoint, whose self-signed chain has no available CA.
  // node-postgres interprets sslmode=require as encrypted TLS without
  // certificate verification, matching the live application's current mode.
  const preserveRequire = allowUnverifiedRequire && sslMode === 'require';
  url.searchParams.set('sslmode', sslMode === 'require' && !preserveRequire ? 'verify-full' : sslMode);
  if (preserveRequire) url.searchParams.set('uselibpqcompat', 'true');
  return url.toString();
}
