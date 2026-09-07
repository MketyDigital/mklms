export const REQUIRED_RATE_LIMIT_KEYS = [
  'auth',
  'admin',
  'studentMutation',
  'playback',
  'certificate',
];

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROD_BRANCH_RE = /^production\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const DATABASE_URL_RE = /^postgres(?:ql)?:\/\//i;
const SECRET_KEY_PARTS = [
  'secret',
  'password',
  'credential',
  'token',
  'api_key',
  'apikey',
  'access_key',
  'private_key',
  'database_url',
];

export function classifyManifest(filename) {
  if (filename === 'customer-template.json') return 'template';
  if (filename.endsWith('.example.json')) return 'example';
  return 'concrete';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function walk(value, path = '', visitor) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visitor));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    visitor(key, child, childPath);
    walk(child, childPath, visitor);
  }
}

function hasPlaceholder(value, prefix) {
  let found = false;
  const inspect = (current) => {
    if (typeof current === 'string' && current.startsWith(prefix)) found = true;
    if (Array.isArray(current)) current.forEach(inspect);
    else if (isObject(current)) Object.values(current).forEach(inspect);
  };
  inspect(value);
  return found;
}

function hasWrongPlaceholder(value, allowedPrefix) {
  let found = false;
  const inspect = (current) => {
    if (typeof current === 'string' && /^(EXAMPLE_|TEMPLATE_)/.test(current) && !current.startsWith(allowedPrefix)) found = true;
    if (Array.isArray(current)) current.forEach(inspect);
    else if (isObject(current)) Object.values(current).forEach(inspect);
  };
  inspect(value);
  return found;
}

export function validateManifest(manifest, { filename, manifestType }) {
  const errors = [];
  const push = (field, message) => errors.push(`${field}: ${message}`);

  if (!isObject(manifest)) return ['manifest: must be an object'];

  if (manifest.schemaVersion !== 1) push('schemaVersion', 'must equal 1');
  if (manifest.kind !== 'installation') push('kind', 'must equal installation');
  if (typeof manifest.deployable !== 'boolean') push('deployable', 'must be boolean');
  if (typeof manifest.id !== 'string' || !ID_RE.test(manifest.id)) push('id', 'must be a lowercase slug');
  if (typeof manifest.productionBranch !== 'string' || !PROD_BRANCH_RE.test(manifest.productionBranch)) push('productionBranch', 'must match production/<slug>');
  if (typeof manifest.appWorker !== 'string' || !manifest.appWorker) push('appWorker', 'is required');
  if (typeof manifest.mediaWorker !== 'string' || !manifest.mediaWorker) push('mediaWorker', 'is required');
  if (manifest.appWorker && manifest.mediaWorker && manifest.appWorker === manifest.mediaWorker) push('mediaWorker', 'must differ from appWorker');
  if (typeof manifest.publicDomain !== 'string' || !HOSTNAME_RE.test(manifest.publicDomain)) push('publicDomain', 'must be a hostname without protocol or path');
  if (typeof manifest.r2Bucket !== 'string' || !manifest.r2Bucket) push('r2Bucket', 'is required');

  if (!isObject(manifest.hyperdrive)) {
    push('hyperdrive', 'is required');
  } else {
    if (typeof manifest.hyperdrive.freshId !== 'string' || !manifest.hyperdrive.freshId) push('hyperdrive.freshId', 'is required');
    if (typeof manifest.hyperdrive.cachedId !== 'string' || !manifest.hyperdrive.cachedId) push('hyperdrive.cachedId', 'is required');
    if (manifest.hyperdrive.freshId && manifest.hyperdrive.cachedId && manifest.hyperdrive.freshId === manifest.hyperdrive.cachedId) push('hyperdrive', 'freshId and cachedId must differ');
  }

  if (!isObject(manifest.rateLimits)) {
    push('rateLimits', 'is required');
  } else {
    const keys = Object.keys(manifest.rateLimits).sort();
    const expectedKeys = [...REQUIRED_RATE_LIMIT_KEYS].sort();
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) push('rateLimits', 'must contain exactly the required limiter keys');
    for (const key of REQUIRED_RATE_LIMIT_KEYS) {
      if (typeof manifest.rateLimits[key] !== 'string' || !manifest.rateLimits[key]) push(`rateLimits.${key}`, 'is required');
    }
    const rateValues = REQUIRED_RATE_LIMIT_KEYS.map((key) => manifest.rateLimits[key]).filter(Boolean);
    if (new Set(rateValues).size !== rateValues.length) push('rateLimits', 'namespace IDs must be unique within an installation');
  }

  if (typeof manifest.billingInstallationId !== 'string' || !manifest.billingInstallationId) push('billingInstallationId', 'is required');

  walk(manifest, '', (key, value, fieldPath) => {
    const normalized = normalizeKey(key);
    if (SECRET_KEY_PARTS.some((part) => normalized.includes(part))) push(fieldPath, 'secret-like fields are forbidden');
    if (typeof value === 'string' && DATABASE_URL_RE.test(value)) push(fieldPath, 'database connection URLs are forbidden');
  });

  if (manifestType === 'concrete') {
    if (manifest.deployable !== true) push('deployable', 'concrete manifests must be deployable');
    if (hasPlaceholder(manifest, 'EXAMPLE_') || hasPlaceholder(manifest, 'TEMPLATE_')) push('manifest', 'concrete manifests cannot contain placeholder sentinels');
  } else if (manifestType === 'example') {
    if (manifest.deployable !== false) push('deployable', 'example manifests must be non-deployable');
    if (hasWrongPlaceholder(manifest, 'EXAMPLE_')) push('manifest', 'example manifests may only use EXAMPLE_ sentinels');
  } else if (manifestType === 'template') {
    if (manifest.deployable !== false) push('deployable', 'template manifests must be non-deployable');
    if (hasWrongPlaceholder(manifest, 'TEMPLATE_')) push('manifest', 'template manifests may only use TEMPLATE_ sentinels');
  } else {
    push('manifestType', `unsupported type for ${filename}`);
  }

  return errors;
}

function collectConcreteResources(entry) {
  const { manifest } = entry;
  return {
    id: [manifest.id],
    productionBranch: [manifest.productionBranch],
    appWorker: [manifest.appWorker],
    mediaWorker: [manifest.mediaWorker],
    publicDomain: [manifest.publicDomain],
    r2Bucket: [manifest.r2Bucket],
    billingInstallationId: [manifest.billingInstallationId],
    hyperdriveId: [manifest.hyperdrive?.freshId, manifest.hyperdrive?.cachedId].filter(Boolean),
    rateLimitNamespaceId: REQUIRED_RATE_LIMIT_KEYS.map((key) => manifest.rateLimits?.[key]).filter(Boolean),
  };
}

export function validateInstallationSet(entries) {
  const errors = [];
  const seen = new Map();
  const concrete = entries.filter((entry) => entry.manifestType === 'concrete').sort((a, b) => a.filename.localeCompare(b.filename));

  for (const entry of concrete) {
    const resources = collectConcreteResources(entry);
    for (const [resourceType, values] of Object.entries(resources)) {
      for (const value of values) {
        const key = `${resourceType}:${value}`;
        if (seen.has(key)) errors.push(`${entry.filename}: ${resourceType} duplicates ${seen.get(key)} (${value})`);
        else seen.set(key, entry.filename);
      }
    }
  }

  return errors.sort();
}
