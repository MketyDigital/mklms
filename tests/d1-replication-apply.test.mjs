import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { applyD1JournalTransaction, REPLICATED_TABLE_NAMES } from '../src/lib/replication/d1-apply.ts';

async function migratedD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrationsPath = path.join(process.cwd(), 'db/d1-migrations');
  const migrations = (await readdir(migrationsPath)).filter(name => name.endsWith('.sql')).sort();
  for (const migration of migrations) sqlite.exec(await readFile(path.join(migrationsPath, migration), 'utf8'));
  const db = {
    prepare(sql) {
      return {
        params: [],
        bind(...params) { this.params = params; return this; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...this.params) }; },
        async run() {
          const result = sqlite.prepare(sql).run(...this.params);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, db };
}

const identity = { installationId: 'starpips', sourceBackend: 'postgresql', sourceEpoch: '4' };
function checkpoint(sqlite, lastSequence = 0) {
  sqlite.prepare(`INSERT INTO mklms_replication_checkpoints
    (installation_id,source_backend,target_backend,source_epoch,last_sequence,schema_version)
    VALUES(?,?,'d1',?,?,23)`).run(identity.installationId, identity.sourceBackend, identity.sourceEpoch, lastSequence);
}
function entry(sequence, overrides = {}) {
  return {
    sequence: String(sequence), installationId: identity.installationId,
    sourceBackend: identity.sourceBackend, sourceEpoch: identity.sourceEpoch,
    schemaVersion: 23, transactionId: 'pg-tx-1', tableName: 'students',
    recordKey: { id: `student-${sequence}` }, operation: 'INSERT',
    payload: { id: `student-${sequence}`, display_name: `Student ${sequence}`, certificate_name: `Student ${sequence}`, status: 'ACTIVE' },
    idempotencyKey: `pg-event-${sequence}`, occurredAt: '2026-10-17T00:00:00Z',
    ...overrides,
  };
}

test('D1 replay applies a full source transaction atomically and suppresses derived enrollments', async () => {
  const { sqlite, db } = await migratedD1();
  try {
    checkpoint(sqlite);
    sqlite.prepare(`INSERT INTO courses(id,slug,title,assignment_mode)
      VALUES('course-a','course-a','Course A','ALL_ACTIVE_STUDENTS')`).run();
    const result = await applyD1JournalTransaction(db, {
      identity, expectedLastSequence: '0', expectedSchemaVersion: 23, entries: [entry(1)],
    });
    assert.deepEqual(result, { status: 'applied', firstSequence: '1', lastSequence: '1', appliedEntries: 1 });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM students WHERE id='student-1'").get().count, 1);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM enrollments WHERE student_id='student-1'").get().count, 0);
    assert.equal(sqlite.prepare('SELECT last_sequence FROM mklms_replication_checkpoints').get().last_sequence, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM mklms_replication_apply_receipts').get().count, 1);
    assert.equal(sqlite.prepare('SELECT apply_in_progress FROM mklms_replication_config').get().apply_in_progress, 0);

    const replayed = await applyD1JournalTransaction(db, {
      identity, expectedLastSequence: '0', expectedSchemaVersion: 23, entries: [entry(1)],
    });
    assert.equal(replayed.status, 'already-applied');
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM students WHERE id='student-1'").get().count, 1);
  } finally {
    sqlite.close();
  }
});

