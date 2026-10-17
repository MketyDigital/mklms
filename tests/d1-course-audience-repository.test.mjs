import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { D1CourseAudienceRepository } from '../src/features/courses/repositories/d1-course-audience.repository.ts';
import { D1AccessRepository } from '../src/features/access/repositories/d1-access.repository.ts';

function d1(db) {
  return {
    prepare(sql) {
      let params = [];
      const statement = {
        bind(...values) { params = values; return statement; },
        async all() { return { success: true, results: db.prepare(sql).all(...params) }; },
        async first() { return db.prepare(sql).get(...params) ?? null; },
        async run() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...params).changes) } }; },
        _run() { return db.prepare(sql).run(...params); },
      };
      return statement;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map((statement) => ({ success: true, meta: { changes: Number(statement._run().changes) } }));
        db.exec('COMMIT');
        return results;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

async function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of (await readdir('db/d1-migrations')).filter((file) => file.endsWith('.sql')).sort()) db.exec(await readFile(`db/d1-migrations/${name}`, 'utf8'));
  return { db, audience: new D1CourseAudienceRepository(d1(db)), access: new D1AccessRepository(d1(db)) };
}

test('switching a course to all-active enrolls every active student in the same batch', async () => {
  const { db, audience, access } = await setup();
  try {
    db.prepare("INSERT INTO courses(id,slug,title) VALUES('course','course','Course')").run();
    const student = await access.createStudent({ displayName: 'One', email: 'one@example.com', certificateName: 'One' });
    const state = await audience.setCourseAudience('course', 'ALL_ACTIVE_STUDENTS', []);
    assert.equal(state.mode, 'ALL_ACTIVE_STUDENTS');
    assert.deepEqual(state.enrolledStudentIds, [student.id]);
    const enrollment = db.prepare("SELECT id,status FROM enrollments WHERE student_id=? AND course_id='course'").get(student.id);
    assert.equal(enrollment.status, 'ACTIVE');
    assert.equal(enrollment.id, Buffer.from(JSON.stringify([student.id,'course','course-audience']),'utf8').toString('hex'));
  } finally { db.close(); }
});

test('selected audience rejects inactive or missing selections without changing the course', async () => {
  const { db, audience } = await setup();
  try {
    db.prepare("INSERT INTO courses(id,slug,title) VALUES('course','course','Course')").run();
    await assert.rejects(audience.setCourseAudience('course', 'SELECTED_STUDENTS', ['missing']), /not active/);
    assert.equal(db.prepare("SELECT assignment_mode FROM courses WHERE id='course'").get().assignment_mode, 'SELECTED_STUDENTS');
    assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n, 0);
  } finally { db.close(); }
});

test('selected audience deduplicates selections, revokes excluded active rows, and preserves completion', async () => {
  const { db, audience, access } = await setup();
  try {
    db.prepare("INSERT INTO courses(id,slug,title) VALUES('course','course','Course')").run();
    const one = await access.createStudent({ displayName: 'One', email: 'one@example.com', certificateName: 'One' });
    const two = await access.createStudent({ displayName: 'Two', email: 'two@example.com', certificateName: 'Two' });
    await audience.setCourseAudience('course', 'ALL_ACTIVE_STUDENTS', []);
    db.prepare("UPDATE enrollments SET status='COMPLETED' WHERE student_id=? AND course_id='course'").run(one.id);
    const state = await audience.setCourseAudience('course', 'SELECTED_STUDENTS', [two.id, two.id]);
    assert.deepEqual(state.enrolledStudentIds.sort(), [one.id, two.id].sort());
    assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='course'").get(one.id).status, 'COMPLETED');
    assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='course'").get(two.id).status, 'ACTIVE');
  } finally { db.close(); }
});

test('concurrent activation and all-active audience change cannot miss a student', async () => {
  const { db, audience, access } = await setup();
  try {
    db.prepare("INSERT INTO courses(id,slug,title) VALUES('course','course','Course')").run();
    const [student] = await Promise.all([
      access.createStudent({ displayName: 'One', email: 'one@example.com', certificateName: 'One' }),
      audience.setCourseAudience('course', 'ALL_ACTIVE_STUDENTS', []),
    ]);
    assert.equal(db.prepare("SELECT count(*) AS n FROM enrollments WHERE student_id=? AND course_id='course'").get(student.id).n, 1);
  } finally { db.close(); }
});
