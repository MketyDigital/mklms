import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function createD1Schema() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const directory = path.join(process.cwd(), 'db/d1-migrations');
  const migrations = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) db.exec(await readFile(path.join(directory, migration), 'utf8'));
  return db;
}

test('D1 replication journal enforces replay identity, payload shape, direction and receipts', async () => {
  const db = await createD1Schema();
  try {
    const insertJournal = db.prepare(`INSERT INTO mklms_replication_journal
      (installation_id,source_backend,source_epoch,schema_version,transaction_id,table_name,
       record_key,operation,payload,idempotency_key)
      VALUES(?,?,?,?,?,?,?,?,?,?)`);
    const valid = ['starpips', 'postgresql', 1, 21, 'tx-1', 'students', '{"id":"s1"}', 'INSERT', '{"id":"s1"}', 'pg:1:1'];
    insertJournal.run(...valid);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count, 1);
    assert.throws(() => insertJournal.run(...valid), /UNIQUE constraint failed/);
    assert.throws(() => insertJournal.run('starpips', 'postgresql', 1, 21, 'tx-2', 'students', '"s1"', 'INSERT', '{"id":"s1"}', 'pg:1:2'), /CHECK constraint failed/);
    assert.throws(() => insertJournal.run('starpips', 'postgresql', 1, 21, 'tx-3', 'students', '{"id":"s1"}', 'DELETE', '{"id":"s1"}', 'pg:1:3'), /CHECK constraint failed/);
    assert.throws(() => insertJournal.run('starpips', 'postgresql', 1, 21, 'tx-4', 'students', '{"id":"s1"}', 'UPDATE', null, 'pg:1:4'), /CHECK constraint failed/);

    const insertCheckpoint = db.prepare(`INSERT INTO mklms_replication_checkpoints
      (installation_id,source_backend,target_backend,source_epoch,last_sequence,schema_version)
      VALUES(?,?,?,?,?,?)`);
    insertCheckpoint.run('starpips', 'postgresql', 'd1', 1, 1, 21);
    assert.throws(() => insertCheckpoint.run('starpips', 'd1', 'd1', 1, 0, 21), /CHECK constraint failed/);
    assert.throws(() => db.prepare(`INSERT INTO mklms_replication_checkpoints
      (source_backend,target_backend,installation_id,source_epoch,last_sequence,schema_version)
      VALUES('d1','postgresql',NULL,1,0,21)`).run(), /NOT NULL constraint failed/);

    const insertReceipt = db.prepare(`INSERT INTO mklms_replication_apply_receipts
      (installation_id,source_backend,target_backend,source_epoch,sequence,idempotency_key)
      VALUES(?,?,?,?,?,?)`);
    insertReceipt.run('starpips', 'postgresql', 'd1', 1, 1, 'pg:1:1');
    assert.throws(() => insertReceipt.run('starpips', 'postgresql', 'd1', 1, 1, 'pg:1:1'), /UNIQUE constraint failed/);

    const insertDeadLetter = db.prepare(`INSERT INTO mklms_replication_dead_letters
      (installation_id,source_backend,target_backend,source_epoch,sequence,error_code,error_message)
      VALUES(?,?,?,?,?,?,?)`);
    insertDeadLetter.run('starpips', 'postgresql', 'd1', 1, 2, 'TRANSIENT', 'target unavailable');
    assert.throws(() => insertDeadLetter.run('starpips', 'postgresql', 'postgresql', 1, 3, 'BAD', 'same backend'), /CHECK constraint failed/);
    assert.throws(() => db.prepare(`INSERT INTO mklms_replication_dead_letters
      (installation_id,source_backend,target_backend,source_epoch,sequence,attempts,error_code,error_message)
      VALUES('starpips','postgresql','d1',1,3,-1,'BAD','bad')`).run(), /CHECK constraint failed/);
  } finally {
    db.close();
  }
});

test('D1 captures row changes in the same transaction only when configured as source', async () => {
  const db = await createD1Schema();
  try {
    const triggerCount = db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger' AND name LIKE 'mklms_replication_capture_%'").get().count;
    assert.equal(triggerCount, 96);
    db.prepare(`INSERT INTO students(id,display_name,certificate_name) VALUES('capture-student','Before','Before')`).run();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count, 0);

    db.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled)
      VALUES(1,'starpips','d1',2,23,1)`).run();
    db.prepare(`INSERT INTO students(id,display_name,certificate_name) VALUES('captured-student','Before','Before')`).run();
    db.prepare(`UPDATE students SET display_name='After' WHERE id='captured-student'`).run();
    db.prepare(`DELETE FROM students WHERE id='captured-student'`).run();
    const events = db.prepare(`SELECT source_backend,source_epoch,schema_version,table_name,record_key,operation,payload
      FROM mklms_replication_journal ORDER BY sequence`).all();
    assert.deepEqual(events.map(event=>event.operation), ['INSERT','UPDATE','DELETE']);
    assert.ok(events.every(event=>event.source_backend==='d1'&&event.source_epoch===2&&event.schema_version===23&&event.table_name==='students'));
    assert.deepEqual(JSON.parse(events[0].record_key), { id:'captured-student' });
    assert.equal(JSON.parse(events[1].payload).display_name, 'After');
    assert.equal(events[2].payload, null);

    const beforeRollback = events.length;
    db.exec('BEGIN');
    db.prepare(`INSERT INTO students(id,display_name,certificate_name) VALUES('rolled-back','Rollback','Rollback')`).run();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count, beforeRollback + 1);
    db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count, beforeRollback);
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM students WHERE id='rolled-back'`).get().count, 0);

    db.prepare(`UPDATE mklms_replication_config SET source_backend='postgresql' WHERE singleton=1`).run();
    db.prepare(`UPDATE students SET display_name='Uncaptured' WHERE id='capture-student'`).run();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM mklms_replication_journal').get().count, beforeRollback);
  } finally {
    db.close();
  }
});

test('PostgreSQL and D1 replication migrations define the same durable journal domains', async () => {
  const postgres = await readFile('db/migrations/022_replication_journal.sql', 'utf8');
  const postgresCapture = await readFile('db/migrations/023_transactional_replication_capture.sql', 'utf8');
  const d1 = await readFile('db/d1-migrations/0020_replication_journal.sql', 'utf8');
  const d1Capture = await readFile('db/d1-migrations/0021_transactional_replication_capture.sql', 'utf8');
  for (const table of [
    'mklms_replication_journal',
    'mklms_replication_checkpoints',
    'mklms_replication_apply_receipts',
    'mklms_replication_dead_letters',
  ]) {
    assert.match(postgres, new RegExp(`CREATE TABLE ${table}`));
    assert.match(d1, new RegExp(`CREATE TABLE ${table}`));
  }
  assert.match(postgres, /No source capture or replay is enabled/);
  assert.match(d1, /no capture or replay triggers are enabled/);
  assert.match(postgresCapture, /capture_enabled BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(postgresCapture, /CREATE TRIGGER %I AFTER %s/);
  assert.match(postgresCapture, /Replication capture requires a primary key on every application table/);
  assert.match(postgresCapture, /source_backend = 'postgresql' AND capture_enabled = TRUE/);
  assert.match(d1Capture, /capture_enabled INTEGER NOT NULL DEFAULT 0/);
  assert.equal((d1Capture.match(/CREATE TRIGGER "mklms_replication_capture_/g) ?? []).length, 96);
});
