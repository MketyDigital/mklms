import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function prepareOpenNextBuild(outputDir = resolve(process.cwd(), '.open-next')) {
  await rm(resolve(outputDir, 'cloudflare/next-env.mjs'), { force: true });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await prepareOpenNextBuild();
}
