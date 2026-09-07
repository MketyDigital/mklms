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

function relocateForGeneratedDirectory(appConfig, mediaConfig) {
  return {
    app: {
      ...appConfig,
      $schema: '../../node_modules/wrangler/config-schema.json',
      main: '../../.open-next/worker.js',
      assets: {
        ...appConfig.assets,
        directory: '../../.open-next/assets',
      },
    },
    media: {
      ...mediaConfig,
      $schema: '../../node_modules/wrangler/config-schema.json',
      main: '../../workers/media-delivery/src/index.ts',
    },
  };
}

try {
  const { manifest } = await loadConcreteInstallation(id);
  const target = join(ROOT, '.generated', id);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const relocated = relocateForGeneratedDirectory(
    buildAppWrangler(manifest),
    buildMediaWrangler(manifest),
  );
  await writeFile(join(target, 'app.wrangler.jsonc'), renderJson(relocated.app), 'utf8');
  await writeFile(join(target, 'media.wrangler.jsonc'), renderJson(relocated.media), 'utf8');
  console.log(`Generated installation config for ${id} in .generated/${id}/`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
