import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const sql = readFileSync('db/d1-migrations/0001_foundation.sql','utf8');
test('D1 foundation creates authentic SQLite constraints without PostgreSQL extensions', () => {
  assert.doesNotMatch(sql, /\bTIMESTAMPTZ\b|\bJSONB\b|\bSERIAL\b|\bNOW\(\)/i);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    for (const name of ['platform_settings','students','preauthorizations','student_access_credentials','enrollments','student_sessions']) {
      assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name)?.name, name);
    }
    db.prepare("INSERT INTO students (id,display_name,certificate_name,email) VALUES ('a','Alex','Alex','USER@EXAMPLE.COM')").run();
    assert.throws(() => db.prepare("INSERT INTO students (id,display_name,certificate_name,email) VALUES ('b','B','B','user@example.com')").run());
    assert.throws(() => db.prepare("INSERT INTO enrollments (id,student_id,course_id) VALUES ('e','unknown','course')").run());
    db.prepare("INSERT INTO enrollments (id,student_id,course_id) VALUES ('e','a','course')").run();
    assert.throws(() => db.prepare("INSERT INTO enrollments (id,student_id,course_id) VALUES ('e2','a','course')").run());
    db.prepare("DELETE FROM students WHERE id = 'a'").run();
    assert.equal(db.prepare("SELECT count(*) AS n FROM enrollments").get().n, 0);
  } finally { db.close(); }
});
