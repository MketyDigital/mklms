import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_DIR = path.join(ROOT, 'db', 'migrations');
const MIGRATION_RE = /^\d{3}_[a-z0-9_]+\.sql$/;

export async function loadMigrationManifest(dir = DEFAULT_DIR) {
  const files = (await readdir(dir)).filter((file) => MIGRATION_RE.test(file)).sort();
  const manifest = [];
  for (const filename of files) {
    const content = await readFile(path.join(dir, filename), 'utf8');
    manifest.push({
      filename,
      checksumSha256: createHash('sha256').update(content).digest('hex'),
    });
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await loadMigrationManifest(), null, 2));
}
