import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const FORBIDDEN_MKLMS_HOSTS = new Set(['saas-origin.mkety.com']);

function isUnderZone(hostname, zone) {
  return hostname === zone || hostname.endsWith(`.${zone}`);
}

export function validateSaasPlatform(platform) {
  const errors = [];
  const push = (field, message) => errors.push(`${field}: ${message}`);

  if (!platform || typeof platform !== 'object' || Array.isArray(platform)) return ['platform: must be an object'];
  if (platform.schemaVersion !== 1) push('schemaVersion', 'must equal 1');
  if (platform.kind !== 'saas-platform') push('kind', 'must equal saas-platform');
  if (typeof platform.id !== 'string' || !ID_RE.test(platform.id)) push('id', 'must be a lowercase slug');

  for (const field of ['providerZone', 'customerCnameTarget', 'routingOrigin']) {
    const value = platform[field];
    if (typeof value !== 'string' || !HOSTNAME_RE.test(value)) push(field, 'must be a hostname without protocol or path');
    if (typeof value === 'string' && FORBIDDEN_MKLMS_HOSTS.has(value.toLowerCase())) {
      push(field, 'saas-origin.mkety.com belongs to another project and is forbidden in MkLMS SaaS configuration');
    }
  }

  if (HOSTNAME_RE.test(platform.providerZone ?? '')) {
    for (const field of ['customerCnameTarget', 'routingOrigin']) {
      const value = platform[field];
      if (HOSTNAME_RE.test(value ?? '') && !isUnderZone(value, platform.providerZone)) {
        push(field, 'must be within the providerZone');
      }
    }
  }

  return errors;
}

export async function loadSaasPlatform(platformId, { rootDir = process.cwd() } = {}) {
  if (typeof platformId !== 'string' || !ID_RE.test(platformId)) throw new Error('Invalid SaaS platform id.');
  const platformPath = path.join(rootDir, 'deploy', 'platforms', `${platformId}.json`);
  const platform = JSON.parse(await readFile(platformPath, 'utf8'));
  const errors = validateSaasPlatform(platform);
  if (platform.id !== platformId) errors.push(`id: expected ${platformId}`);
  if (errors.length > 0) throw new Error(`Invalid SaaS platform ${platformId}: ${errors.join('; ')}`);
  return { platform, platformPath };
}
