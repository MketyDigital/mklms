import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAppWrangler } from '../deploy/templates/app-wrangler-template.mjs';
import { buildMediaWrangler } from '../deploy/templates/media-wrangler-template.mjs';
import { classifyManifest, validateManifest } from './installation-manifest.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const INSTALLATIONS_DIR = join(ROOT, 'deploy', 'installations');

export { buildAppWrangler, buildMediaWrangler };

export function renderJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function loadConcreteInstallation(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid installation id: ${id}`);
  }

  const candidates = [
    `${id}.json`,
    `${id}.example.json`,
    id === 'customer-template' ? 'customer-template.json' : null,
  ].filter(Boolean);

  let found;
  for (const filename of candidates) {
    try {
      const raw = await readFile(join(INSTALLATIONS_DIR, filename), 'utf8');
      found = { filename, manifest: JSON.parse(raw) };
      break;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  if (!found) throw new Error(`Unknown installation: ${id}`);

  const manifestType = classifyManifest(basename(found.filename));
  const errors = validateManifest(found.manifest, { filename: found.filename, manifestType });
  if (errors.length) throw new Error(`Invalid installation manifest ${found.filename}: ${errors.join('; ')}`);
  if (manifestType !== 'concrete' || found.manifest.deployable !== true) {
    throw new Error(`Installation ${id} is not production-deployable`);
  }
  if (found.manifest.id !== id) throw new Error(`Installation id mismatch for ${found.filename}`);

  return { ...found, manifestType };
}
