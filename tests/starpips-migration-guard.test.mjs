import test from 'node:test';
import assert from 'node:assert/strict';

import { validateStarpipsMigrationBatch } from '../scripts/starpips-migration-guard.mjs';

const migrations = Array.from({ length: 21 }, (_, index) => ({
  filename: `${String(index + 1).padStart(3, '0')}_migration.sql`,
  checksum: `hash-${index + 1}`,
}));
const targets = migrations.slice(17).map(({ filename }) => filename);

const recordsThrough = (count) => migrations.slice(0, count).map(({ filename, checksum }) => ({
  filename,
  checksum_sha256: checksum,
}));

test('accepts healthy Starpips history with migrations 018 through 021 pending', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(17), migrations, targets);
  assert.deepEqual(result, { pendingTargets: targets, allTargetsApplied: false });
});

test('accepts migration 018 already applied with 019 through 021 pending', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(18), migrations, targets);
  assert.deepEqual(result, { pendingTargets: targets.slice(1), allTargetsApplied: false });
});

test('accepts migrations 018 through 020 applied with 021 pending', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(20), migrations, targets);
  assert.deepEqual(result, { pendingTargets: [targets.at(-1)], allTargetsApplied: false });
});

test('accepts an already-current Starpips ledger through migration 021', () => {
  const result = validateStarpipsMigrationBatch(recordsThrough(21), migrations, targets);
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
    filename: migrations[20].filename,
    checksum_sha256: migrations[20].checksum,
  }];
  assert.throws(
    () => validateStarpipsMigrationBatch(records, migrations, targets),
    /migration 021_migration\.sql is recorded while earlier target 018_migration\.sql is missing/i,
  );
});

test('rejects a target batch that is not the exact latest contiguous release suffix', () => {
  assert.throws(
    () => validateStarpipsMigrationBatch(recordsThrough(17), migrations, [migrations[16].filename, migrations[20].filename]),
    /targets must be contiguous/i,
  );
});

test('keeps the live release green while known replication migrations remain intentionally deferred', () => {
  const deferred = [
    { filename: '022_replication_journal.sql', checksum: 'replication-022' },
    { filename: '023_transactional_replication_capture.sql', checksum: 'replication-023' },
    { filename: '024_replication_apply_guard.sql', checksum: 'replication-024' },
  ];
  const result = validateStarpipsMigrationBatch(recordsThrough(21), [...migrations, ...deferred], targets);
  assert.deepEqual(result, { pendingTargets: [], allTargetsApplied: true });
});

test('blocks a live release if any deferred replication migration is already recorded', () => {
  const deferred = { filename: '022_replication_journal.sql', checksum: 'replication-022' };
  const records = [...recordsThrough(21), {
    filename: deferred.filename,
    checksum_sha256: deferred.checksum,
  }];
  assert.throws(
    () => validateStarpipsMigrationBatch(records, [...migrations, deferred], targets),
    /deferred migration 022_replication_journal\.sql is recorded/i,
  );
});

test('fails closed when a newer production migration is not explicitly classified', () => {
  const unknown = { filename: '025_unreviewed_change.sql', checksum: 'unknown-025' };
  assert.throws(
    () => validateStarpipsMigrationBatch(recordsThrough(21), [...migrations, unknown], targets),
    /unclassified migrations follow the guarded Starpips batch/i,
  );
});
