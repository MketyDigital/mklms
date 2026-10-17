#!/usr/bin/env node
/** Print D1 binding metadata from a Worker settings response without exposing IDs or secret bindings. */
import { readFile } from 'node:fs/promises';

export function summarizeD1Bindings(response, installationId) {
  if (!['starpips', 'mkety-academy'].includes(installationId)) {
    throw new Error('Unsupported installation for D1 binding summary.');
  }
  if (!response || response.success !== true || !Array.isArray(response.result?.bindings)) {
    throw new Error('Cloudflare Worker settings response is invalid.');
  }

  const bindings = response.result.bindings
    .filter((binding) => String(binding?.type ?? '').toLowerCase() === 'd1')
    .map((binding) => ({
      binding: String(binding.name ?? ''),
      databaseName: String(binding.database_name ?? ''),
    }))
    .sort((a, b) => a.binding.localeCompare(b.binding));

  if (bindings.some(({ binding, databaseName }) => !binding || !databaseName)) {
    throw new Error('Cloudflare Worker returned an incomplete D1 binding.');
  }
  return { mode: 'read-only-worker-d1-binding-summary', installationId, count: bindings.length, bindings };
}

async function main() {
  const [installationId, settingsPath] = process.argv.slice(2);
  if (!installationId || !settingsPath) {
    throw new Error('Usage: node scripts/summarize-cloudflare-d1-bindings.mjs <installation-id> <settings-response.json>');
  }
  const response = JSON.parse(await readFile(settingsPath, 'utf8'));
  console.log(JSON.stringify(summarizeD1Bindings(response, installationId)));
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Cloudflare Worker settings could not be summarized.');
    process.exit(1);
  });
}
