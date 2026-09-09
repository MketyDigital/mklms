import test from 'node:test';
import assert from 'node:assert/strict';

import { validateStarpipsMigrationBatch } from '../scripts/starpips-migration-guard.mjs';

const migrations = Array.from({ length: 19 }, (_, index) => ({
  filename: `${String(index + 1).padStart(3, '0')}_migration.sql`,
  checksum: `hash-${index + 1}`,
}));
const targets = [migrations[17].filename, migrations[18].filename];

const recordsThrough = (count) => migrations.slice(0, count).map(({ filename, checksum }) => ({
  filename,
  checksum_sha256: checksum,
}));

test('accepts healthy Starpips history with migrations 018 and 019 pending', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(17), migrations, targets);
  assert.deepEqual(result, { pendingTargets: targets, allTargetsApplied: false });
});

test('accepts migration 018 already applied with only 019 pending', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(18), migrations, targets);
  assert.deepEqual(result, { pendingTargets: [targets[1]], allTargetsApplied: false });
});

test('accepts an already-current Starpips ledger through migration 019', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(19), migrations, targets);
  assert.deepEqual(result, { pendingTargets: [], allTargetsApplied: true });
});

test('rejects missing historical ledger entries instead of replaying old migrations', () => {
  const records = recordsThrough(17).filter((row) => !row.filename.startsWith('010_'));
  assert.throws(
    () => validateStarpipsMigrationBatch(records, migrations, targets),
    /historical migration 010_migration\.sql is not recorded/i,
  );
});

test('rejects historical checksum drift', () => {
  const records = recordsThrough(17);
  records[4] = { ...records[4], checksum_sha256: 'wrong-hash' };
  assert.throws(
    () => validateStarpipsMigrationBatch(records, migrations, targets),
    /checksum mismatch.*005_migration\.sql/i,
  );
});

test('rejects a later target recorded while an earlier target is missing', () => {
  const records = [...recordsThrough(17), {
    filename: migrations[18].filename,
    checksum_sha256: migrations[18].checksum,
  }];
  assert.throws(
    () => validateStarpipsMigrationBatch(records, migrations, targets),
    /migration 019_migration\.sql is recorded while earlier target 018_migration\.sql is missing/i,
  );
});

test('rejects a target batch that is not the exact latest contiguous release suffix', () => {
  assert.throws(
    () => validateStarpipsMigrationBatch(recordsThrough(17), migrations, [migrations[16].filename, migrations[18].filename]),
    /contiguous latest migration suffix/i,
  );
});
