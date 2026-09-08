import test from 'node:test';
import assert from 'node:assert/strict';

import { validateStarpipsMigrationState } from '../scripts/starpips-migration-guard.mjs';

const migrations = Array.from({ length: 17 }, (_, index) => ({
  filename: `${String(index + 1).padStart(3, '0')}_migration.sql`,
  checksum: `hash-${index + 1}`,
}));

const recordsThrough = (count) => migrations.slice(0, count).map(({ filename, checksum }) => ({
  filename,
  checksum_sha256: checksum,
}));

test('accepts a healthy Starpips ledger with only migration 017 pending', () => {
  const result = validateStarpipsMigrationState(recordsThrough(16), migrations, migrations[16].filename);
  assert.deepEqual(result, { targetApplied: false, safeToApplyTarget: true });
});

test('accepts an already-current Starpips ledger', () => {
  const result = validateStarpipsMigrationState(recordsThrough(17), migrations, migrations[16].filename);
  assert.deepEqual(result, { targetApplied: true, safeToApplyTarget: false });
});

test('rejects missing historical ledger entries instead of replaying old migrations', () => {
  const records = recordsThrough(16).filter((row) => !row.filename.startsWith('010_'));
  assert.throws(
    () => validateStarpipsMigrationState(records, migrations, migrations[16].filename),
    /historical migration 010_migration\.sql is not recorded/i,
  );
});

test('rejects historical checksum drift', () => {
  const records = recordsThrough(16);
  records[4] = { ...records[4], checksum_sha256: 'wrong-hash' };
  assert.throws(
    () => validateStarpipsMigrationState(records, migrations, migrations[16].filename),
    /checksum mismatch.*005_migration\.sql/i,
  );
});
