#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const reportPath = '/tmp/mklms-postgres-catalog.json';
process.argv[2] = reportPath;
await import('./export-postgres-schema-catalog.mjs');

const compressed = gzipSync(await readFile(reportPath));
const payload = compressed.toString('base64');
const chunkSize = 4_000;
const total = Math.ceil(payload.length / chunkSize);
process.stdout.write(`MKLMS_CATALOG_BEGIN chunks=${total} bytes=${compressed.length}\n`);
for (let index = 0; index < total; index += 1) {
  const chunk = payload.slice(index * chunkSize, (index + 1) * chunkSize);
  process.stdout.write(`MKLMS_CATALOG_CHUNK:${index + 1}/${total}:${chunk}\n`);
}
process.stdout.write('MKLMS_CATALOG_END\n');
