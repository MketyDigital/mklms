import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { D1AdminAccessRepository } from '../src/features/access/repositories/d1-admin-access.repository.ts';
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
  const binding = d1(db);
  return { db, admin: new D1AdminAccessRepository(binding), access: new D1AccessRepository(binding) };
}

test('D1 admin preauthorization create is idempotent by normalized identity and course', async () => {
  const { db, admin } = await setup();
  try {
    const first = await admin.createPreauthorization({ email: ' ONE@EXAMPLE.COM ', courseId: 'course', claimStrategy: 'manual-approval', source: 'manual' });
    const duplicate = await admin.createPreauthorization({ email: 'one@example.com', courseId: 'course', claimStrategy: 'preauth-only', source: 'import' });
    assert.equal(first.created, true);
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.record.id, first.record.id);
    assert.equal((await admin.listPreauthorizations()).length, 1);
  } finally { db.close(); }
});

test('D1 manual approval requires a requested manual claim and pending edits remain guarded', async () => {
  const { db, admin, access } = await setup();
  try {
    const result = await admin.createPreauthorization({ phone: '+1 (555) 123-4567', claimStrategy: 'manual-approval', source: 'manual' });
    await assert.rejects(admin.approveManualClaim(result.record.id), /not available/);
    await access.markPreauthorizationClaimRequested(result.record.id);
    await admin.approveManualClaim(result.record.id);
    await admin.updatePendingPreauthorization(result.record.id, { claimStrategy: 'preauth-only' });
    const updated = (await admin.listPreauthorizations()).find((row) => row.id === result.record.id);
    assert.equal(updated.claimStrategy, 'preauth-only');
    assert.equal(updated.manualApprovedAt, null);
    assert.equal(updated.claimRequestedAt, null);
  } finally { db.close(); }
});

test('D1 student suspension revokes live sessions and reclaim atomically reopens the claimed authorization', async () => {
  const { db, admin, access } = await setup();
  try {
    const preauth = await admin.createPreauthorization({ email: 'one@example.com', claimStrategy: 'preauth-only', source: 'manual' });
    const student = await access.completeVerifiedClaim({
      preauthorizationId: preauth.record.id,
      student: { displayName: 'One', email: 'one@example.com', certificateName: 'One' },
      credential: { lookupHash: 'claim-hash', prefix: 'ACCESS', hash: { algorithm: 'scrypt', salt: 'salt', hash: 'credential-hash' } },
    });
    await access.createSession(student.id, { tokenHash: 'session-hash', expiresAt: new Date('2030-01-01T00:00:00.000Z') });
    await admin.setStudentStatus(student.id, 'SUSPENDED');
    assert.equal(await access.findActiveSessionByTokenHash('session-hash', new Date('2029-01-01T00:00:00.000Z')), null);
    await admin.prepareStudentReclaim(student.id, { claimStrategy: 'manual-approval' });
    const reopened = (await admin.listPreauthorizations()).find((row) => row.id === preauth.record.id);
    assert.equal(reopened.status, 'PREAUTHORIZED');
    assert.equal(reopened.claimStrategy, 'manual-approval');
    assert.equal(db.prepare("SELECT source FROM preauthorizations WHERE id=?").get(preauth.record.id).source, 'admin-reclaim');
    assert.equal(db.prepare("SELECT status FROM students WHERE id=?").get(student.id).status, 'ACTIVE');
    assert.equal(db.prepare("SELECT status FROM student_access_credentials WHERE student_id=?").get(student.id).status, 'REVOKED');
  } finally { db.close(); }
});

test('D1 reclaim rolls back when no claimed authorization exists', async () => {
  const { db, admin, access } = await setup();
  try {
    const student = await access.createStudent({ displayName: 'One', email: 'one@example.com', certificateName: 'One' });
    await assert.rejects(admin.prepareStudentReclaim(student.id, { claimStrategy: 'preauth-only' }));
    assert.equal(db.prepare("SELECT status FROM students WHERE id=?").get(student.id).status, 'ACTIVE');
    assert.equal(db.prepare('SELECT count(*) AS n FROM mklms_d1_atomic_assertions').get().n, 0);
  } finally { db.close(); }
});

test('D1 all-active enrollment trigger fires only on insertion or an actual activation transition', async () => {
  const { db, admin, access } = await setup();
  try {
    db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('all','all','All','ALL_ACTIVE_STUDENTS')").run();
    const student = await access.createStudent({ displayName: 'One', email: 'one@example.com', certificateName: 'One' });
    assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='all'").get(student.id).status, 'ACTIVE');
    db.prepare("UPDATE enrollments SET status='REVOKED' WHERE student_id=? AND course_id='all'").run(student.id);
    await admin.setStudentStatus(student.id, 'ACTIVE');
    assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='all'").get(student.id).status, 'REVOKED');
    await admin.setStudentStatus(student.id, 'SUSPENDED');
    await admin.setStudentStatus(student.id, 'ACTIVE');
    assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='all'").get(student.id).status, 'ACTIVE');
  } finally { db.close(); }
});
