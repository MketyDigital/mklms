import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function createMigratedD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrationsPath = path.join(process.cwd(), 'db/d1-migrations');
  const migrations = (await readdir(migrationsPath)).filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) {
    sqlite.exec(await readFile(path.join(migrationsPath, migration), 'utf8'));
  }

  const db = {
    prepare(sql) {
      let params = [];
      const statement = {
        sql,
        bind(...values) { params = values; return this; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...params) }; },
        async first() { return sqlite.prepare(sql).get(...params) ?? null; },
        async run() {
          const result = sqlite.prepare(sql).run(...params);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
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

test('D1 replication-aware batches capture all row changes under one transaction ID', async () => {
  const adapter = await import('../src/lib/d1-query-adapter.ts');
  assert.equal(typeof adapter.withReplicationCaptureBatch, 'function');

  const { sqlite, db } = await createMigratedD1();
  try {
    sqlite.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled)
      VALUES(1,'academy-test','d1',4,23,1)`).run();

    const captured = adapter.withReplicationCaptureBatch(db, () => 'tx-atomic-1');
    await captured.batch([
      captured.prepare(`INSERT INTO students(id,display_name,certificate_name)
        VALUES(?,?,?)`).bind('student-a', 'Student A', 'Student A'),
      captured.prepare(`INSERT INTO students(id,display_name,certificate_name)
        VALUES(?,?,?)`).bind('student-b', 'Student B', 'Student B'),
    ]);

    const events = sqlite.prepare(`SELECT transaction_id, idempotency_key
      FROM mklms_replication_journal ORDER BY sequence`).all();
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((event) => event.transaction_id), ['tx-atomic-1', 'tx-atomic-1']);
    assert.notEqual(events[0].idempotency_key, events[1].idempotency_key);
    assert.equal(sqlite.prepare(`SELECT active_transaction_id FROM mklms_replication_config`).get().active_transaction_id, null);
  } finally {
    sqlite.close();
  }
});
