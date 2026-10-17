import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('Cloudflare builds clear only the generated Wrangler environment module before each build', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.scripts['cf:build'], /^node scripts\/prepare-opennext-build\.mjs && opennextjs-cloudflare build$/);
  const wranglerConfig = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(wranglerConfig.build, undefined, 'Wrangler must not rerun OpenNext after the explicit CI build');

  const { prepareOpenNextBuild } = await import('../scripts/prepare-opennext-build.mjs');
  const outputDir = await mkdtemp(path.join(tmpdir(), 'mklms-open-next-'));
  const cloudflareDir = path.join(outputDir, 'cloudflare');
  await mkdir(cloudflareDir, { recursive: true });
  await writeFile(path.join(cloudflareDir, 'next-env.mjs'), 'generated');
  await writeFile(path.join(outputDir, 'worker.js'), 'preserve this build entry');

  await prepareOpenNextBuild(outputDir);
  await assert.rejects(readFile(path.join(cloudflareDir, 'next-env.mjs')));
  assert.equal(await readFile(path.join(outputDir, 'worker.js'), 'utf8'), 'preserve this build entry');
});
