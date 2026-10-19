import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function migratedD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const directory = path.join(process.cwd(), 'db/d1-migrations');
  const migrations = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  for (const migration of migrations) db.exec(await readFile(path.join(directory, migration), 'utf8'));
  return db;
}

test('replication apply mode suppresses derived enrollment effects but keeps normal effects outside apply', async () => {
  const db = await migratedD1();
  try {
    db.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled)
      VALUES(1,'starpips','d1',4,23,0)`).run();
    db.prepare(`INSERT INTO courses(id,slug,title,assignment_mode)
      VALUES('course-a','course-a','Course A','ALL_ACTIVE_STUDENTS')`).run();

    db.prepare(`INSERT INTO students(id,display_name,certificate_name)
      VALUES('normal-student','Normal Student','Normal Student')`).run();
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM enrollments WHERE student_id='normal-student'`).get().count, 1);

    db.prepare(`UPDATE mklms_replication_config SET apply_in_progress=1 WHERE singleton=1`).run();
    db.prepare(`INSERT INTO students(id,display_name,certificate_name)
      VALUES('replicated-student','Replicated Student','Replicated Student')`).run();
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM enrollments WHERE student_id='replicated-student'`).get().count, 0);

    db.prepare(`UPDATE mklms_replication_config SET apply_in_progress=0 WHERE singleton=1`).run();
    db.prepare(`INSERT INTO students(id,display_name,certificate_name)
      VALUES('later-student','Later Student','Later Student')`).run();
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM enrollments WHERE student_id='later-student'`).get().count, 1);
  } finally {
    db.close();
  }
});

test('replication apply mode does not disable key or media integrity guards', async () => {
  const db = await migratedD1();
  try {
    db.prepare(`INSERT INTO mklms_replication_config
      (singleton,installation_id,source_backend,authority_epoch,schema_version,capture_enabled,apply_in_progress)
      VALUES(1,'starpips','d1',4,23,0,1)`).run();
    db.prepare(`INSERT INTO courses(id,slug,title) VALUES('course-a','course-a','Course A')`).run();
    db.prepare(`INSERT INTO course_modules(id,course_id,title) VALUES('module-a','course-a','Module A')`).run();
    assert.throws(() => db.prepare(`INSERT INTO lessons(id,module_id,title,media_asset_id)
      VALUES('lesson-a','module-a','Lesson A','missing-media')`).run(), /FOREIGN KEY constraint failed/);
    assert.throws(() => db.prepare(`INSERT INTO students(id,display_name,certificate_name)
      VALUES(NULL,'Invalid Student','Invalid Student')`).run(), /primary key cannot be NULL/);
  } finally {
    db.close();
  }
});

test('PostgreSQL replication apply mode suppresses capture and derived enrollments', async () => {
  const migration = await readFile('db/migrations/024_replication_apply_guard.sql', 'utf8');
  assert.match(migration, /ADD COLUMN apply_in_progress BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /capture_enabled = TRUE AND apply_in_progress = FALSE/);
  assert.match(migration, /apply_in_progress = TRUE/);
});