test('D1 replay rolls back row writes, receipts and checkpoint on a target constraint failure', async () => {
  const { sqlite, db } = await migratedD1();
  try {
    checkpoint(sqlite);
    const invalidLesson = entry(1, {
      tableName: 'lessons', recordKey: { id: 'lesson-a' },
      payload: { id: 'lesson-a', module_id: 'missing-module', title: 'Lesson A' },
    });
    await assert.rejects(applyD1JournalTransaction(db, {
      identity, expectedLastSequence: '0', expectedSchemaVersion: 23, entries: [invalidLesson],
    }), /FOREIGN KEY constraint failed/);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM lessons WHERE id='lesson-a'").get().count, 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM mklms_replication_apply_receipts').get().count, 0);
    assert.equal(sqlite.prepare('SELECT last_sequence FROM mklms_replication_checkpoints').get().last_sequence, 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM mklms_replication_config').get().count, 0);
  } finally {
    sqlite.close();
  }
});

test('D1 replay maps PostgreSQL decimal amounts to signed integer cents exactly', async () => {
  const { sqlite, db } = await migratedD1();
  try {
    checkpoint(sqlite);
    const ledgerEntry = entry(1, {
      tableName: 'managed_hosting_daily_ledger',
      recordKey: { billing_date: '2026-10-01' },
      payload: {
        billing_date: '2026-10-01', month_key: '2026-10', measured_watch_minutes: 10,
        estimated_live_audience_minutes: 20, streaming_activity_band: 'Low',
        automatic_balance_usd: '10.25', operator_adjustment_usd: '-2.50',
        operator_reason: 'correction', calculation_version: 'streaming-v2',
      },
    });
    await applyD1JournalTransaction(db, {
      identity, expectedLastSequence: '0', expectedSchemaVersion: 23, entries: [ledgerEntry],
    });
    const row = sqlite.prepare(`SELECT automatic_balance_cents,operator_adjustment_cents
      FROM managed_hosting_daily_ledger WHERE billing_date='2026-10-01'`).get();
    assert.equal(row.automatic_balance_cents, 1025);
    assert.equal(row.operator_adjustment_cents, -250);

    const badAmount = entry(2, {
      tableName: 'managed_hosting_daily_ledger',
      recordKey: { billing_date: '2026-10-02' },
      payload: { billing_date: '2026-10-02', month_key: '2026-10', automatic_balance_usd: '1.001' },
    });
    await assert.rejects(applyD1JournalTransaction(db, {
      identity, expectedLastSequence: '1', expectedSchemaVersion: 23, entries: [badAmount],
    }), /amount/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM managed_hosting_daily_ledger').get().count, 1);
    assert.equal(sqlite.prepare('SELECT last_sequence FROM mklms_replication_checkpoints').get().last_sequence, 1);
  } finally {
    sqlite.close();
  }
});

test('D1 replay refuses to use a source-capturing target or an unverified checkpoint', async () => {
  const { sqlite, db } = await migratedD1();
  try {
    checkpoint(sqlite);
    sqlite.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled)
      VALUES(1,'starpips','d1',4,23,1)`).run();
    await assert.rejects(applyD1JournalTransaction(db, {
      identity, expectedLastSequence: '0', expectedSchemaVersion: 23, entries: [entry(1)],
    }), /CHECK constraint failed/);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM students WHERE id='student-1'").get().count, 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM mklms_replication_apply_receipts').get().count, 0);
  } finally {
    sqlite.close();
  }
});

test('D1 replay validates stream, transaction, schema, table and primary key before writing', async () => {
  const { sqlite, db } = await migratedD1();
  try {
    checkpoint(sqlite);
    const invalid = [
      { ...entry(1), sourceEpoch: '5' },
      { ...entry(1), transactionId: '' },
      { ...entry(1), schemaVersion: 22 },
      { ...entry(1), tableName: 'mklms_replication_journal' },
      { ...entry(1), recordKey: { other: 'student-1' } },
    ];
    for (const invalidEntry of invalid) {
      await assert.rejects(applyD1JournalTransaction(db, {
        identity, expectedLastSequence: '0', expectedSchemaVersion: 23, entries: [invalidEntry],
      }));
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM students').get().count, 0);
  } finally {
    sqlite.close();
  }
});

test('D1 applier allowlist matches every table with transactional capture triggers', async () => {
  const migration = await readFile('db/d1-migrations/0021_transactional_replication_capture.sql', 'utf8');
  const captured = [...new Set([...migration.matchAll(/'([a-z][a-z0-9_]*)', json_object\(/g)].map(match => match[1]))].sort();
  assert.deepEqual([...REPLICATED_TABLE_NAMES].sort(), captured);
});

test('D1 replay applier remains disconnected from application runtime', async () => {
  async function walk(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walk(filename));
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(filename);
    }
    return files;
  }
  const runtimeFiles = await walk(path.join(process.cwd(), 'src'));
  const callSites = [];
  for (const filename of runtimeFiles) {
    if (filename.endsWith('/lib/replication/d1-apply.ts')) continue;
    if ((await readFile(filename, 'utf8')).includes('applyD1JournalTransaction')) callSites.push(filename);
  }
  assert.deepEqual(callSites, []);
});
