import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyManifest,
  validateInstallationSet,
  validateManifest,
} from './installation-manifest.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const installationsDir = join(repoRoot, 'deploy', 'installations');

const filenames = readdirSync(installationsDir)
  .filter((filename) => filename.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b));

const entries = [];
const errors = [];

for (const filename of filenames) {
  const path = join(installationsDir, filename);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    errors.push(`${filename}: manifest: invalid JSON`);
    continue;
  }

  const manifestType = classifyManifest(filename);
  const validationErrors = validateManifest(manifest, { filename, manifestType });
  for (const error of validationErrors) errors.push(`${filename}: ${error}`);
  entries.push({ filename, manifest, manifestType });
}

for (const error of validateInstallationSet(entries)) errors.push(error);

if (errors.length > 0) {
  for (const error of errors.sort()) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Validated ${filenames.length} installation manifest files.`);
}
