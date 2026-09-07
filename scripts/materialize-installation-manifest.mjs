import { assertInstallationObjectIsUnprotected } from './protected-installation-resources.mjs';
import { validateManifest } from './installation-manifest.mjs';

export function materializeInstallationManifest(proposal, provisioning) {
  const r2Bucket = provisioning?.r2Bucket?.trim();
  const hyperdriveFreshId = provisioning?.hyperdriveFreshId?.trim();
  const hyperdriveCachedId = provisioning?.hyperdriveCachedId?.trim();

  if (!r2Bucket) throw new Error('R2 bucket is required before materializing a deployable manifest.');
  if (!hyperdriveFreshId || !hyperdriveCachedId) {
    throw new Error('Both Mkety Hyperdrive IDs are required before materializing a deployable manifest.');
  }

  const manifest = {
    ...proposal,
    deployable: true,
    r2Bucket,
    hyperdrive: {
      freshId: hyperdriveFreshId,
      cachedId: hyperdriveCachedId,
    },
  };

  assertInstallationObjectIsUnprotected(manifest);
  const errors = validateManifest(manifest, {
    filename: `${manifest.id}.json`,
    manifestType: 'concrete',
  });
  if (errors.length) throw new Error(`Concrete installation manifest is invalid:\n${errors.join('\n')}`);
  return manifest;
}
