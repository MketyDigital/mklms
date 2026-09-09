import test from 'node:test';
import assert from 'node:assert/strict';

const modulePath = '../scripts/migration-manifest.mjs';

test('migration manifest lists every numbered migration with SHA-256 checksum', async () => {
  const { loadMigrationManifest } = await import(modulePath);
  const manifest = await loadMigrationManifest();
  assert.equal(manifest.length, 19);
  assert.equal(manifest[0].filename, '001_mklms_foundation.sql');
  assert.equal(manifest.at(-2).filename, '018_certificate_visual_layout_and_starpips_calibration.sql');
  assert.equal(manifest.at(-1).filename, '019_managed_hosting_daily_ledger.sql');
  for (const entry of manifest) assert.match(entry.checksumSha256, /^[0-9a-f]{64}$/);
});
