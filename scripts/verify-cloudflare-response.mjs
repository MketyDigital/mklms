import { readFileSync } from 'node:fs';
import { compareObservedBindings } from './cloudflare-drift.mjs';

const [manifestPath, role, responsePath] = process.argv.slice(2);
if (!manifestPath || !role || !responsePath || !['app', 'media'].includes(role)) {
  console.error('Usage: node scripts/verify-cloudflare-response.mjs <manifest-path> <app|media> <settings-response.json>');
  process.exit(1);
}

try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const response = JSON.parse(readFileSync(responsePath, 'utf8'));
  if (response.success !== true) throw new Error('Cloudflare settings response was not successful');
  const results = compareObservedBindings(manifest, response.result?.bindings ?? [], role);
  let hasDrift = false;
  for (const result of results) {
    if (result.status === 'drift') hasDrift = true;
    console.log(`${result.status}: ${result.field}`);
  }
  if (hasDrift) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
