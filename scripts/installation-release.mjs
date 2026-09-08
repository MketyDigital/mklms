import { validateInstallationSet } from './installation-manifest.mjs';

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function assertReleaseBranch(manifest, branch) {
  if (!manifest || typeof manifest.productionBranch !== 'string') {
    throw new Error('Installation production branch is missing.');
  }
  if (branch !== manifest.productionBranch) {
    throw new Error(`Release production branch must be ${manifest.productionBranch}.`);
  }
  return branch;
}

export function assertProvisionableDatabaseOrigin(manifest) {
  const origin = manifest?.databaseOrigin;
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) {
    throw new Error('Installation database origin is required for Hyperdrive provisioning.');
  }
  if (typeof origin.host !== 'string' || !HOST_RE.test(origin.host)) {
    throw new Error('Installation database origin host must be a hostname without protocol or path.');
  }
  if (!Number.isInteger(origin.port) || origin.port < 1 || origin.port > 65535) {
    throw new Error('Installation database origin port must be an integer from 1 to 65535.');
  }
  if (typeof origin.database !== 'string' || !origin.database.trim() || /[\s/?#]/.test(origin.database)) {
    throw new Error('Installation database origin database name is invalid.');
  }
  if (typeof origin.user !== 'string' || !origin.user.trim() || /\s/.test(origin.user)) {
    throw new Error('Installation database origin user is invalid.');
  }
  for (const forbidden of ['password', 'secret', 'token', 'url', 'connectionString', 'databaseUrl']) {
    if (Object.prototype.hasOwnProperty.call(origin, forbidden)) {
      throw new Error(`Installation database origin must not contain secret field ${forbidden}.`);
    }
  }
  return origin;
}

export function buildDatabaseUrl(manifest, password) {
  const origin = assertProvisionableDatabaseOrigin(manifest);
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Database password is required.');
  }
  const url = new URL('postgresql://placeholder/');
  url.username = origin.user;
  url.password = password;
  url.hostname = origin.host;
  url.port = String(origin.port);
  url.pathname = `/${origin.database}`;
  url.searchParams.set('sslmode', 'require');
  return url.toString();
}

export function assertSelectedInstallationIsolation(entries, selectedId) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Installation set is required.');
  const errors = validateInstallationSet(entries);
  if (errors.length) throw new Error(`Installation resource collision: ${errors.join('; ')}`);
  const selected = entries.find((entry) => entry?.manifestType === 'concrete' && entry?.manifest?.id === selectedId);
  if (!selected || selected.manifest.deployable !== true) {
    throw new Error(`Selected installation ${selectedId} is not a concrete deployable installation.`);
  }
  return selected.manifest;
}
