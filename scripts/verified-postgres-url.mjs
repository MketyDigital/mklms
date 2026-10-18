const VERIFIED_TLS_MODES = new Set(['verify-full', 'verify-ca', 'require']);

/**
 * Keep the configured host intact while requiring TLS for a migration source.
 * The repository stores SSL mode separately for some legacy database secrets.
 */
export function verifiedPostgresUrl(connectionString, configuredSslMode) {
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
  // pg-connection-string treats libpq's "require" as encryption without
  // hostname validation; normalize it to the stricter certificate check.
  url.searchParams.set('sslmode', sslMode === 'require' ? 'verify-full' : sslMode);
  return url.toString();
}
