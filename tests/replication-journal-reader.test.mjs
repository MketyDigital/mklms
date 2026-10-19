import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  readNextD1JournalTransaction,
  readNextPostgresJournalTransaction,
  readD1JournalBatch,
  readPostgresJournalBatch,
} from '../src/lib/replication/journal.ts';

const identity = {
  installationId: 'academy-test',
  sourceBackend: 'postgresql',
  sourceEpoch: '4',
};

function row(sequence, overrides = {}) {
  return {
    sequence: String(sequence),
    installation_id: identity.installationId,
    source_backend: identity.sourceBackend,
    source_epoch: identity.sourceEpoch,
    schema_version: 23,
    transaction_id: 'tx-1',
    table_name: 'courses',
    record_key: { id: 'course-1' },
    operation: 'UPDATE',
    payload: { id: 'course-1', title: 'Updated' },
    idempotency_key: 'event-1',
    occurred_at: '2026-10-17T00:00:00Z',
    ...overrides,
  };
}

test('PostgreSQL journal reader returns ordered normalized entries after a cursor', async () => {
  let query;
  const pool = {
    async query(sql, params) {
      query = { sql, params };
      return { rows: [row(8), row(10, { idempotency_key: 'event-2' })] };
    },
  };
  const entries = await readPostgresJournalBatch(pool, identity, '7', 10);
  assert.deepEqual(entries.map((entry) => entry.sequence), ['8', '10']);
  assert.deepEqual(query.params, [identity.installationId, identity.sourceBackend, '4', '7', 10]);
  assert.match(query.sql, /ORDER BY sequence ASC LIMIT \$5/);
  assert.deepEqual(entries[0].recordKey, { id: 'course-1' });
});

test('D1 journal reader parses JSON text and binds a bounded cursor query', async () => {
  let statement;
  const db = {
    prepare(sql) {
      statement = {
        sql,
        params: [],
        bind(...params) { this.params = params; return this; },
        async all() {
          return { success: true, results: [row(8, {
            source_backend: 'd1',
            record_key: '{"id":"course-1"}',
            payload: '{"id":"course-1","title":"Updated"}',
            source_epoch: 4,
            schema_version: 23,
          })] };
        },
      };
      return statement;
    },
  };
  const d1Identity = { ...identity, sourceBackend: 'd1' };
  const entries = await readD1JournalBatch(db, d1Identity, '7', 10);
  assert.equal(entries[0].sequence, '8');
  assert.deepEqual(entries[0].payload, { id: 'course-1', title: 'Updated' });
  assert.deepEqual(statement.params, [identity.installationId, 'd1', '4', '7', 10]);
  assert.match(statement.sql, /ORDER BY sequence ASC LIMIT \?/);
});

test('D1 journal reader reads actual trigger-captured rows from the rehearsed schema', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec('PRAGMA foreign_keys = ON');
    const migrationsPath = path.join(process.cwd(), 'db/d1-migrations');
    const migrations = (await readdir(migrationsPath)).filter((name) => name.endsWith('.sql')).sort();
    for (const migration of migrations) {
      sqlite.exec(await readFile(path.join(migrationsPath, migration), 'utf8'));
    }
    sqlite.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled)
      VALUES(1,'academy-test','d1',4,23,1)`).run();
    sqlite.prepare(`INSERT INTO students(id,display_name,certificate_name)
      VALUES('student-1','Student One','Student One')`).run();

    const db = {
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        let params = [];
        return {
          bind(...values) { params = values; return this; },
          async all() { return { success: true, results: statement.all(...params) }; },
        };
      },
    };
    const entries = await readD1JournalBatch(db, { ...identity, sourceBackend: 'd1' }, '0', 20);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].tableName, 'students');
    assert.equal(entries[0].operation, 'INSERT');
    assert.deepEqual(entries[0].recordKey, { id: 'student-1' });
    assert.equal(entries[0].payload.display_name, 'Student One');
  } finally {
    sqlite.close();
  }
});

test('journal readers reject invalid bounds and stream identity mismatches', async () => {
  const pool = { async query() { return { rows: [row(8, { source_epoch: '3' })] }; } };
  await assert.rejects(readPostgresJournalBatch(pool, identity, '7', 10), /stream identity mismatch/);
  await assert.rejects(readPostgresJournalBatch(pool, identity, '7', 0), /batch limit/);
  await assert.rejects(readPostgresJournalBatch(pool, identity, '-1', 10), /cursor/);
});

test('journal readers reject out-of-order or malformed entries', async () => {
  const pool = { async query() { return { rows: [row(9), row(8, { idempotency_key: 'event-2' })] }; } };
  await assert.rejects(readPostgresJournalBatch(pool, identity, '7', 10), /strictly increasing/);
  const malformed = { async query() { return { rows: [row(8, { operation: 'TRUNCATE' })] }; } };
  await assert.rejects(readPostgresJournalBatch(malformed, identity, '7', 10), /invalid operation/);
});

test('PostgreSQL transaction reader returns every event in the next committed source transaction', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [{ transaction_id: 'tx-next' }] };
      return { rows: [
        row(8, { transaction_id: 'tx-next' }),
        row(9, { transaction_id: 'tx-next', idempotency_key: 'event-2', record_key: { id: 'course-2' }, payload: { id: 'course-2', title: 'Second' } }),
      ] };
    },
  };
  const entries = await readNextPostgresJournalTransaction(pool, identity, '7', 10);
  assert.deepEqual(entries.map(entry => entry.sequence), ['8', '9']);
  assert.deepEqual(entries.map(entry => entry.transactionId), ['tx-next', 'tx-next']);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /transaction_id = \$4/);
  assert.deepEqual(calls[1].params.slice(0, 4), [identity.installationId, 'postgresql', '4', 'tx-next']);
});

test('transaction reader rejects a checkpoint inside a source transaction', async () => {
  const pool = {
    async query(_sql, params) {
      if (params.length === 4) return { rows: [{ transaction_id: 'tx-split' }] };
      return { rows: [row(8, { transaction_id: 'tx-split' }), row(9, { transaction_id: 'tx-split', idempotency_key: 'event-2' })] };
    },
  };
  await assert.rejects(readNextPostgresJournalTransaction(pool, identity, '8', 10), /cursor splits a source transaction/);
});

test('D1 transaction reader returns complete captured transaction events', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      let params = [];
      return {
        sql,
        bind(...values) { params = values; return this; },
        async all() {
          calls.push({ sql, params });
          if (params.length === 4) return { success: true, results: [{ transaction_id: 'd1-tx-next' }] };
          return { success: true, results: [
            row(8, { source_backend: 'd1', source_epoch: 4, transaction_id: 'd1-tx-next', record_key: '{"id":"course-1"}', payload: '{"id":"course-1","title":"Updated"}' }),
            row(9, { source_backend: 'd1', source_epoch: 4, transaction_id: 'd1-tx-next', idempotency_key: 'event-2', record_key: '{"id":"course-2"}', payload: '{"id":"course-2","title":"Second"}' }),
          ] };
        },
      };
    },
  };
  const entries = await readNextD1JournalTransaction(db, { ...identity, sourceBackend: 'd1' }, '7', 10);
  assert.deepEqual(entries.map(entry => entry.sequence), ['8', '9']);
  assert.deepEqual(entries.map(entry => entry.transactionId), ['d1-tx-next', 'd1-tx-next']);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /transaction_id = \?/);
});
