import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { D1AccessRepository } from '../src/features/access/repositories/d1-access.repository.ts';
import { AccessService } from '../src/features/access/services/access.service.ts';
import { AccessLoginService } from '../src/features/access/services/access-login.service.ts';
import { hashSessionToken } from '../src/features/access/domain/session.ts';

function testD1(db) {
  return {
    prepare(sql) {
      let values = [];
      const stmt = {
        bind(...params) { values = params; return stmt; },
        async all() { return { success: true, results: db.prepare(sql).all(...values) }; },
        async first() { return db.prepare(sql).get(...values) ?? null; },
        async run() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...values).changes) } }; },
        _run() { return db.prepare(sql).run(...values); },
      };
      return stmt;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const result = statements.map((statement) => ({ success: true, meta: { changes: Number(statement._run().changes) } }));
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const file of (await readdir('db/d1-migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(await readFile(`db/d1-migrations/${file}`, 'utf8'));
  }
  return { db, repo: new D1AccessRepository(testD1(db)) };
}

function claimInput(preauthorizationId, courseId = null, overrides = {}) {
  return {
    preauthorizationId,
    student: { displayName: 'Student One', email: 'one@example.com', phone: null, certificateName: 'Student One', certificateEmail: null },
    courseId,
    credential: { lookupHash: `lookup-${preauthorizationId}`, prefix: 'ACCESS', hash: { algorithm: 'scrypt', salt: 'salt', hash: `hash-${preauthorizationId}` } },
    ...overrides,
  };
}

function addPreauthorization(db, id, email) {
  db.prepare("INSERT INTO preauthorizations(id,email,status,claim_strategy) VALUES(?,?,'PREAUTHORIZED','preauth-only')").run(id, email);
}

test('D1 verified claim commits student, credential, enrollment and preauthorization together', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p1', 'one@example.com');
    db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('c1','c1','Course','SELECTED_STUDENTS')").run();
    const student = await repo.completeVerifiedClaim(claimInput('p1', 'c1'));
    assert.equal(student.email, 'one@example.com');
    const enrollment = db.prepare("SELECT id FROM enrollments WHERE student_id=? AND course_id='c1'").get(student.id);
    assert.match(enrollment.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(db.prepare("SELECT status FROM preauthorizations WHERE id='p1'").get().status, 'CLAIMED');
    assert.equal(db.prepare("SELECT count(*) AS n FROM student_access_credentials WHERE student_id=? AND status='ACTIVE'").get(student.id).n, 1);
    assert.equal(db.prepare("SELECT status FROM enrollments WHERE student_id=? AND course_id='c1'").get(student.id).status, 'ACTIVE');
  } finally { db.close(); }
});

test('D1 claim enrolls an activated student into every all-active course atomically', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p2', 'one@example.com');
    db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('all1','all1','All One','ALL_ACTIVE_STUDENTS'),('all2','all2','All Two','ALL_ACTIVE_STUDENTS')").run();
    const student = await repo.completeVerifiedClaim(claimInput('p2'));
    const rows = db.prepare('SELECT course_id,id FROM enrollments ORDER BY course_id').all();
    assert.deepEqual(rows.map((row) => row.course_id), ['all1', 'all2']);
    assert.ok(rows.every((row) => row.id === Buffer.from(JSON.stringify([student.id,row.course_id,'all-active']),'utf8').toString('hex')));
  } finally { db.close(); }
});

test('parallel claims of one preauthorization produce exactly one credential and enrollment', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p3', 'one@example.com');
    db.prepare("INSERT INTO courses(id,slug,title) VALUES('c1','c1','Course')").run();
    const results = await Promise.allSettled([repo.completeVerifiedClaim(claimInput('p3', 'c1')), repo.completeVerifiedClaim(claimInput('p3', 'c1'))]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM students').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM student_access_credentials WHERE status=\'ACTIVE\'').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n, 1);
  } finally { db.close(); }
});

test('parallel claims for one identity reuse the winning D1 student without partial duplicates', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p7', 'one@example.com');
    db.prepare("INSERT INTO preauthorizations(id,email,course_id,status,claim_strategy) VALUES('p8','one@example.com','c2','PREAUTHORIZED','preauth-only')").run();
    db.prepare("INSERT INTO courses(id,slug,title) VALUES('c1','c1','One'),('c2','c2','Two')").run();
    const [first, second] = await Promise.all([
      repo.completeVerifiedClaim(claimInput('p7', 'c1')),
      repo.completeVerifiedClaim(claimInput('p8', 'c2', { credential: { lookupHash: 'lookup-p8', prefix: 'ACCESS', hash: { algorithm: 'scrypt', salt: 'salt2', hash: 'hash-p8' } } })),
    ]);
    assert.equal(first.id, second.id);
    assert.equal(db.prepare('SELECT count(*) AS n FROM students').get().n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM student_access_credentials WHERE status='ACTIVE'").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM preauthorizations WHERE status='CLAIMED'").get().n, 2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM enrollments').get().n, 2);
  } finally { db.close(); }
});

