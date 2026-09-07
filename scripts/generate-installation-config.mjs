import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAppWrangler, buildMediaWrangler, loadConcreteInstallation, renderJson } from './installation-config.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/generate-installation-config.mjs <installation-id>');
  process.exit(1);
}

function relocateAppConfig(config) {
  return {
    ...config,
    $schema: '../../node_modules/wrangler/config-schema.json',
    main: '../../.open-next/worker.js',
    build: undefined,
    assets: {
      ...config.assets,
      directory: '../../.open-next/assets',
    },
  };
}

function relocateMediaConfig(config) {
  return {
    ...config,
    $schema: '../../node_modules/wrangler/config-schema.json',
    main: '../../workers/media-delivery/src/index.ts',
  };
}

try {
  const { manifest } = await loadConcreteInstallation(id);
  const target = join(ROOT, '.generated', id);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'app.wrangler.jsonc'), renderJson(relocateAppConfig(buildAppWrangler(manifest))), 'utf8');
  await writeFile(join(target, 'media.wrangler.jsonc'), renderJson(relocateMediaConfig(buildMediaWrangler(manifest))), 'utf8');
  console.log(`Generated installation config for ${id} in .generated/${id}/`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