test('credential conflict rolls back every D1 claim mutation', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p4', 'one@example.com');
    db.prepare("INSERT INTO students(id,display_name,email,certificate_name) VALUES('existing','Existing','existing@example.com','Existing')").run();
    db.prepare("INSERT INTO student_access_credentials(id,student_id,credential_lookup_hash,credential_hash,credential_salt,credential_prefix) VALUES('old','existing','lookup-p4','old-hash','salt','ACCESS')").run();
    await assert.rejects(repo.completeVerifiedClaim(claimInput('p4')));
    assert.equal(db.prepare("SELECT status FROM preauthorizations WHERE id='p4'").get().status, 'PREAUTHORIZED');
    assert.equal(db.prepare("SELECT count(*) AS n FROM students WHERE email='one@example.com'").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM student_access_credentials WHERE id != 'old'").get().n, 0);
  } finally { db.close(); }
});

test('D1 preauthorization normalization and claim request timestamp match the PostgreSQL contract', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p5', 'one@example.com');
    const record = await repo.findPreauthorization({ email: ' ONE@EXAMPLE.COM ' });
    assert.equal(record.id, 'p5');
    assert.equal(record.status, 'PREAUTHORIZED');
    await repo.markPreauthorizationClaimRequested('p5');
    const first = db.prepare("SELECT claim_requested_at FROM preauthorizations WHERE id='p5'").get().claim_requested_at;
    assert.ok(first);
    await repo.markPreauthorizationClaimRequested('p5');
    assert.equal(db.prepare("SELECT claim_requested_at FROM preauthorizations WHERE id='p5'").get().claim_requested_at, first);
  } finally { db.close(); }
});

test('D1 credential replacement and session lifecycle remain atomic and revocable', async () => {
  const { db, repo } = await fixture();
  try {
    const student = await repo.createStudent({ displayName: 'Student', email: 'one@example.com', phone: null, certificateName: 'Student', certificateEmail: null });
    await repo.replaceAccessCredential(student.id, { lookupHash: 'old-lookup', prefix: 'ACCESS', hash: { algorithm: 'scrypt', salt: 'salt', hash: 'old-hash' } });
    await repo.replaceAccessCredential(student.id, { lookupHash: 'new-lookup', prefix: 'ACCESS', hash: { algorithm: 'scrypt', salt: 'salt2', hash: 'new-hash' } });
    assert.equal((await repo.findActiveCredentialByLookupHash('old-lookup')), null);
    assert.equal((await repo.findActiveCredentialByLookupHash('new-lookup')).studentId, student.id);

    const expiry = new Date('2030-01-01T00:00:00.000Z');
    await repo.createSession(student.id, { tokenHash: 'session-token-hash', expiresAt: expiry });
    const session = await repo.findActiveSessionByTokenHash('session-token-hash', new Date('2029-01-01T00:00:00.000Z'));
    assert.equal(session.studentId, student.id);
    assert.equal(session.expiresAt.toISOString(), expiry.toISOString());
    await repo.revokeSession('session-token-hash');
    assert.equal(await repo.findActiveSessionByTokenHash('session-token-hash', new Date('2029-01-01T00:00:00.000Z')), null);
  } finally { db.close(); }
});

test('D1 refuses a claim for an inactive matching student without partial writes', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p6', 'one@example.com');
    db.prepare("INSERT INTO students(id,display_name,email,status,certificate_name) VALUES('inactive','Inactive','one@example.com','SUSPENDED','Inactive')").run();
    await assert.rejects(repo.completeVerifiedClaim(claimInput('p6')), /not active/);
    assert.equal(db.prepare("SELECT status FROM preauthorizations WHERE id='p6'").get().status, 'PREAUTHORIZED');
    assert.equal(db.prepare('SELECT count(*) AS n FROM student_access_credentials').get().n, 0);
  } finally { db.close(); }
});

test('D1 repository completes the real claim and login service flow', async () => {
  const { db, repo } = await fixture();
  try {
    addPreauthorization(db, 'p8', 'one@example.com');
    db.prepare("INSERT INTO courses(id,slug,title,assignment_mode) VALUES('all','all','All','ALL_ACTIVE_STUDENTS')").run();
    const access = new AccessService(repo, { accessCodePrefix: 'ACCESS' });
    const claim = await access.completeVerifiedClaim({ identity: { email: 'one@example.com' }, certificateName: 'One' });
    assert.equal(claim.ok, true);
    const login = new AccessLoginService(repo, { sessionTtlSeconds: 3600 });
    const signedIn = await login.login(claim.accessCode, new Date('2029-01-01T00:00:00.000Z'));
    assert.equal(signedIn.ok, true);
    const session = await repo.findActiveSessionByTokenHash(hashSessionToken(signedIn.sessionToken).hash, new Date('2029-01-01T00:00:00.000Z'));
    assert.equal(session.studentId, claim.studentId);
    assert.equal(db.prepare("SELECT count(*) AS n FROM enrollments WHERE course_id='all'").get().n, 1);
    await login.logout(signedIn.sessionToken);
    assert.equal(await repo.findActiveSessionByTokenHash(hashSessionToken(signedIn.sessionToken).hash, new Date('2029-01-01T00:00:00.000Z')), null);
  } finally { db.close(); }
});
